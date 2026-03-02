import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import { createHealthRouter } from '../routes/health.js';

describe('server health route', () => {
  it('returns ok status', async () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
      ENABLE_LAYER_SATELLITES: 'true',
      ENABLE_LAYER_FLIGHTS: 'true',
      ENABLE_LAYER_EARTHQUAKES: 'true'
    });
    const app = express();
    app.use('/api', createHealthRouter(config));
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('earthly-server');
    expect(response.body.mode).toBe('demo');
    expect(response.body.layers.flights.enabled).toBe(false);
    expect(response.body.layers.flights.notice).toMatch(/Disabled in demo mode/i);
  });
});
