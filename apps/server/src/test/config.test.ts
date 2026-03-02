import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig, RuntimeConfigError } from '../config/env.js';

describe('runtime config', () => {
  it('boots in demo mode without flight credentials', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_FLIGHTS: 'true'
    });

    expect(config.strictAdapterKeys).toBe(false);
    expect(config.layers.flights.enabled).toBe(false);
    expect(config.layers.flights.notice).toMatch(/demo mode/i);
  });

  it('fails fast when strict mode requires missing flight credentials', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'test',
        STRICT_ADAPTER_KEYS: 'true',
        ENABLE_LAYER_FLIGHTS: 'true'
      })
    ).toThrow(RuntimeConfigError);
  });

  it('accepts strict mode when OpenSky credentials are complete', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      STRICT_ADAPTER_KEYS: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      OPENSKY_USERNAME: 'user',
      OPENSKY_PASSWORD: 'pass'
    });

    expect(config.layers.flights.enabled).toBe(true);
    expect(config.layers.flights.notice).toBeNull();
  });

  it('fails on partial OpenSky credentials', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'test',
        OPENSKY_USERNAME: 'user'
      })
    ).toThrow(/OPENSKY_USERNAME and OPENSKY_PASSWORD together/i);
  });
});
