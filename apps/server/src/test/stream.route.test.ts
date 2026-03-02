import { streamProtocolVersion } from '@earthly/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createStreamRouter, type StreamLogger } from '../routes/stream.js';

describe('stream publish route', () => {
  it('rejects malformed payloads and logs validation issues', async () => {
    const logger: StreamLogger = {
      info: vi.fn(),
      warn: vi.fn()
    };

    const app = express();
    app.use(express.json());
    app.use('/api', createStreamRouter({ logger }));

    const response = await request(app).post('/api/stream/publish').send({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: 'not-a-date',
      entities: []
    });

    expect(response.status).toBe(400);
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

    const app = express();
    app.use(express.json());
    app.use('/api', createStreamRouter({ logger }));

    const now = new Date().toISOString();
    const response = await request(app).post('/api/stream/publish').send({
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
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      status: 'accepted',
      event_type: 'entity_upsert',
      delivered_to: 0
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
