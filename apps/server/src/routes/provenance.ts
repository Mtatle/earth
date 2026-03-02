import { Router } from 'express';
import type { RuntimeConfig } from '../config/env.js';
import {
  createProvenanceService,
  type LayerProvenanceRecord,
  type SourceHealthSnapshot
} from '../services/provenance.js';

export interface ProvenanceRouterOptions {
  now?: () => Date;
  getHealthSnapshots?: () => Partial<
    Record<LayerProvenanceRecord['key'], SourceHealthSnapshot>
  >;
}

export function createProvenanceRouter(
  config: RuntimeConfig,
  options: ProvenanceRouterOptions = {}
) {
  const router = Router();
  const service = createProvenanceService({
    config,
    now: options.now,
    getHealthSnapshots: options.getHealthSnapshots
  });

  router.get('/provenance', (_req, res) => {
    res.json({
      status: 'ok',
      ...service.getSnapshot()
    });
  });

  return router;
}
