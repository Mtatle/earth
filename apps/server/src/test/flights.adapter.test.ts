import { earthEntitySchema } from '@earthly/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import {
  buildOpenSkyAuthorizationHeader,
  createOpenSkyFlightsAdapter,
  normalizeOpenSkyStates
} from '../adapters/flights/opensky.js';

function readHeader(headers: unknown, key: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  if (Array.isArray(headers)) {
    for (const entry of headers) {
      if (!Array.isArray(entry)) {
        continue;
      }
      const [header, value] = entry;
      if (typeof header !== 'string' || typeof value !== 'string') {
        continue;
      }
      if (header.toLowerCase() === key.toLowerCase()) {
        return value;
      }
    }
    return null;
  }

  const record = headers as Record<string, string | readonly string[]>;
  const matchingKey = Object.keys(record).find((header) => header.toLowerCase() === key.toLowerCase());
  if (!matchingKey) {
    return null;
  }

  const value = record[matchingKey];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return null;
}

describe('OpenSky flights adapter', () => {
  it('normalizes valid state vectors into EarthEntity flight payloads', () => {
    const now = new Date('2026-03-02T12:00:00.000Z');
    const payload = {
      time: 1_772_421_190,
      states: [
        [
          'a1b2c3',
          'EARTH12 ',
          'United States',
          1_772_421_180,
          1_772_421_185,
          -122.389977,
          37.615223,
          9800,
          false,
          210,
          270,
          -3,
          null,
          10_200,
          '1200',
          false,
          0
        ]
      ]
    };

    const result = normalizeOpenSkyStates(payload, now);

    expect(result.dropped).toBe(0);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.entity_id).toBe('flight-a1b2c3');
    expect(result.entities[0]?.entity_type).toBe('flight');
    expect(result.entities[0]?.position).toMatchObject({
      lat: 37.615223,
      lon: -122.389977,
      alt: 10_200
    });
    expect(result.entities[0]?.velocity).toMatchObject({
      heading_deg: 270,
      speed_mps: 210,
      vertical_rate_mps: -3
    });

    const parsedEntity = earthEntitySchema.safeParse(result.entities[0]);
    expect(parsedEntity.success).toBe(true);
  });

  it('drops malformed OpenSky rows without coordinates', () => {
    const payload = {
      time: 1_772_421_190,
      states: [['abc123', 'NOCOORD', 'US', 1_772_421_180, 1_772_421_185, null, null]]
    };

    const result = normalizeOpenSkyStates(payload, new Date('2026-03-02T12:00:00.000Z'));

    expect(result.entities).toHaveLength(0);
    expect(result.dropped).toBe(1);
  });

  it('builds basic auth header for OpenSky requests', () => {
    const header = buildOpenSkyAuthorizationHeader({
      username: 'pilot',
      password: 'secret'
    });

    expect(header).toBe('Basic cGlsb3Q6c2VjcmV0');
  });

  it('respects demo-mode self-disable and does not call the network', async () => {
    const runtime = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_FLIGHTS: 'true'
    });

    const fetchMock = vi.fn<typeof fetch>();

    const adapter = createOpenSkyFlightsAdapter({
      layer: runtime.layers.flights,
      fetchImpl: fetchMock
    });

    const result = await adapter.poll();

    expect(result.status).toBe('disabled');
    if (result.status === 'disabled') {
      expect(result.reason).toMatch(/demo mode/i);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls OpenSky and returns normalized entities when enabled with credentials', async () => {
    const runtime = loadRuntimeConfig({
      NODE_ENV: 'test',
      STRICT_ADAPTER_KEYS: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      OPENSKY_USERNAME: 'pilot',
      OPENSKY_PASSWORD: 'secret'
    });

    const responsePayload = {
      time: 1_772_421_190,
      states: [
        [
          'f00baa',
          'EARTH34',
          'Canada',
          1_772_421_180,
          1_772_421_185,
          -73.5673,
          45.5017,
          11_100,
          false,
          190,
          15,
          1,
          null,
          11_300,
          null,
          false,
          0
        ]
      ]
    };

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    const adapter = createOpenSkyFlightsAdapter({
      layer: runtime.layers.flights,
      credentials: {
        username: 'pilot',
        password: 'secret'
      },
      fetchImpl: fetchMock,
      now: () => new Date('2026-03-02T12:00:00.000Z')
    });

    const result = await adapter.poll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const authorization = readHeader(requestInit?.headers, 'authorization');
    expect(authorization).toBe('Basic cGlsb3Q6c2VjcmV0');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]?.entity_id).toBe('flight-f00baa');
      expect(result.dropped).toBe(0);
      expect(result.fetched_at).toBe('2026-03-02T12:00:00.000Z');
    }
  });
});
