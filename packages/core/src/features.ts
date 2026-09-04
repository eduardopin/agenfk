/**
 * Autonomous Delivery feature flags.
 *
 * Every flag defaults to `false`: with no configuration at all, the product
 * behaves exactly as it did before Autonomous Delivery existed (spec §26 AD0,
 * §28).
 *
 * This module is deliberately **pure** — no filesystem, no `process.env`, no
 * Node built-ins. `packages/core` is dependency-free and environment-agnostic,
 * and ADR-0001 D2/D5 keeps it that way: the caller reads its own configuration
 * and passes the values in. See `docs/adr/0001-component-boundaries-and-package-layout.md`.
 */

/** The flags Autonomous Delivery introduces. All default to `false`. */
export interface FeatureFlags {
  /** Master switch for the Autonomous Delivery surface (contract, planning, scheduler). */
  autonomousDelivery: { enabled: boolean };
  /** Durable Execution entities: Execution, Checkpoint, Lease, WorktreeBinding. */
  durableExecution: { enabled: boolean };
  /** The local-process RuntimeAdapter, a test double / developer fallback for Herdr (spec §4.1). */
  localProcessRuntime: { enabled: boolean };
}

/** Flag name → the environment variable that overrides it. */
export const FEATURE_ENV_VARS = {
  autonomousDelivery: 'AGENFK_FEATURE_AUTONOMOUS_DELIVERY',
  durableExecution: 'AGENFK_FEATURE_DURABLE_EXECUTION',
  localProcessRuntime: 'AGENFK_FEATURE_LOCAL_PROCESS_RUNTIME',
} as const satisfies Record<keyof FeatureFlags, string>;

/** The flag names, in a stable order. */
export const FEATURE_NAMES = Object.keys(FEATURE_ENV_VARS) as (keyof FeatureFlags)[];

/** Inputs to {@link resolveFeatureFlags}, already read by the caller. */
export interface FeatureFlagSources {
  /** Usually `process.env`. Absent keys are treated as unset. */
  env?: Record<string, string | undefined>;
  /** The `features` value parsed out of `~/.agenfk/config.json`, whatever shape it turned out to be. */
  config?: unknown;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off', '']);

/**
 * Parse an environment value into an explicit intent.
 *
 * Returns `undefined` for a value we do not recognise, so that a typo such as
 * `AGENFK_FEATURE_DURABLE_EXECUTION=maybe` falls through to the configuration
 * file rather than silently overriding a deliberate setting there.
 */
function parseEnvFlag(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  return undefined;
}

/**
 * Read one flag out of the `features` object.
 *
 * Both shapes are accepted, because both are things a human plausibly writes by
 * hand in `config.json`:
 *
 * ```json
 * { "features": { "autonomousDelivery": { "enabled": true } } }
 * { "features": { "autonomousDelivery": true } }
 * ```
 *
 * Anything else — a string, a number, a nested object without `enabled` — is
 * not an expressed intent and yields `undefined`.
 */
function parseConfigFlag(config: unknown, name: keyof FeatureFlags): boolean | undefined {
  if (typeof config !== 'object' || config === null) return undefined;
  const entry = (config as Record<string, unknown>)[name];
  if (typeof entry === 'boolean') return entry;
  if (typeof entry === 'object' && entry !== null) {
    const enabled = (entry as Record<string, unknown>).enabled;
    if (typeof enabled === 'boolean') return enabled;
  }
  return undefined;
}

/** The all-off baseline. A fresh object every call, so callers cannot mutate a shared default. */
export function defaultFeatureFlags(): FeatureFlags {
  return {
    autonomousDelivery: { enabled: false },
    durableExecution: { enabled: false },
    localProcessRuntime: { enabled: false },
  };
}

/**
 * Resolve the effective flags.
 *
 * Precedence is **environment → configuration file → `false`**. An explicit
 * falsy environment value overrides an enabled configuration file, so a flag
 * can always be turned off from the outside without editing a file.
 */
export function resolveFeatureFlags(sources: FeatureFlagSources = {}): FeatureFlags {
  const { env = {}, config } = sources;
  const flags = defaultFeatureFlags();
  for (const name of FEATURE_NAMES) {
    const fromEnv = parseEnvFlag(env[FEATURE_ENV_VARS[name]]);
    if (fromEnv !== undefined) {
      flags[name].enabled = fromEnv;
      continue;
    }
    const fromConfig = parseConfigFlag(config, name);
    if (fromConfig !== undefined) flags[name].enabled = fromConfig;
  }
  return flags;
}

/** True when no Autonomous Delivery behaviour is switched on. The default state. */
export function allFeaturesDisabled(flags: FeatureFlags): boolean {
  return FEATURE_NAMES.every((n) => !flags[n].enabled);
}
