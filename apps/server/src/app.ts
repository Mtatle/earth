import cors from 'cors';
import express from 'express';
import type { RuntimeConfig } from './config/env.js';
import { createHealthRouter } from './routes/health.js';
import { createStreamRouter } from './routes/stream.js';

export function createApp(config: RuntimeConfig) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api', createHealthRouter(config));
  app.use('/api', createStreamRouter({ runtimeConfig: config }));

  return app;
}
