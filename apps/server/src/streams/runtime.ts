import { streamProtocolVersion, type EarthEntity, type StreamEvent } from '@earthly/shared';
import { fetchUsgsEarthquakeSnapshot } from '../adapters/earthquakes/index.js';
import { createOpenSkyFlightsAdapter } from '../adapters/flights/index.js';
import { startSatellitePollingJob } from '../adapters/satellites/index.js';
import type { LayerKey, RuntimeConfig } from '../config/env.js';

const SATELLITES_POLL_INTERVAL_MS = 20_000;
const FLIGHTS_POLL_INTERVAL_MS = 15_000;
const EARTHQUAKES_POLL_INTERVAL_MS = 45_000;
const SATELLITES_MAX_ENTITIES_PER_BATCH = 250;
const FLIGHTS_MAX_ENTITIES_PER_BATCH = 300;
const EARTHQUAKES_MAX_ENTITIES_PER_BATCH = 200;

type HeartbeatStatus = 'ok' | 'degraded';

export interface StreamRuntimeLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface StreamRuntimeOptions {
  config: RuntimeConfig;
  logger: StreamRuntimeLogger;
  broadcast: (event: StreamEvent) => number;
  now?: () => Date;
}

export interface StreamRuntimeController {
  start(): void;
  stop(): void;
  heartbeatStatus(): HeartbeatStatus;
}

export function createStreamRuntime(options: StreamRuntimeOptions): StreamRuntimeController {
  const now = options.now ?? (() => new Date());
  const stopHandlers: Array<() => void> = [];
  const degradedLayers = new Set<LayerKey>();
  let started = false;

  const publishEntities = (layer: LayerKey, entities: EarthEntity[], source: string) => {
    if (entities.length === 0) {
      degradedLayers.delete(layer);
      return;
    }

    degradedLayers.delete(layer);

    const deliveredTo = options.broadcast({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: now().toISOString(),
      entities
    });

    options.logger.info('Published adapter batch', {
      layer,
      source,
      entities: entities.length,
      delivered_to: deliveredTo
    });
  };

  const publishAdapterError = (layer: LayerKey, source: string, error: unknown) => {
    degradedLayers.add(layer);

    const message = error instanceof Error ? error.message : String(error);
    options.broadcast({
      event_type: 'error',
      protocol_version: streamProtocolVersion,
      sent_at: now().toISOString(),
      code: 'adapter_poll_failed',
      message,
      source,
      recoverable: true
    });

    options.logger.warn('Adapter poll failed', {
      layer,
      source,
      message
    });
  };

  const startFlightsPolling = () => {
    if (!options.config.layers.flights.enabled) {
      return;
    }

    const adapter = createOpenSkyFlightsAdapter({
      layer: options.config.layers.flights,
      credentials: options.config.credentials.opensky ?? undefined,
      now
    });

    const tick = async () => {
      try {
        const result = await adapter.poll();
        if (result.status === 'ok') {
          publishEntities('flights', result.entities.slice(0, FLIGHTS_MAX_ENTITIES_PER_BATCH), result.source);
        } else {
          options.logger.info('Flights adapter disabled', { reason: result.reason });
          degradedLayers.delete('flights');
        }
      } catch (error) {
        publishAdapterError('flights', options.config.layers.flights.source, error);
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, FLIGHTS_POLL_INTERVAL_MS);

    stopHandlers.push(() => clearInterval(timer));
  };

  const startSatellitesPolling = () => {
    if (!options.config.layers.satellites.enabled) {
      return;
    }

    const stop = startSatellitePollingJob({
      intervalMs: SATELLITES_POLL_INTERVAL_MS,
      maxEntities: SATELLITES_MAX_ENTITIES_PER_BATCH,
      source: options.config.layers.satellites.source,
      onBatch: (entities) => {
        publishEntities('satellites', entities, options.config.layers.satellites.source);
      },
      onError: (error) => {
        publishAdapterError('satellites', options.config.layers.satellites.source, error);
      }
    });

    stopHandlers.push(stop);
  };

  const startEarthquakesPolling = () => {
    if (!options.config.layers.earthquakes.enabled) {
      return;
    }

    const tick = async () => {
      try {
        const snapshot = await fetchUsgsEarthquakeSnapshot({ now });
        publishEntities(
          'earthquakes',
          snapshot.entities.slice(0, EARTHQUAKES_MAX_ENTITIES_PER_BATCH),
          snapshot.source
        );

        if (snapshot.dropped_features > 0) {
          options.logger.warn('Dropped malformed USGS features', {
            dropped_features: snapshot.dropped_features,
            total_features: snapshot.total_features
          });
        }
      } catch (error) {
        publishAdapterError('earthquakes', options.config.layers.earthquakes.source, error);
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, EARTHQUAKES_POLL_INTERVAL_MS);

    stopHandlers.push(() => clearInterval(timer));
  };

  return {
    start() {
      if (started) {
        return;
      }

      started = true;
      startSatellitesPolling();
      startFlightsPolling();
      startEarthquakesPolling();
    },
    stop() {
      if (!started) {
        return;
      }

      while (stopHandlers.length > 0) {
        const stop = stopHandlers.pop();
        stop?.();
      }

      started = false;
      degradedLayers.clear();
    },
    heartbeatStatus() {
      return degradedLayers.size > 0 ? 'degraded' : 'ok';
    }
  };
}
