import { describe, expect, it, vi } from 'vitest';
import {
  CELESTRAK_ACTIVE_CATALOG_URL,
  fetchSatelliteEntities,
  normalizeCelestrakCatalog,
  startSatellitePollingJob
} from './celestrak.js';

function createMockResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    json: async () => payload
  } as Response;
}

describe('celestrak satellite adapter', () => {
  it('normalizes valid records and rejects malformed rows', () => {
    const logger = {
      warn: vi.fn()
    };

    const receivedAt = new Date('2026-03-02T12:00:00.000Z');

    const entities = normalizeCelestrakCatalog(
      [
        {
          NORAD_CAT_ID: '25544',
          OBJECT_NAME: 'ISS (ZARYA)',
          OBJECT_ID: '1998-067A',
          EPOCH: '2026-03-02T11:59:30.000Z',
          LAT: '51.504',
          LON: '-0.127',
          ALT: '408.2',
          VELOCITY: '7.66',
          TLE_LINE1: '1 25544U 98067A   26062.49965278  .00006443  00000+0  12081-3 0  9996',
          TLE_LINE2: '2 25544  51.6414 162.4422 0001967 112.7800 326.0057 15.49944335434507'
        },
        {
          NORAD_CAT_ID: '10000',
          OBJECT_NAME: 'MISSING-POSITION'
        },
        {
          NORAD_CAT_ID: '10001',
          LAT: 120,
          LON: 100
        }
      ],
      { logger, receivedAt }
    );

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      entity_id: 'sat-25544',
      entity_type: 'satellite',
      source: 'CelesTrak / NORAD public catalogs',
      observed_at: '2026-03-02T11:59:30.000Z',
      updated_at: '2026-03-02T12:00:00.000Z',
      position: {
        lat: 51.504,
        lon: -0.127,
        alt: 408200
      },
      velocity: {
        speed_mps: 7660
      }
    });
    const firstEntity = entities[0];
    expect(firstEntity).toBeDefined();
    if (!firstEntity) {
      return;
    }

    expect(firstEntity.metadata).toMatchObject({
      object_name: 'ISS (ZARYA)',
      object_id: '1998-067A',
      norad_cat_id: '25544'
    });
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('fetches satellite entities from CelesTrak payload envelopes', async () => {
    const fetchImpl = vi.fn(async () =>
      createMockResponse({
        satellites: [
          {
            NORAD_CAT_ID: 25544,
            latitude: 10.5,
            longitude: -20.2,
            altitude_km: 408
          }
        ]
      })
    ) as unknown as typeof fetch;

    const entities = await fetchSatelliteEntities({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      CELESTRAK_ACTIVE_CATALOG_URL,
      expect.objectContaining({
        method: 'GET',
        headers: { accept: 'application/json' }
      })
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      entity_id: 'sat-25544',
      entity_type: 'satellite',
      position: {
        lat: 10.5,
        lon: -20.2,
        alt: 408000
      }
    });
  });

  it('throws when the remote request fails', async () => {
    const fetchImpl = vi.fn(async () => createMockResponse([], 503)) as unknown as typeof fetch;

    await expect(fetchSatelliteEntities({ fetchImpl })).rejects.toThrow(
      'CelesTrak request failed with 503 ERROR'
    );
  });

  it('polls on an interval and can be stopped', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async () =>
        createMockResponse([
          {
            NORAD_CAT_ID: '25544',
            LAT: 10,
            LON: 20
          }
        ])
      ) as unknown as typeof fetch;
      const onBatch = vi.fn();

      const stop = startSatellitePollingJob({
        intervalMs: 1000,
        fetchImpl,
        onBatch
      });

      await vi.advanceTimersByTimeAsync(2500);

      expect(onBatch).toHaveBeenCalledTimes(3);

      stop();
      await vi.advanceTimersByTimeAsync(2000);

      expect(onBatch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
