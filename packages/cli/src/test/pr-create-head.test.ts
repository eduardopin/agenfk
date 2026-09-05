/**
 * `agenfk pr create` must open the PR for the ITEM's branch (C11).
 *
 * It never read `item.branchName` and passed no `--head`, so `gh` opened the PR
 * for whatever branch the shell happened to be on, and the resulting URL plus a
 * `pr.opened` hub event were recorded against the item regardless. That was
 * survivable while the command refused items with a parent: a top-level item's
 * branch was usually the current one. It is not survivable now that a leaf task's
 * branch lives in its own worktree, which is the whole point of C11.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { program } from '../index';
import axios from 'axios';
import * as child_process from 'child_process';

vi.mock('axios');
vi.mock('child_process');
const mockedAxios = vi.mocked(axios, true);
const mockedChildProcess = vi.mocked(child_process, true);

const ITEM_ID = '11111111-2222-3333-4444-555555555555';
const PARENT_ID = '99999999-8888-7777-6666-555544443333';
const BRANCH = 'feature/11111111-2222-3333-4444-555555555555_the-task';

class ExitError extends Error {
  code?: number;
  constructor(code?: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

/** The gh args of the `pr create` invocation, or undefined if it never ran. */
function ghArgs(): string[] | undefined {
  const call = mockedChildProcess.spawnSync.mock.calls.find(
    (c) => c[0] === 'gh' && Array.isArray(c[1]) && c[1][0] === 'pr' && c[1][1] === 'create',
  );
  return call?.[1] as string[] | undefined;
}

describe('pr create — names the item\'s branch', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // `checkGhCli()` shells out with execSync; make gh look installed.
    mockedChildProcess.execSync.mockReturnValue(Buffer.from('gh version 2.0.0\n'));
    mockedAxios.put.mockResolvedValue({ data: { id: ITEM_ID } });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('passes --head with the item\'s branch, for a child item', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { id: ITEM_ID, type: 'TASK', title: 'The task', parentId: PARENT_ID, branchName: BRANCH },
    });
    mockedChildProcess.spawnSync.mockReturnValue({
      status: 0,
      stdout: 'https://github.com/o/r/pull/7\n',
      stderr: '',
    } as never);

    await program.parseAsync([
      'node', 'agenfk', 'pr', 'create', ITEM_ID, '--model', 'test-model', '--harness', 'claude-code',
    ]);

    const args = ghArgs();
    expect(args).toBeDefined();
    // The branch must be named, and named as the value of --head.
    expect(args).toContain('--head');
    expect(args![args!.indexOf('--head') + 1]).toBe(BRANCH);
  });

  it('refuses when the item has no branch, rather than opening a PR for whatever is checked out', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { id: ITEM_ID, type: 'TASK', title: 'The task', parentId: PARENT_ID },
    });

    await expect(
      program.parseAsync([
        'node', 'agenfk', 'pr', 'create', ITEM_ID, '--model', 'test-model', '--harness', 'claude-code',
      ]),
    ).rejects.toThrow(ExitError);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('has no branch'));
    // Nothing was opened, and nothing was recorded against the item.
    expect(ghArgs()).toBeUndefined();
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });
});
