import { Router } from 'express';
import type { RuntimeConfig } from '../config/env.js';

export function createHealthRouter(config: RuntimeConfig) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'earthly-server',
      mode: config.strictAdapterKeys ? 'strict' : 'demo',
      layers: config.layers
    });
  });

  return router;
}
