/**
 * `GET /v1/capabilities` — what this installation is and what is switched on.
 *
 * The first router module in `packages/server`. Per ADR-0001 D3/D4 it is built
 * by a factory and receives its dependencies as arguments: it must never import
 * `server.ts`, which is a module-level singleton whose `getCurrentVersion()` is
 * private — a direct import would be a cycle.
 *
 * The response is deliberately small and closed. It carries no configuration
 * values, no filesystem paths and no tokens: only the version, the three
 * Autonomous Delivery flags, and a placeholder for the foundation gate that
 * T03 replaces with a real evaluation.
 */
import { Router, type Request, type Response } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveFeatureFlags, type FeatureFlags } from '@agenfk/core';

/** Bumped when the payload shape changes in a way a client could notice (plan §6.1). */
export const CAPABILITIES_SCHEMA_VERSION = 1;

/**
 * `/v1/capabilities` is canonical, matching spec §23.1 and T03's
 * `/v1/foundation-gate`. `/capabilities` is an alias kept because the AD0-a task
 * card names it; both are served by one handler. See CONTRADICTIONS.md C14.
 */
export const CAPABILITIES_PATHS = ['/v1/capabilities', '/capabilities'] as const;

export interface CapabilitiesResponse {
  schemaVersion: number;
  version: string;
  flags: FeatureFlags;
  /**
   * Durable Execution D1–D5 readiness (spec §5). T02 ships the placeholder only;
   * T03 introduces the evaluator behind `GET /v1/foundation-gate` and replaces
   * this with a real verdict.
   */
  foundationGate: 'unknown';
}

export interface CapabilitiesDeps {
  /** Injected rather than imported, to keep this module free of `server.ts`. */
  getVersion: () => string;
  /** The `features` value from `~/.agenfk/config.json`, or `undefined`. */
  loadFeatureConfig: () => unknown;
  /** Overridable so tests need not mutate the real environment. */
  getEnv?: () => Record<string, string | undefined>;
}

/**
 * Read the `features` key out of `~/.agenfk/config.json`.
 *
 * A missing file, unreadable file or malformed JSON all mean "nothing
 * configured" — never an error. A capabilities endpoint that 500s because a
 * config file has a stray comma would be worse than useless.
 */
export function readFeatureConfig(
  homedir?: string,
  resolveHomedir: () => string = os.homedir,
): unknown {
  try {
    // resolveHomedir is *called* inside the try, not used as a default
    // parameter value: a default is evaluated before the guard runs, and
    // os.homedir() can itself throw on a machine with no $HOME and no passwd
    // entry — which would surface as a 500 from an endpoint whose whole
    // contract is that it does not fail.
    const configPath = path.join(homedir ?? resolveHomedir(), '.agenfk', 'config.json');
    if (!fs.existsSync(configPath)) return undefined;
    return JSON.parse(fs.readFileSync(configPath, 'utf8')).features;
  } catch {
    return undefined;
  }
}

export function buildCapabilities(deps: CapabilitiesDeps): CapabilitiesResponse {
  const getEnv = deps.getEnv ?? (() => process.env);
  return {
    schemaVersion: CAPABILITIES_SCHEMA_VERSION,
    version: deps.getVersion(),
    flags: resolveFeatureFlags({ env: getEnv(), config: deps.loadFeatureConfig() }),
    foundationGate: 'unknown',
  };
}

export function createCapabilitiesRouter(deps: CapabilitiesDeps): Router {
  const router = Router();
  const handler = (_req: Request, res: Response) => {
    res.json(buildCapabilities(deps));
  };
  for (const p of CAPABILITIES_PATHS) router.get(p, handler);
  return router;
}
