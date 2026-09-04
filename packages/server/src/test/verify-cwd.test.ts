/**
 * TDD for CGLAB-13 — the project's verifyCommand must always run in the project's
 * own working directory (the nearest `.agenfk` ancestor of the caller's cwd), not
 * in the AgEnFK server daemon's directory.
 *
 * The server is a single global daemon serving many projects, so
 * findProjectRoot(process.cwd()) resolves to wherever the daemon was launched —
 * the wrong directory for every project but the one it started in. Callers pass
 * their own `cwd` on /validate; the server must resolve it UP to the project root
 * and both (a) store that as project.projectRoot and (b) run the command there,
 * so verify works even when invoked from a subdirectory and needs no `cd` prefix.
 *
 * These reflect future functionality and are expected to fail until the server
 * resolves the caller cwd to the project root.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

vi.mock('axios', () => {
  const mockAxios = vi.fn() as any;
  mockAxios.get = vi.fn();
  mockAxios.post = vi.fn();
  mockAxios.create = vi.fn(() => mockAxios);
  return { default: mockAxios };
});

const TEST_DB = path.resolve('./verify-cwd-test-db.sqlite');
process.env.AGENFK_DB_PATH = TEST_DB;
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

import { app, initStorage, VERIFY_TOKEN } from '../server';

// A throwaway project tree: <root>/.agenfk + <root>/packages/cli (a subdir).
let projRoot: string;
let subDir: string;

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const f = `${TEST_DB}${suffix}`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (projRoot && fs.existsSync(projRoot)) fs.rmSync(projRoot, { recursive: true, force: true });
});

async function waitForRun(runId: string, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    const res = await request(app).get(`/items/validate-runs/${runId}`).set('x-agenfk-internal', VERIFY_TOKEN!);
    if (res.status !== 200) return res;
    if (res.body.status !== 'running') return res;
    if (Date.now() - start > timeoutMs) return res;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function itemOnFinalStep(name: string, verifyCommand: string) {
  const p = (await request(app).post('/projects').send({ name })).body;
  await request(app).put(`/projects/${p.id}/verify-command`).set('x-agenfk-internal', VERIFY_TOKEN!).send({ verifyCommand });
  const item = (await request(app).post('/items').send({ type: 'TASK', title: `${name}-item`, projectId: p.id })).body;
  await request(app)
    .post('/items/bulk')
    .set('x-agenfk-internal', VERIFY_TOKEN!)
    .send({ items: [{ id: item.id, updates: { status: 'TEST' } }] });
  return { projectId: p.id, item };
}

describe('CGLAB-13 — verifyCommand runs in the project working directory', () => {
  beforeEach(async () => {
    await initStorage();
    projRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-verify-cwd-'));
    // realpath so macOS /var → /private/var symlink doesn't defeat the comparison.
    projRoot = fs.realpathSync(projRoot);
    fs.mkdirSync(path.join(projRoot, '.agenfk'), { recursive: true });
    subDir = path.join(projRoot, 'packages', 'cli');
    fs.mkdirSync(subDir, { recursive: true });
  });

  it('runs the command at the project ROOT even when the caller cwd is a subdirectory', async () => {
    if (!VERIFY_TOKEN) return;
    const { item } = await itemOnFinalStep('CWD1', 'pwd');

    const res = await request(app)
      .post(`/items/${item.id}/validate`)
      .set('x-agenfk-internal', VERIFY_TOKEN)
      .send({ async: true, cwd: subDir });
    expect(res.status).toBe(202);

    const done = await waitForRun(res.body.runId);
    expect(done.body.status).toBe('passed');
    // `pwd` must print the repo root, NOT the subdirectory the caller was in.
    expect(done.body.output.trim()).toContain(projRoot);
    expect(done.body.output).not.toContain(path.join('packages', 'cli'));
  });

  it('stores project.projectRoot as the resolved project root, not the raw caller cwd', async () => {
    if (!VERIFY_TOKEN) return;
    const { projectId, item } = await itemOnFinalStep('CWD2', 'true');

    const res = await request(app)
      .post(`/items/${item.id}/validate`)
      .set('x-agenfk-internal', VERIFY_TOKEN)
      .send({ async: true, cwd: subDir });
    await waitForRun(res.body.runId);

    const proj = (await request(app).get(`/projects/${projectId}`)).body;
    expect(proj.projectRoot).toBe(projRoot);
  });

  it('non-regression: a cwd already AT the project root is stored/used unchanged (MCP-path invariant)', async () => {
    if (!VERIFY_TOKEN) return;
    const { projectId, item } = await itemOnFinalStep('CWD3', 'pwd');

    const res = await request(app)
      .post(`/items/${item.id}/validate`)
      .set('x-agenfk-internal', VERIFY_TOKEN)
      .send({ async: true, cwd: projRoot }); // MCP sends the project dir directly
    const done = await waitForRun(res.body.runId);

    expect(done.body.output.trim()).toContain(projRoot);
    const proj = (await request(app).get(`/projects/${projectId}`)).body;
    expect(proj.projectRoot).toBe(projRoot);
  });

  // ── BUG 37660bd2 — the repository boundary ──────────────────────────────────

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  it('a worktree resolves to the worktree root, not to a .agenfk marker above it', async () => {
    if (!VERIFY_TOKEN) return;
    // The shape of BUG 37660bd2: a git worktree carries no `.agenfk` (the
    // directory is gitignored and never checked out), and there is a `.agenfk`
    // in an ancestor — here a sibling project directory, in the wild the
    // framework's own `~/.agenfk`. The unbounded walk used to hand back the
    // ancestor, and the verifyCommand then ran there.
    const outer = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-outer-')));
    try {
      fs.mkdirSync(path.join(outer, '.agenfk'));
      const repo = path.join(outer, 'repo');
      fs.mkdirSync(repo);
      git(repo, 'init', '-q', '-b', 'main');
      git(repo, 'config', 'user.email', 'test@example.com');
      git(repo, 'config', 'user.name', 'Test');
      fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
      git(repo, 'add', '-A');
      git(repo, 'commit', '-qm', 'initial');
      const worktree = path.join(outer, 'wt');
      git(repo, 'worktree', 'add', '-q', worktree, '-b', 'fixture');

      const { projectId, item } = await itemOnFinalStep('CWD5', 'pwd');
      const res = await request(app)
        .post(`/items/${item.id}/validate`)
        .set('x-agenfk-internal', VERIFY_TOKEN)
        .send({ async: true, cwd: worktree });
      const done = await waitForRun(res.body.runId);

      const proj = (await request(app).get(`/projects/${projectId}`)).body;
      expect(proj.projectRoot).toBe(fs.realpathSync(worktree));
      expect(proj.projectRoot).not.toBe(outer);
      // And the command actually ran there.
      expect(done.body.output.trim()).toContain(fs.realpathSync(worktree));
    } finally {
      fs.rmSync(outer, { recursive: true, force: true });
    }
  });

  it('records a visible comment when the resolved project root changes', async () => {
    if (!VERIFY_TOKEN) return;
    // Two items in the same project, validated from two different roots. The
    // second validate repoints the project — silently, before this change.
    const p = (await request(app).post('/projects').send({ name: 'CWD6' })).body;
    await request(app).put(`/projects/${p.id}/verify-command`).set('x-agenfk-internal', VERIFY_TOKEN!).send({ verifyCommand: 'true' });

    const mkItem = async (title: string) => {
      const it0 = (await request(app).post('/items').send({ type: 'TASK', title, projectId: p.id })).body;
      await request(app).post('/items/bulk').set('x-agenfk-internal', VERIFY_TOKEN!)
        .send({ items: [{ id: it0.id, updates: { status: 'TEST' } }] });
      return it0;
    };

    const first = await mkItem('CWD6-a');
    const r1 = await request(app).post(`/items/${first.id}/validate`)
      .set('x-agenfk-internal', VERIFY_TOKEN).send({ async: true, cwd: projRoot });
    await waitForRun(r1.body.runId);

    const otherRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-other-')));
    try {
      fs.mkdirSync(path.join(otherRoot, '.agenfk'));
      const second = await mkItem('CWD6-b');
      const r2 = await request(app).post(`/items/${second.id}/validate`)
        .set('x-agenfk-internal', VERIFY_TOKEN).send({ async: true, cwd: otherRoot });
      await waitForRun(r2.body.runId);

      const proj = (await request(app).get(`/projects/${p.id}`)).body;
      expect(proj.projectRoot).toBe(otherRoot);

      const reloaded = (await request(app).get(`/items/${second.id}`)).body;
      const repointComment = (reloaded.comments || []).find((c: any) => c.content.includes('Project root repointed'));
      expect(repointComment).toBeDefined();
      expect(repointComment.content).toContain(projRoot);
      expect(repointComment.content).toContain(otherRoot);
    } finally {
      fs.rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  it('fallback: a caller cwd with no .agenfk ancestor is used as-is (returns the raw cwd)', async () => {
    if (!VERIFY_TOKEN) return;
    // A directory tree with NO .agenfk marker anywhere above it.
    const orphan = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-orphan-')));
    try {
      const { projectId, item } = await itemOnFinalStep('CWD4', 'true');
      const res = await request(app)
        .post(`/items/${item.id}/validate`)
        .set('x-agenfk-internal', VERIFY_TOKEN)
        .send({ async: true, cwd: orphan });
      await waitForRun(res.body.runId);

      const proj = (await request(app).get(`/projects/${projectId}`)).body;
      expect(proj.projectRoot).toBe(orphan);
    } finally {
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  });
});
