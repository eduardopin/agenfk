import { describe, it, expect } from 'vitest';
import {
  resolveFeatureFlags,
  defaultFeatureFlags,
  allFeaturesDisabled,
  FEATURE_ENV_VARS,
  FEATURE_NAMES,
  type FeatureFlags,
} from '../features.js';

describe('feature flag defaults', () => {
  it('is off for every flag with no sources at all', () => {
    const flags = resolveFeatureFlags();
    expect(flags).toEqual({
      autonomousDelivery: { enabled: false },
      durableExecution: { enabled: false },
      localProcessRuntime: { enabled: false },
    });
    expect(allFeaturesDisabled(flags)).toBe(true);
  });

  it('is off for every flag with empty sources', () => {
    expect(resolveFeatureFlags({ env: {}, config: {} })).toEqual(defaultFeatureFlags());
  });

  it('exposes exactly the three flags the AD0 card specifies', () => {
    expect(FEATURE_NAMES).toEqual([
      'autonomousDelivery',
      'durableExecution',
      'localProcessRuntime',
    ]);
  });

  it('hands out a fresh object each call so a caller cannot poison the default', () => {
    const a = defaultFeatureFlags();
    a.autonomousDelivery.enabled = true;
    expect(defaultFeatureFlags().autonomousDelivery.enabled).toBe(false);
    expect(resolveFeatureFlags().autonomousDelivery.enabled).toBe(false);
  });
});

describe('environment parsing', () => {
  const truthy = ['1', 'true', 'TRUE', 'True', 'yes', 'YES', 'on', 'ON', ' true '];
  const falsy = ['0', 'false', 'FALSE', 'no', 'off', '', '  '];
  const ignored = ['maybe', 'enabled', '2', 'null', 'undefined'];

  for (const raw of truthy) {
    it(`treats ${JSON.stringify(raw)} as enabled`, () => {
      const flags = resolveFeatureFlags({
        env: { [FEATURE_ENV_VARS.autonomousDelivery]: raw },
      });
      expect(flags.autonomousDelivery.enabled).toBe(true);
    });
  }

  for (const raw of falsy) {
    it(`treats ${JSON.stringify(raw)} as disabled even when the config file enables it`, () => {
      const flags = resolveFeatureFlags({
        env: { [FEATURE_ENV_VARS.autonomousDelivery]: raw },
        config: { autonomousDelivery: { enabled: true } },
      });
      expect(flags.autonomousDelivery.enabled).toBe(false);
    });
  }

  for (const raw of ignored) {
    it(`ignores the unrecognised value ${JSON.stringify(raw)} and falls through to the config file`, () => {
      const flags = resolveFeatureFlags({
        env: { [FEATURE_ENV_VARS.autonomousDelivery]: raw },
        config: { autonomousDelivery: { enabled: true } },
      });
      expect(flags.autonomousDelivery.enabled).toBe(true);
    });

    // The test above cannot fail if an unrecognised value wrongly resolved to
    // `true`: both paths give the same answer. These two pin the value down —
    // an unrecognised env value must be *ignored*, not treated as enabled.
    it(`does not treat the unrecognised value ${JSON.stringify(raw)} as enabled when the config disables it`, () => {
      const flags = resolveFeatureFlags({
        env: { [FEATURE_ENV_VARS.autonomousDelivery]: raw },
        config: { autonomousDelivery: { enabled: false } },
      });
      expect(flags.autonomousDelivery.enabled).toBe(false);
    });

    it(`does not treat the unrecognised value ${JSON.stringify(raw)} as enabled with no config at all`, () => {
      const flags = resolveFeatureFlags({
        env: { [FEATURE_ENV_VARS.autonomousDelivery]: raw },
      });
      expect(flags.autonomousDelivery.enabled).toBe(false);
    });
  }

  it('leaves a flag off when its variable is unset but a sibling is set', () => {
    const flags = resolveFeatureFlags({
      env: { [FEATURE_ENV_VARS.durableExecution]: '1' },
    });
    expect(flags.durableExecution.enabled).toBe(true);
    expect(flags.autonomousDelivery.enabled).toBe(false);
    expect(flags.localProcessRuntime.enabled).toBe(false);
  });

  it('maps each flag to its own variable with no crosstalk', () => {
    for (const name of FEATURE_NAMES) {
      const flags = resolveFeatureFlags({ env: { [FEATURE_ENV_VARS[name]]: '1' } });
      for (const other of FEATURE_NAMES) {
        expect(flags[other].enabled).toBe(other === name);
      }
    }
  });
});

describe('config file parsing', () => {
  it('accepts the nested { enabled } shape', () => {
    const flags = resolveFeatureFlags({ config: { durableExecution: { enabled: true } } });
    expect(flags.durableExecution.enabled).toBe(true);
  });

  it('accepts the flat boolean shape a human is likely to hand-write', () => {
    const flags = resolveFeatureFlags({ config: { durableExecution: true } });
    expect(flags.durableExecution.enabled).toBe(true);
  });

  it('reads an explicit false from the config file', () => {
    const flags = resolveFeatureFlags({ config: { durableExecution: { enabled: false } } });
    expect(flags.durableExecution.enabled).toBe(false);
  });

  const junk: unknown[] = [
    null,
    undefined,
    'autonomousDelivery',
    42,
    [],
    { autonomousDelivery: 'yes' },
    { autonomousDelivery: 1 },
    { autonomousDelivery: {} },
    { autonomousDelivery: { enabled: 'true' } },
    { autonomousDelivery: { Enabled: true } },
  ];

  for (const config of junk) {
    it(`stays off for the unusable config ${JSON.stringify(config) ?? 'undefined'}`, () => {
      expect(resolveFeatureFlags({ config })).toEqual(defaultFeatureFlags());
    });
  }

  it('ignores unknown keys rather than failing', () => {
    const flags = resolveFeatureFlags({
      config: { somethingElse: { enabled: true }, autonomousDelivery: { enabled: true } },
    });
    expect(flags.autonomousDelivery.enabled).toBe(true);
    expect(Object.keys(flags).sort()).toEqual([...FEATURE_NAMES].sort());
  });
});

describe('precedence', () => {
  const cases: {
    name: string;
    env: Record<string, string | undefined>;
    config: unknown;
    expected: boolean;
  }[] = [
    { name: 'env on beats config off', env: { [FEATURE_ENV_VARS.autonomousDelivery]: '1' }, config: { autonomousDelivery: { enabled: false } }, expected: true },
    { name: 'env off beats config on', env: { [FEATURE_ENV_VARS.autonomousDelivery]: '0' }, config: { autonomousDelivery: { enabled: true } }, expected: false },
    { name: 'config on applies when env is unset', env: {}, config: { autonomousDelivery: { enabled: true } }, expected: true },
    { name: 'default off applies when neither is set', env: {}, config: {}, expected: false },
    { name: 'an undefined env value is not an override', env: { [FEATURE_ENV_VARS.autonomousDelivery]: undefined }, config: { autonomousDelivery: true }, expected: true },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(resolveFeatureFlags({ env: c.env, config: c.config }).autonomousDelivery.enabled)
        .toBe(c.expected);
    });
  }
});

describe('allFeaturesDisabled', () => {
  it('is false as soon as any single flag is on', () => {
    for (const name of FEATURE_NAMES) {
      const flags: FeatureFlags = defaultFeatureFlags();
      flags[name].enabled = true;
      expect(allFeaturesDisabled(flags)).toBe(false);
    }
  });
});
