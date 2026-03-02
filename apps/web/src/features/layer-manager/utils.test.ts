import { describe, expect, it } from 'vitest';
import { LAYERS } from './constants';
import type { LayerCounts, LayerToggles } from './types';
import {
  applyLayerCounts,
  buildLayerView,
  computeLayerStatus,
  formatUpdatedAt,
  parsePayload,
  resolveStreamUrl,
  shouldMarkStreamStale,
  summarizeLayerView,
  withToggledLayer
} from './utils';

const BASE_COUNTS: LayerCounts = {
  satellites: 1,
  flights: 2,
  earthquakes: 3
};

const BASE_TOGGLES: LayerToggles = {
  satellites: true,
  flights: true,
  earthquakes: true
};

describe('layer-manager utils', () => {
  it('parses payload objects and rejects non-object JSON', () => {
    expect(parsePayload('{"timestamp":"2026-03-02T00:00:00.000Z"}')).toEqual({
      timestamp: '2026-03-02T00:00:00.000Z'
    });
    expect(parsePayload('[]')).toBeNull();
    expect(parsePayload('null')).toBeNull();
    expect(parsePayload('{')).toBeNull();
  });

  it('formats last-updated labels for never/unknown/recent/minute states', () => {
    const nowMs = Date.parse('2026-03-02T00:05:00.000Z');

    expect(formatUpdatedAt(null, nowMs)).toBe('never');
    expect(formatUpdatedAt('bad-date', nowMs)).toBe('unknown');
    expect(formatUpdatedAt('2026-03-02T00:04:58.000Z', nowMs)).toBe('just now');
    expect(formatUpdatedAt('2026-03-02T00:04:40.000Z', nowMs)).toBe('20s ago');
    expect(formatUpdatedAt('2026-03-02T00:02:30.000Z', nowMs)).toBe('2m ago');
  });

  it('maps layer status from stream and toggle state', () => {
    expect(computeLayerStatus(false, 'live')).toBe('off');
    expect(computeLayerStatus(true, 'error')).toBe('error');
    expect(computeLayerStatus(true, 'connecting')).toBe('stale');
    expect(computeLayerStatus(true, 'stale')).toBe('stale');
    expect(computeLayerStatus(true, 'live')).toBe('live');
  });

  it('resolves stream URL with default fallback and trimmed base URL', () => {
    expect(resolveStreamUrl(undefined)).toBe('http://localhost:4000/api/stream');
    expect(resolveStreamUrl(' https://api.earthly.local/ ')).toBe('https://api.earthly.local/api/stream');
  });

  it('applies valid per-layer counts and ignores invalid updates', () => {
    const updated = applyLayerCounts(BASE_COUNTS, {
      satellites: { count: 12 },
      flights: { count: Number.NaN },
      earthquakes: { count: -1 }
    });

    expect(updated.changed).toBe(true);
    expect(updated.counts).toEqual({
      satellites: 12,
      flights: 2,
      earthquakes: 3
    });

    const unchanged = applyLayerCounts(BASE_COUNTS, {
      satellites: { count: Number.POSITIVE_INFINITY },
      flights: {},
      earthquakes: { count: -4 }
    });

    expect(unchanged.changed).toBe(false);
    expect(unchanged.counts).toBe(BASE_COUNTS);
  });

  it('builds view rows and summary counts from toggle/count state', () => {
    const toggles: LayerToggles = {
      ...BASE_TOGGLES,
      flights: false
    };

    const layerView = buildLayerView(LAYERS, toggles, BASE_COUNTS, 'live');
    expect(layerView).toEqual([
      {
        id: 'satellites',
        label: 'Satellites',
        source: 'CelesTrak/NORAD (planned adapter)',
        enabled: true,
        status: 'live',
        count: 1
      },
      {
        id: 'flights',
        label: 'Flights',
        source: 'OpenSky (planned adapter)',
        enabled: false,
        status: 'off',
        count: 0
      },
      {
        id: 'earthquakes',
        label: 'Earthquakes',
        source: 'USGS (planned adapter)',
        enabled: true,
        status: 'live',
        count: 3
      }
    ]);

    expect(summarizeLayerView(layerView)).toEqual({
      activeLayerCount: 2,
      visibleEntityCount: 4
    });
  });

  it('marks stale only when heartbeat age exceeds threshold', () => {
    const nowMs = Date.parse('2026-03-02T00:00:30.000Z');

    expect(shouldMarkStreamStale(null, nowMs, 25_000)).toBe(false);
    expect(shouldMarkStreamStale('bad-date', nowMs, 25_000)).toBe(false);
    expect(shouldMarkStreamStale('2026-03-02T00:00:10.000Z', nowMs, 25_000)).toBe(false);
    expect(shouldMarkStreamStale('2026-03-02T00:00:00.000Z', nowMs, 25_000)).toBe(true);
  });

  it('toggles only the requested layer ID', () => {
    expect(withToggledLayer(BASE_TOGGLES, 'flights')).toEqual({
      satellites: true,
      flights: false,
      earthquakes: true
    });
  });
});
