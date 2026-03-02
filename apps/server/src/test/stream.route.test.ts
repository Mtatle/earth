import type { Router } from 'express';
import { streamProtocolVersion } from '@earthly/shared';
import { describe, expect, it, vi } from 'vitest';
import { createStreamRouter, type StreamLogger } from '../routes/stream.js';

type RouteMethod = 'get' | 'post';

function getRouteHandler(router: Router, method: RouteMethod, path: string) {
  const layer = (router as unknown as { stack: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle: (...args: any[]) => any }> } }> }).stack.find(
    (candidate) => candidate.route?.path === path && candidate.route?.methods?.[method]
  );

  if (!layer?.route?.stack?.[0]) {
    throw new Error(`Unable to find route handler for ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[0].handle as (
    req: { body: unknown },
    res: { status: (code: number) => { json: (payload: unknown) => void } },
    next: (error?: unknown) => void
  ) => void;
}

function createMockResponse() {
  const state = {
    statusCode: 200,
    body: undefined as unknown
  };

  return {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    status(code: number) {
      state.statusCode = code;
      return {
        json(payload: unknown) {
          state.body = payload;
        }
      };
    }
  };
}

describe('stream publish route', () => {
  it('rejects malformed payloads and logs validation issues', async () => {
    const logger: StreamLogger = {
      info: vi.fn(),
      warn: vi.fn()
    };

    const router = createStreamRouter({ logger });
    const handler = getRouteHandler(router, 'post', '/stream/publish');
    const response = createMockResponse();

    handler(
      {
        body: {
          event_type: 'entity_upsert',
          protocol_version: streamProtocolVersion,
          sent_at: 'not-a-date',
          entities: []
        }
      },
      response,
      () => {}
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      status: 'rejected',
      reason: 'malformed_stream_payload'
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('accepts a valid payload', async () => {
    const logger: StreamLogger = {
      info: vi.fn(),
      warn: vi.fn()
    };

    const router = createStreamRouter({ logger });
    const handler = getRouteHandler(router, 'post', '/stream/publish');
    const response = createMockResponse();

    const now = new Date().toISOString();

    handler(
      {
        body: {
          event_type: 'entity_upsert',
          protocol_version: streamProtocolVersion,
          sent_at: now,
          entities: [
            {
              entity_id: 'flight-abc',
              entity_type: 'flight',
              position: { lat: 30.2672, lon: -97.7431, alt: 10345 },
              source: 'OpenSky',
              observed_at: now,
              updated_at: now,
              metadata: { callsign: 'EARTH1' }
            }
          ]
        }
      },
      response,
      () => {}
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({
      status: 'accepted',
      event_type: 'entity_upsert',
      delivered_to: 0
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
