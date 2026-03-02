import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import { createHealthRouter } from '../routes/health.js';

type RouteMethod = 'get' | 'post';

function getRouteHandler(router: Router, method: RouteMethod, path: string) {
  const layer = (router as unknown as { stack: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle: (...args: any[]) => any }> } }> }).stack.find(
    (candidate) => candidate.route?.path === path && candidate.route?.methods?.[method]
  );

  if (!layer?.route?.stack?.[0]) {
    throw new Error(`Unable to find route handler for ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[0].handle as (req: unknown, res: { json: (payload: unknown) => void }, next: (error?: unknown) => void) => void;
}

function createMockResponse() {
  return {
    body: undefined as unknown,
    json(payload: unknown) {
      this.body = payload;
    }
  };
}

describe('server health route', () => {
  it('returns ok status', async () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_SATELLITES: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      ENABLE_LAYER_EARTHQUAKES: 'true'
    });
    const router = createHealthRouter(config);
    const handler = getRouteHandler(router, 'get', '/health');
    const response = createMockResponse();

    handler({}, response, () => {});

    expect((response.body as { status: string }).status).toBe('ok');
    expect((response.body as { service: string }).service).toBe('earthly-server');
    expect((response.body as { mode: string }).mode).toBe('demo');
    expect((response.body as { layers: { flights: { enabled: boolean; notice: string } } }).layers.flights.enabled).toBe(false);
    expect((response.body as { layers: { flights: { enabled: boolean; notice: string } } }).layers.flights.notice).toMatch(
      /Disabled in demo mode/i
    );
  });
});
