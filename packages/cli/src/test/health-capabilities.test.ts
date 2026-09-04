import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockExistsSync, mockReadFileSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('@agenfk/telemetry', () => ({
  TelemetryClient: vi.fn(function (this: any) {
    this.capture = vi.fn();
    this.shutdown = vi.fn().mockResolvedValue(undefined);
    this.isEnabled = true;
    this.id = 'test-install-id';
  }),
  getInstallationId: vi.fn().mockReturnValue('test-install-id'),
  isTelemetryEnabled: vi.fn().mockReturnValue(true),
  getApiUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  readServerPort: vi.fn().mockReturnValue(null),
  DEFAULT_API_PORT: 3000,
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync },
}));

vi.mock('axios');
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
  default: { execSync: vi.fn(), spawn: vi.fn() },
}));
vi.mock('figlet', () => ({ default: { textSync: vi.fn().mockReturnValue('AgEnFK') } }));

import { program } from '../index';
import axios from 'axios';

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

/** Route each health probe to its own canned response. */
function respond(capabilities: { status?: number; body?: unknown; fail?: boolean }) {
  mockedAxios.get = vi.fn(async (url: string) => {
    if (url.includes('/v1/capabilities')) {
      if (capabilities.fail) {
        const err: any = new Error('Request failed with status code 404');
        err.response = { status: capabilities.status ?? 404 };
        throw err;
      }
      return { data: capabilities.body };
    }
    if (url.includes('/db/status')) return { data: { dbPath: '/tmp/db.sqlite', dbType: 'sqlite' } };
    if (url.includes('/projects')) return { data: [] };
    return { data: { message: 'AgEnFK Framework API is running' } };
  });
}

const ALL_OFF = {
  schemaVersion: 1,
  version: '1.1.16',
  flags: {
    autonomousDelivery: { enabled: false },
    durableExecution: { enabled: false },
    localProcessRuntime: { enabled: false },
  },
  foundationGate: 'unknown',
};

describe('agenfk health — Autonomous Delivery flags', () => {
  let out: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
    out = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { out.push(a.join(' ')); });
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((s: string) => { out.push(s); return true; }) as any);
  });

  afterEach(() => {
    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  const text = () => out.join('\n');

  it('queries the capabilities endpoint', async () => {
    respond({ body: ALL_OFF });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/v1/capabilities'));
  });

  it('prints every flag as off on a default installation', async () => {
    respond({ body: ALL_OFF });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(text()).toContain('autonomousDelivery: off');
    expect(text()).toContain('durableExecution: off');
    expect(text()).toContain('localProcessRuntime: off');
  });

  it('prints a flag as on when the server reports it enabled', async () => {
    respond({
      body: { ...ALL_OFF, flags: { ...ALL_OFF.flags, durableExecution: { enabled: true } } },
    });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(text()).toContain('durableExecution: on');
    expect(text()).toContain('autonomousDelivery: off');
  });

  it('degrades without raising an issue when the server has no capabilities endpoint', async () => {
    // The fixture fails other unrelated checks, so the overall banner is not a
    // usable signal. What matters is that a missing endpoint changes nothing:
    // the issue count must be identical with and without it.
    const issueCount = () => {
      const m = text().match(/Found (\d+) potential issue/);
      return m ? Number(m[1]) : 0;
    };

    respond({ body: ALL_OFF });
    await program.parseAsync(['node', 'agenfk', 'health']);
    const withEndpoint = issueCount();

    out = [];
    respond({ fail: true, status: 404 });
    await program.parseAsync(['node', 'agenfk', 'health']);

    expect(text()).toContain('server does not report capabilities');
    expect(issueCount()).toBe(withEndpoint);
  });

  it('degrades when the server is unreachable', async () => {
    respond({ fail: true, status: 0 });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(text()).toContain('server does not report capabilities');
  });

  it('says so explicitly when the server reports no flags at all', async () => {
    respond({ body: { schemaVersion: 1, version: '1.1.16', flags: {}, foundationGate: 'unknown' } });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(text()).toContain('(none reported)');
  });

  it('does not throw when the response has no flags key', async () => {
    respond({ body: { schemaVersion: 1, version: '1.1.16', foundationGate: 'unknown' } });
    await expect(program.parseAsync(['node', 'agenfk', 'health'])).resolves.toBeDefined();
    expect(text()).toContain('(none reported)');
  });

  it('still performs the pre-existing API server probe', async () => {
    respond({ body: ALL_OFF });
    await program.parseAsync(['node', 'agenfk', 'health']);
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/\/$/));
  });
});
