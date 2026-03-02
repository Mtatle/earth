import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import {
  createProvenanceService,
  resolveSourceDescriptor,
  type SourceHealthSnapshot
} from '../services/provenance.js';

describe('provenance service', () => {
  it('returns source metadata and default health states for each layer', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_SATELLITES: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      ENABLE_LAYER_EARTHQUAKES: 'true',
      OPENSKY_USERNAME: 'demo-user',
      OPENSKY_PASSWORD: 'demo-pass'
    });

    const service = createProvenanceService({
      config,
      now: () => new Date('2026-03-03T00:00:00.000Z')
    });

    const snapshot = service.getSnapshot();

    expect(snapshot.generated_at).toBe('2026-03-03T00:00:00.000Z');
    expect(snapshot.layers).toHaveLength(3);

    const satellites = snapshot.layers.find((layer) => layer.key === 'satellites');
    const flights = snapshot.layers.find((layer) => layer.key === 'flights');
    const earthquakes = snapshot.layers.find((layer) => layer.key === 'earthquakes');

    expect(satellites).toMatchObject({
      source_name: 'CelesTrak / NORAD public catalogs',
      source_url: 'https://celestrak.org/',
      health: 'unknown',
      refresh_interval_ms: 20000
    });
    expect(flights).toMatchObject({
      source_name: 'OpenSky Network',
      source_url: 'https://opensky-network.org/',
      health: 'unknown',
      refresh_interval_ms: 15000
    });
    expect(earthquakes).toMatchObject({
      source_name: 'USGS Earthquake Hazards Program',
      source_url: 'https://earthquake.usgs.gov/',
      health: 'unknown',
      refresh_interval_ms: 45000
    });
  });

  it('resolves live, stale, error, and off health states', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_SATELLITES: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      ENABLE_LAYER_EARTHQUAKES: 'false',
      OPENSKY_USERNAME: 'demo-user',
      OPENSKY_PASSWORD: 'demo-pass'
    });

    const snapshots: Partial<Record<'satellites' | 'flights' | 'earthquakes', SourceHealthSnapshot>> = {
      satellites: {
        status: 'live',
        lastSuccessAt: '2026-03-03T00:00:10.000Z'
      },
      flights: {
        status: 'live',
        lastSuccessAt: '2026-03-02T23:57:00.000Z'
      },
      earthquakes: {
        status: 'error',
        lastErrorAt: '2026-03-02T23:59:50.000Z',
        lastErrorMessage: 'USGS timeout'
      }
    };

    const service = createProvenanceService({
      config,
      now: () => new Date('2026-03-03T00:00:20.000Z'),
      getHealthSnapshots: () => snapshots
    });

    const snapshot = service.getSnapshot();
    const satellites = snapshot.layers.find((layer) => layer.key === 'satellites');
    const flights = snapshot.layers.find((layer) => layer.key === 'flights');
    const earthquakes = snapshot.layers.find((layer) => layer.key === 'earthquakes');

    expect(satellites?.health).toBe('live');
    expect(satellites?.last_success_at).toBe('2026-03-03T00:00:10.000Z');

    expect(flights?.health).toBe('stale');
    expect(flights?.last_success_at).toBe('2026-03-02T23:57:00.000Z');

    expect(earthquakes?.health).toBe('off');
    expect(earthquakes?.last_error_message).toBe('USGS timeout');
  });

  it('selects ADSB Exchange descriptor when flights source indicates ADSB', () => {
    const descriptor = resolveSourceDescriptor('flights', 'ADSB Exchange API');
    expect(descriptor).toEqual({
      sourceUrl: 'https://www.adsbexchange.com/data/',
      termsUrl: 'https://www.adsbexchange.com/data/'
    });
  });
});
