/**
 * Tests for contradiction C5 / BUG `2df0f02f-7533-4733-b935-3a73f749fa22`.
 *
 * `autoGitCommit` runs `git add -A && git commit` in the validate handler when
 * an item reaches DONE. It had **zero** coverage: all four call sites are behind
 * `NODE_ENV !== 'test' && !VITEST`, so nothing under vitest ever reached it.
 * The exec seam is what makes it testable — no test here ever runs a real
 * `git commit`.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { AgEnFKItem, Project } from '@agenfk/core';

// `autoGitCommit` compares the project root with `os.homedir()`. Proving that
// comparison canonicalises both sides needs a home directory reached through a
// symlink — the `/home -> /var/home` layout, a bind mount, an encrypted home —
// which means controlling `os.homedir()`.
const { fakeHomeLink, fakeHomeReal } = vi.hoisted(() => {
  const nodeFs = require('fs') as typeof import('fs');
  const nodePath = require('path') as typeof import('path');
  const nodeOs = require('os') as typeof import('os');
  const base = nodeFs.realpathSync(nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'agenfk-symhome-')));
  const real = nodePath.join(base, 'var', 'home', 'u');
  nodeFs.mkdirSync(real, { recursive: true });
  nodeFs.mkdirSync(nodePath.join(base, 'home'), { recursive: true });
  const link = nodePath.join(base, 'home', 'u');
  nodeFs.symlinkSync(real, link, 'dir');
  return { fakeHomeLink: link, fakeHomeReal: real, base };
});

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, default: actual, homedir: () => fakeHomeLink };
});

vi.mock('axios', () => {
  const mockAxios = vi.fn() as any;
  mockAxios.get = vi.fn();
  mockAxios.post = vi.fn();
  mockAxios.create = vi.fn(() => mockAxios);
  return { default: mockAxios };
});

const TEST_DB = path.resolve('./auto-git-commit-test-db.sqlite');
process.env.AGENFK_DB_PATH = TEST_DB;
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

import { autoGitCommit, setAutoGitCommitExecImpl, resetAutoGitCommitExecImpl } from '../server';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

const item = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  type: 'TASK',
  title: 'A closing task',
  projectId: 'proj-1',
} as unknown as AgEnFKItem;

const project = (autoGitCommitEnabled: boolean): Project =>
  ({ id: 'proj-1', name: 'p', autoGitCommit: autoGitCommitEnabled } as unknown as Project);

let repo: string;
let tmp: string;
/** Records every command the seam is asked to run. Empty means nothing ran. */
let calls: Array<{ cmd: string; cwd: string }>;

beforeEach(() => {
  calls = [];
  setAutoGitCommitExecImpl(((cmd: string, opts: any, cb: any) => {
    calls.push({ cmd, cwd: opts?.cwd });
    cb(null, 'committed\n', '');
    return undefined as any;
  }) as any);

  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-autogit-')));
  repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'initial');
});

afterAll(() => {
  resetAutoGitCommitExecImpl();
  if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  for (const suffix of ['', '-shm', '-wal']) {
    const f = `${TEST_DB}${suffix}`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

describe('autoGitCommit — opt-in', () => {
  it('does nothing when the project has not opted in', async () => {
    const res = await autoGitCommit(item, repo, project(false));
    expect(res.success).toBe(false);
    expect(res.skipped).toContain('auto-commit is off');
    expect(calls).toHaveLength(0);
  });

  it('does nothing when the project is absent entirely', async () => {
    const res = await autoGitCommit(item, repo, null);
    expect(res.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('commits at the repository root once opted in', async () => {
    const res = await autoGitCommit(item, repo, project(true));
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].cwd).toBe(repo);
    expect(calls[0].cmd).toContain('git add -A');
    expect(calls[0].cmd).toContain('close(task): A closing task [aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee]');
  });

  it('commits at a worktree root', async () => {
    const worktree = path.join(tmp, 'wt');
    git(repo, 'worktree', 'add', '-q', worktree, '-b', 'fixture');
    const res = await autoGitCommit(item, fs.realpathSync(worktree), project(true));
    expect(res.success).toBe(true);
    expect(calls[0].cwd).toBe(fs.realpathSync(worktree));
  });
});

describe('autoGitCommit — repository-boundary guards', () => {
  it('refuses the home directory even when opted in', async () => {
    const res = await autoGitCommit(item, os.homedir(), project(true));
    expect(res.success).toBe(false);
    expect(res.skipped).toContain('home directory');
    expect(calls).toHaveLength(0);
  });

  it('refuses a subdirectory of a repository', async () => {
    const sub = path.join(repo, 'packages');
    fs.mkdirSync(sub);
    const res = await autoGitCommit(item, sub, project(true));
    expect(res.success).toBe(false);
    expect(res.skipped).toContain('not the toplevel');
    expect(calls).toHaveLength(0);
  });

  it('refuses a directory outside any repository', async () => {
    const plain = path.join(tmp, 'not-a-repo');
    fs.mkdirSync(plain);
    const res = await autoGitCommit(item, plain, project(true));
    expect(res.success).toBe(false);
    expect(res.skipped).toContain('not the toplevel');
    expect(calls).toHaveLength(0);
  });

  it('refuses an empty project root', async () => {
    const res = await autoGitCommit(item, '', project(true));
    expect(res.success).toBe(false);
    expect(res.skipped).toContain('no project root');
    expect(calls).toHaveLength(0);
  });
});

describe('autoGitCommit — a symlinked home directory', () => {
  it('refuses a home directory reached through a symlink, even though it is a real git toplevel', () => {
    // The regression the string comparison allowed: `projectRoot` arrives
    // realpath'd, `os.homedir()` does not, so `/base/var/home/u` and
    // `/base/home/u` compared unequal — and a dotfiles home genuinely IS a git
    // toplevel, so the next guard passed too and `git add -A` ran in $HOME.
    git(fakeHomeReal, 'init', '-q', '-b', 'main');
    git(fakeHomeReal, 'config', 'user.email', 'test@example.com');
    git(fakeHomeReal, 'config', 'user.name', 'Test');
    fs.writeFileSync(path.join(fakeHomeReal, '.bashrc'), 'export X=1\n');
    git(fakeHomeReal, 'add', '-A');
    git(fakeHomeReal, 'commit', '-qm', 'dotfiles');

    return autoGitCommit(item, fakeHomeReal, project(true)).then((res) => {
      expect(res.success).toBe(false);
      expect(res.skipped).toContain('home directory');
      expect(calls).toHaveLength(0);
    });
  });
});

describe('autoGitCommit — failure reporting', () => {
  it('reports a git failure rather than swallowing it', async () => {
    setAutoGitCommitExecImpl(((cmd: string, opts: any, cb: any) => {
      calls.push({ cmd, cwd: opts?.cwd });
      cb(new Error('nothing to commit, working tree clean'), '', 'stderr text');
      return undefined as any;
    }) as any);
    const res = await autoGitCommit(item, repo, project(true));
    expect(res.success).toBe(false);
    expect(res.error).toContain('nothing to commit');
    expect(res.output).toBe('stderr text');
  });
});
