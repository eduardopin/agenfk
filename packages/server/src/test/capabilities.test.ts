import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app, initStorage } from '../server';
import {
  createCapabilitiesRouter,
  buildCapabilities,
  readFeatureConfig,
  CAPABILITIES_PATHS,
  CAPABILITIES_SCHEMA_VERSION,
} from '../routes/capabilities';
import { FEATURE_ENV_VARS } from '@agenfk/core';

const TEST_DB = path.resolve('./capabilities-test-db.sqlite');

/**
 * The mounted route reads the real environment and the real
 * `~/.agenfk/config.json`. Both are redirected at a scratch directory so these
 * tests assert the shipped wiring rather than whatever this machine happens to
 * have configured. `os.homedir()` honours `$HOME` on POSIX.
 */
let scratchHome: string;
const savedHome = process.env.HOME;
const savedEnv: Record<string, string | undefined> = {};

function writeUserConfig(contents: unknown | string): void {
  const dir = path.join(scratchHome, '.agenfk');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    typeof contents === 'string' ? contents : JSON.stringify(contents),
  );
}

function clearUserConfig(): void {
  const f = path.join(scratchHome, '.agenfk', 'config.json');
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

describe('GET /v1/capabilities', () => {
  beforeAll(async () => {
    process.env.AGENFK_DB_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    await initStorage();
    scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-caps-'));
    for (const v of Object.values(FEATURE_ENV_VARS)) savedEnv[v] = process.env[v];
  });

  afterAll(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (fs.existsSync(scratchHome)) fs.rmSync(scratchHome, { recursive: true, force: true });
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  beforeEach(() => {
    process.env.HOME = scratchHome;
    for (const v of Object.values(FEATURE_ENV_VARS)) delete process.env[v];
    clearUserConfig();
  });

  it('reports every Autonomous Delivery flag as off by default', async () => {
    const res = await request(app).get('/v1/capabilities');
    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual({
      autonomousDelivery: { enabled: false },
      durableExecution: { enabled: false },
      localProcessRuntime: { enabled: false },
    });
  });

  it('returns exactly the documented keys and nothing else', async () => {
    const res = await request(app).get('/v1/capabilities');
    expect(Object.keys(res.body).sort()).toEqual([
      'flags',
      'foundationGate',
      'schemaVersion',
      'version',
    ]);
    expect(res.body.schemaVersion).toBe(CAPABILITIES_SCHEMA_VERSION);
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version.length).toBeGreaterThan(0);
    expect(res.body.foundationGate).toBe('unknown');
  });

  it('leaks no configuration values, paths or tokens', async () => {
    writeUserConfig({
      dbPath: '/home/someone/secret/db.sqlite',
      jira: { clientSecret: 'super-secret-value' },
      features: { autonomousDelivery: { enabled: true } },
    });
    const body = JSON.stringify((await request(app).get('/v1/capabilities')).body);
    expect(body).not.toContain('super-secret-value');
    expect(body).not.toContain('/home/someone');
    expect(body).not.toContain('dbPath');
    expect(body).not.toContain('jira');
  });

  it('serves the unversioned /capabilities alias identically', async () => {
    const versioned = await request(app).get('/v1/capabilities');
    const alias = await request(app).get('/capabilities');
    expect(alias.status).toBe(200);
    expect(alias.body).toEqual(versioned.body);
  });

  it('exposes both documented paths', () => {
    expect(CAPABILITIES_PATHS).toEqual(['/v1/capabilities', '/capabilities']);
  });

  it('matches the version reported by GET /version', async () => {
    const [caps, version] = await Promise.all([
      request(app).get('/v1/capabilities'),
      request(app).get('/version'),
    ]);
    expect(caps.body.version).toBe(version.body.version);
  });

  describe('flag resolution through the shipped wiring', () => {
    it('turns a flag on from ~/.agenfk/config.json', async () => {
      writeUserConfig({ features: { durableExecution: { enabled: true } } });
      const res = await request(app).get('/v1/capabilities');
      expect(res.body.flags.durableExecution.enabled).toBe(true);
      expect(res.body.flags.autonomousDelivery.enabled).toBe(false);
    });

    it('lets the environment override the config file in both directions', async () => {
      writeUserConfig({ features: { autonomousDelivery: { enabled: true } } });
      process.env[FEATURE_ENV_VARS.autonomousDelivery] = '0';
      expect((await request(app).get('/v1/capabilities')).body.flags.autonomousDelivery.enabled)
        .toBe(false);

      clearUserConfig();
      process.env[FEATURE_ENV_VARS.autonomousDelivery] = '1';
      expect((await request(app).get('/v1/capabilities')).body.flags.autonomousDelivery.enabled)
        .toBe(true);
    });

    it('stays up with a malformed config file instead of returning 500', async () => {
      writeUserConfig('{ "features": { "autonomousDelivery": ');
      const res = await request(app).get('/v1/capabilities');
      expect(res.status).toBe(200);
      expect(res.body.flags.autonomousDelivery.enabled).toBe(false);
    });

    it('stays up when no config file exists at all', async () => {
      clearUserConfig();
      const res = await request(app).get('/v1/capabilities');
      expect(res.status).toBe(200);
      expect(res.body.flags.autonomousDelivery.enabled).toBe(false);
    });
  });
});

describe('readFeatureConfig', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenfk-cfg-')); });
  afterAll(() => { /* per-test dirs live in tmp and are reaped by the OS */ });

  it('returns undefined when the file is absent', () => {
    expect(readFeatureConfig(dir)).toBeUndefined();
  });

  it('returns undefined when the file is not JSON', () => {
    fs.mkdirSync(path.join(dir, '.agenfk'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agenfk', 'config.json'), 'not json at all');
    expect(readFeatureConfig(dir)).toBeUndefined();
  });

  it('returns undefined when the file is JSON without a features key', () => {
    fs.mkdirSync(path.join(dir, '.agenfk'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agenfk', 'config.json'), JSON.stringify({ telemetry: true }));
    expect(readFeatureConfig(dir)).toBeUndefined();
  });

  it('returns undefined when the file parses to null', () => {
    fs.mkdirSync(path.join(dir, '.agenfk'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agenfk', 'config.json'), 'null');
    expect(readFeatureConfig(dir)).toBeUndefined();
  });

  it('returns undefined instead of throwing when os.homedir() itself fails', () => {
    // Regression guard for the default-parameter trap: os.homedir() must be
    // resolved inside the try, not as a default argument, or an OS-level
    // failure escapes and the endpoint 500s.
    const boom = () => { throw new Error('no home directory'); };
    expect(readFeatureConfig(undefined, boom)).toBeUndefined();
    expect(() => buildCapabilities({
      getVersion: () => '1.0.0',
      loadFeatureConfig: () => readFeatureConfig(undefined, boom),
      getEnv: () => ({}),
    })).not.toThrow();
  });

  it('returns the features object when present', () => {
    fs.mkdirSync(path.join(dir, '.agenfk'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.agenfk', 'config.json'),
      JSON.stringify({ features: { autonomousDelivery: { enabled: true } } }),
    );
    expect(readFeatureConfig(dir)).toEqual({ autonomousDelivery: { enabled: true } });
  });
});

describe('createCapabilitiesRouter (standalone, no server boot)', () => {
  it('mounts on a bare express app with injected dependencies only', async () => {
    const standalone = express();
    standalone.use(createCapabilitiesRouter({
      getVersion: () => '9.9.9-test',
      loadFeatureConfig: () => ({ localProcessRuntime: true }),
      getEnv: () => ({}),
    }));
    const res = await request(standalone).get('/v1/capabilities');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      schemaVersion: CAPABILITIES_SCHEMA_VERSION,
      version: '9.9.9-test',
      flags: {
        autonomousDelivery: { enabled: false },
        durableExecution: { enabled: false },
        localProcessRuntime: { enabled: true },
      },
      foundationGate: 'unknown',
    });
  });

  it('reads the environment through the injected getter, not process.env', () => {
    const built = buildCapabilities({
      getVersion: () => '0.0.0',
      loadFeatureConfig: () => undefined,
      getEnv: () => ({ [FEATURE_ENV_VARS.autonomousDelivery]: 'yes' }),
    });
    expect(built.flags.autonomousDelivery.enabled).toBe(true);
  });

  it('falls back to process.env when no getter is injected', () => {
    const saved = process.env[FEATURE_ENV_VARS.durableExecution];
    process.env[FEATURE_ENV_VARS.durableExecution] = 'true';
    try {
      const built = buildCapabilities({
        getVersion: () => '0.0.0',
        loadFeatureConfig: () => undefined,
      });
      expect(built.flags.durableExecution.enabled).toBe(true);
    } finally {
      if (saved === undefined) delete process.env[FEATURE_ENV_VARS.durableExecution];
      else process.env[FEATURE_ENV_VARS.durableExecution] = saved;
    }
  });
});
