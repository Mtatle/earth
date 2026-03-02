import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import { createProvenanceRouter } from '../routes/provenance.js';

type RouteMethod = 'get' | 'post';

function getRouteHandler(router: Router, method: RouteMethod, path: string) {
  const layer = (
    router as unknown as {
      stack: Array<{
        route?: {
          path?: string;
          methods?: Record<string, boolean>;
          stack?: Array<{ handle: (...args: any[]) => any }>;
        };
      }>;
    }
  ).stack.find(
    (candidate) => candidate.route?.path === path && candidate.route?.methods?.[method]
  );

  if (!layer?.route?.stack?.[0]) {
    throw new Error(`Unable to find route handler for ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[0].handle as (
    req: unknown,
    res: { json: (payload: unknown) => void },
    next: (error?: unknown) => void
  ) => void;
}

function createMockResponse() {
  const state = {
    body: undefined as unknown
  };

  return {
    get body() {
      return state.body;
    },
    json(payload: unknown) {
      state.body = payload;
    }
  };
}

describe('provenance route', () => {
  it('returns source provenance and health snapshot payload', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_SATELLITES: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      ENABLE_LAYER_EARTHQUAKES: 'true',
      OPENSKY_USERNAME: 'demo-user',
      OPENSKY_PASSWORD: 'demo-pass'
    });

    const router = createProvenanceRouter(config, {
      now: () => new Date('2026-03-03T00:00:00.000Z'),
      getHealthSnapshots: () => ({
        satellites: {
          status: 'live',
          lastSuccessAt: '2026-03-02T23:59:55.000Z'
        },
        flights: {
          status: 'error',
          lastErrorAt: '2026-03-02T23:59:58.000Z',
          lastErrorMessage: 'OpenSky rate limit'
        }
      })
    });

    const handler = getRouteHandler(router, 'get', '/provenance');
    const response = createMockResponse();

    handler({}, response, () => {});

    expect(response.body).toMatchObject({
      status: 'ok',
      generated_at: '2026-03-03T00:00:00.000Z'
    });

    const layers = (response.body as { layers: Array<{ key: string; health: string }> }).layers;
    expect(Array.isArray(layers)).toBe(true);

    const satellites = layers.find((layer) => layer.key === 'satellites');
    const flights = layers.find((layer) => layer.key === 'flights');
    const earthquakes = layers.find((layer) => layer.key === 'earthquakes');

    expect(satellites?.health).toBe('live');
    expect(flights?.health).toBe('error');
    expect(earthquakes?.health).toBe('unknown');
  });
});
