import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_USGS_EARTHQUAKE_FEED_URL,
  fetchUsgsEarthquakeSnapshot,
  normalizeUsgsEarthquakeFeature
} from './usgs.js';

describe('usgs earthquakes adapter', () => {
  it('normalizes magnitude/depth metadata into quake entities', () => {
    const entity = normalizeUsgsEarthquakeFeature(
      {
        id: 'us7000abcd',
        geometry: {
          coordinates: [-122.334, 47.606, 17.4]
        },
        properties: {
          mag: 4.9,
          place: '11 km W of Seattle, Washington',
          time: 1_708_000_000_000,
          updated: 1_708_000_300_000,
          type: 'earthquake',
          status: 'reviewed',
          tsunami: 0,
          sig: 341,
          felt: 12,
          alert: 'green',
          title: 'M 4.9 - 11 km W of Seattle, Washington',
          url: 'https://earthquake.usgs.gov/example-event',
          detail: 'https://earthquake.usgs.gov/example-event.geojson',
          net: 'us',
          code: '7000abcd'
        }
      },
      '2026-03-02T00:00:00.000Z'
    );

    expect(entity).not.toBeNull();
    expect(entity?.entity_id).toBe('usgs:us7000abcd');
    expect(entity?.entity_type).toBe('quake');
    expect(entity?.position).toEqual({
      lat: 47.606,
      lon: -122.334,
      alt: -17_400
    });
    expect(entity?.observed_at).toBe(new Date(1_708_000_000_000).toISOString());
    expect(entity?.updated_at).toBe(new Date(1_708_000_300_000).toISOString());
    expect(entity?.metadata).toMatchObject({
      magnitude: 4.9,
      depth_km: 17.4,
      place: '11 km W of Seattle, Washington',
      significance: 341,
      tsunami: false
    });
  });

  it('falls back to fetched timestamp when event time metadata is unavailable', () => {
    const fetchedAt = '2026-03-02T18:00:00.000Z';
    const entity = normalizeUsgsEarthquakeFeature(
      {
        id: 'us7000missing-time',
        geometry: {
          coordinates: [140.5, 35.6]
        },
        properties: {
          mag: 2.1,
          place: 'Near East Coast of Honshu, Japan',
          time: null,
          updated: null
        }
      },
      fetchedAt
    );

    expect(entity).not.toBeNull();
    expect(entity?.observed_at).toBe(fetchedAt);
    expect(entity?.updated_at).toBe(fetchedAt);
    expect(entity?.position).toEqual({
      lat: 35.6,
      lon: 140.5
    });
    expect(entity?.metadata).toMatchObject({
      magnitude: 2.1,
      depth_km: null
    });
  });

  it('returns null for invalid feature geometry or coordinates', () => {
    const fetchedAt = '2026-03-02T18:00:00.000Z';

    expect(
      normalizeUsgsEarthquakeFeature(
        {
          id: 'missing-geometry'
        },
        fetchedAt
      )
    ).toBeNull();

    expect(
      normalizeUsgsEarthquakeFeature(
        {
          id: 'invalid-latitude',
          geometry: {
            coordinates: [10, 91, 5]
          }
        },
        fetchedAt
      )
    ).toBeNull();
  });

  it('fetches and normalizes USGS feed while dropping invalid features', async () => {
    const generated = Date.UTC(2026, 2, 2, 18, 10, 0);
    const payload = {
      metadata: {
        generated
      },
      features: [
        {
          id: 'us7000valid',
          geometry: {
            coordinates: [-150.1, 61.2, 35]
          },
          properties: {
            mag: 3.8,
            place: 'Alaska',
            time: 1_709_000_000_000,
            updated: 1_709_000_010_000
          }
        },
        {
          id: 'us7000invalid',
          geometry: {
            coordinates: [200, 45, 3]
          },
          properties: {
            mag: 1.2
          }
        }
      ]
    };

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(createResponse(payload));
    const snapshot = await fetchUsgsEarthquakeSnapshot({
      feedUrl: 'https://example.test/earthquakes.geojson',
      fetchImpl: mockFetch,
      now: () => new Date('2026-03-02T18:12:00.000Z')
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://example.test/earthquakes.geojson', {
      headers: {
        accept: 'application/geo+json, application/json'
      }
    });

    expect(snapshot.source).toMatch(/USGS/i);
    expect(snapshot.feed_url).toBe('https://example.test/earthquakes.geojson');
    expect(snapshot.generated_at).toBe('2026-03-02T18:10:00.000Z');
    expect(snapshot.fetched_at).toBe('2026-03-02T18:12:00.000Z');
    expect(snapshot.total_features).toBe(2);
    expect(snapshot.dropped_features).toBe(1);
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0]?.metadata).toMatchObject({
      magnitude: 3.8,
      depth_km: 35
    });
  });

  it('uses the default feed url when none is provided', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({
        features: []
      })
    );

    await fetchUsgsEarthquakeSnapshot({
      fetchImpl: mockFetch
    });

    expect(mockFetch).toHaveBeenCalledWith(DEFAULT_USGS_EARTHQUAKE_FEED_URL, {
      headers: {
        accept: 'application/geo+json, application/json'
      }
    });
  });

  it('throws on non-ok responses', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({}, { ok: false, status: 503, statusText: 'Service Unavailable' })
    );

    await expect(
      fetchUsgsEarthquakeSnapshot({
        fetchImpl: mockFetch
      })
    ).rejects.toThrow(/USGS request failed/i);
  });

  it('throws when payload is malformed', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(createResponse({ features: 'not-an-array' }));

    await expect(
      fetchUsgsEarthquakeSnapshot({
        fetchImpl: mockFetch
      })
    ).rejects.toThrow(/payload failed validation/i);
  });

  it('throws when request fails before response', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));

    await expect(
      fetchUsgsEarthquakeSnapshot({
        fetchImpl: mockFetch
      })
    ).rejects.toThrow(/before response/i);
  });
});

function createResponse(
  payload: unknown,
  init: {
    ok?: boolean;
    status?: number;
    statusText?: string;
  } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => payload
  } as Response;
}
