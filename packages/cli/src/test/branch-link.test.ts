import { describe, it, expect, vi, beforeEach } from 'vitest';
import { program } from '../index';
import axios from 'axios';
import * as child_process from 'child_process';
import * as fs from 'fs';

vi.mock('axios');
vi.mock('child_process');
vi.mock('fs');

const mockedAxios = vi.mocked(axios, true);
const mockedChildProcess = vi.mocked(child_process, true);
const mockedFs = vi.mocked(fs, true);

describe('branch link command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{"items": []}');
  });

  it('should link an existing branch to an item', async () => {
    const itemId = 'a1b2c3d4-0000-0000-0000-000000000001';
    mockedAxios.get.mockResolvedValue({
      data: { id: itemId, title: 'Test', type: 'TASK', parentId: undefined },
    });
    mockedChildProcess.execSync.mockReturnValue(Buffer.from('feat/CGLAB-86_fix-bugs-to-fix\n'));
    mockedAxios.put.mockResolvedValue({ data: {} });

    await program.parseAsync([
      'node', 'agenfk', 'branch', 'link', itemId, 'feat/CGLAB-86_fix-bugs-to-fix',
    ]);

    expect(mockedChildProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining('git rev-parse --verify'),
      expect.any(Object)
    );
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining(`/items/${itemId}`),
      { branchName: 'feat/CGLAB-86_fix-bugs-to-fix' }
    );
  });

  it('should reject linking a branch that does not exist locally', async () => {
    const itemId = 'a1b2c3d4-0000-0000-0000-000000000002';
    mockedAxios.get.mockResolvedValue({
      data: { id: itemId, title: 'Test', type: 'TASK', parentId: undefined },
    });
    mockedChildProcess.execSync.mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('git rev-parse')) {
        throw new Error('fatal: ambiguous argument');
      }
      return Buffer.from('');
    });

    const spy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await program.parseAsync([
      'node', 'agenfk', 'branch', 'link', itemId, 'nonexistent-branch',
    ]);
    expect(spy).toHaveBeenCalledWith(1);
    expect(mockedAxios.put).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // C11: this test previously asserted the opposite — that linking a child item
  // was refused, "Branches are tracked on top-level items only". The delivery
  // plan needs one branch per task and the only top-level item in a plan is the
  // epic, so the constraint was relaxed by owner decision. The assertion is
  // inverted rather than the test deleted: it still covers this code path.
  it('links a branch to a child item (C11: no longer top-level only)', async () => {
    const itemId = 'a1b2c3d4-0000-0000-0000-000000000003';
    const parentId = 'e5f6a7b8-0000-0000-0000-000000000004';
    mockedAxios.get.mockResolvedValue({
      data: { id: itemId, title: 'Test', type: 'TASK', parentId },
    });
    // The branch must exist locally — that check is unchanged and still applies
    // to a child item, so it is satisfied here rather than bypassed.
    mockedChildProcess.execSync.mockReturnValue(Buffer.from('some-branch\n'));
    mockedAxios.put.mockResolvedValue({ data: {} });

    const spy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await program.parseAsync([
      'node', 'agenfk', 'branch', 'link', itemId, 'some-branch',
    ]);
    expect(spy).not.toHaveBeenCalled();
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining(itemId),
      { branchName: 'some-branch' },
    );
    spy.mockRestore();
  });

  it('should reject branch names with invalid characters', async () => {
    const itemId = 'a1b2c3d4-0000-0000-0000-000000000005';
    mockedAxios.get.mockResolvedValue({
      data: { id: itemId, title: 'Test', type: 'TASK', parentId: undefined },
    });

    const spy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await program.parseAsync([
      'node', 'agenfk', 'branch', 'link', itemId, 'bad;branch-name',
    ]);
    expect(spy).toHaveBeenCalledWith(1);
    expect(mockedChildProcess.execSync).not.toHaveBeenCalled();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
