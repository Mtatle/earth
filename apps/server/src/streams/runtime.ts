import { streamProtocolVersion, type EarthEntity, type StreamEvent } from '@earthly/shared';
import { fetchUsgsEarthquakeSnapshot, type UsgsEarthquakeSnapshot } from '../adapters/earthquakes/index.js';
import {
  createOpenSkyFlightsAdapter,
  type OpenSkyFlightsPollResult
} from '../adapters/flights/index.js';
import { fetchSatelliteEntities } from '../adapters/satellites/index.js';
import type { LayerKey, RuntimeConfig } from '../config/env.js';

const SATELLITES_POLL_INTERVAL_MS = 20_000;
const FLIGHTS_POLL_INTERVAL_MS = 15_000;
const EARTHQUAKES_POLL_INTERVAL_MS = 45_000;
const SATELLITES_MAX_ENTITIES_PER_BATCH = 250;
const FLIGHTS_MAX_ENTITIES_PER_BATCH = 300;
const EARTHQUAKES_MAX_ENTITIES_PER_BATCH = 200;
const MAX_RETRY_BACKOFF_MS = 120_000;

type HeartbeatStatus = 'ok' | 'degraded';
type TimeoutHandle = ReturnType<typeof setTimeout>;

export interface StreamRuntimeAdapterOverrides {
  pollFlights?: () => Promise<OpenSkyFlightsPollResult>;
  pollSatellites?: () => Promise<EarthEntity[]>;
  pollEarthquakes?: () => Promise<UsgsEarthquakeSnapshot>;
}

export interface StreamRuntimeTimingOverrides {
  satellitesPollIntervalMs?: number;
  flightsPollIntervalMs?: number;
  earthquakesPollIntervalMs?: number;
  maxRetryBackoffMs?: number;
}

export interface StreamRuntimeLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface StreamRuntimeOptions {
  config: RuntimeConfig;
  logger: StreamRuntimeLogger;
  broadcast: (event: StreamEvent) => number;
  now?: () => Date;
  adapters?: StreamRuntimeAdapterOverrides;
  timing?: StreamRuntimeTimingOverrides;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface StreamRuntimeController {
  start(): void;
  stop(): void;
  heartbeatStatus(): HeartbeatStatus;
}

export function createStreamRuntime(options: StreamRuntimeOptions): StreamRuntimeController {
  const now = options.now ?? (() => new Date());
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const degradedLayers = new Set<LayerKey>();
  const activeTimers = new Set<TimeoutHandle>();
  const pollIntervals = {
    satellites: options.timing?.satellitesPollIntervalMs ?? SATELLITES_POLL_INTERVAL_MS,
    flights: options.timing?.flightsPollIntervalMs ?? FLIGHTS_POLL_INTERVAL_MS,
    earthquakes: options.timing?.earthquakesPollIntervalMs ?? EARTHQUAKES_POLL_INTERVAL_MS
  };
  const maxRetryBackoffMs = options.timing?.maxRetryBackoffMs ?? MAX_RETRY_BACKOFF_MS;
  let started = false;

  const schedule = (callback: () => void, delayMs: number) => {
    const timeout = setTimeoutFn(() => {
      activeTimers.delete(timeout);
      callback();
    }, delayMs);
    activeTimers.add(timeout);
  };

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

  const publishAdapterError = (
    layer: LayerKey,
    source: string,
    error: unknown,
    consecutiveFailures: number,
    retryInMs: number
  ) => {
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
      message,
      consecutive_failures: consecutiveFailures,
      retry_in_ms: retryInMs
    });
  };

  const publishAdapterRecovered = (layer: LayerKey, source: string, priorFailures: number) => {
    if (priorFailures <= 0) {
      return;
    }

    options.logger.info('Adapter recovered', {
      layer,
      source,
      failed_attempts: priorFailures
    });
  };

  const retryDelay = (baseIntervalMs: number, consecutiveFailures: number): number => {
    const exponent = Math.max(0, consecutiveFailures - 1);
    const delay = baseIntervalMs * 2 ** exponent;
    return Math.min(delay, maxRetryBackoffMs);
  };

  const startLayerLoop = <T>(settings: {
    layer: LayerKey;
    source: string;
    baseIntervalMs: number;
    poll: () => Promise<T>;
    onSuccess: (result: T) => void;
  }) => {
    if (!started) {
      return;
    }

    let consecutiveFailures = 0;

    const tick = async () => {
      if (!started) {
        return;
      }

      try {
        const result = await settings.poll();

        const priorFailures = consecutiveFailures;
        consecutiveFailures = 0;
        degradedLayers.delete(settings.layer);
        publishAdapterRecovered(settings.layer, settings.source, priorFailures);
        settings.onSuccess(result);

        if (started) {
          schedule(() => {
            void tick();
          }, settings.baseIntervalMs);
        }
      } catch (error) {
        consecutiveFailures += 1;
        const retryInMs = retryDelay(settings.baseIntervalMs, consecutiveFailures);
        publishAdapterError(settings.layer, settings.source, error, consecutiveFailures, retryInMs);

        if (started) {
          schedule(() => {
            void tick();
          }, retryInMs);
        }
      }
    };

    void tick();
  };

  const startSatellitesPolling = () => {
    if (!options.config.layers.satellites.enabled) {
      return;
    }

    startLayerLoop({
      layer: 'satellites',
      source: options.config.layers.satellites.source,
      baseIntervalMs: pollIntervals.satellites,
      poll: async () => {
        const pollSatellites =
          options.adapters?.pollSatellites ??
          (() =>
            fetchSatelliteEntities({
              maxEntities: SATELLITES_MAX_ENTITIES_PER_BATCH,
              source: options.config.layers.satellites.source
            }));

        return pollSatellites();
      },
      onSuccess: (entities) => {
        publishEntities('satellites', entities, options.config.layers.satellites.source);
      }
    });
  };

  const startEarthquakesPolling = () => {
    if (!options.config.layers.earthquakes.enabled) {
      return;
    }

    startLayerLoop({
      layer: 'earthquakes',
      source: options.config.layers.earthquakes.source,
      baseIntervalMs: pollIntervals.earthquakes,
      poll: async () => {
        const pollEarthquakes =
          options.adapters?.pollEarthquakes ??
          (() =>
            fetchUsgsEarthquakeSnapshot({
              now
            }));
        return pollEarthquakes();
      },
      onSuccess: (snapshot) => {
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
      }
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

    startLayerLoop({
      layer: 'flights',
      source: options.config.layers.flights.source,
      baseIntervalMs: pollIntervals.flights,
      poll: options.adapters?.pollFlights ?? (() => adapter.poll()),
      onSuccess: (result) => {
        if (result.status === 'ok') {
          publishEntities('flights', result.entities.slice(0, FLIGHTS_MAX_ENTITIES_PER_BATCH), result.source);
          return;
        }

        options.logger.info('Flights adapter disabled', { reason: result.reason });
        degradedLayers.delete('flights');
      }
    });
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

      started = false;
      for (const timeout of activeTimers) {
        clearTimeoutFn(timeout);
      }
      activeTimers.clear();
      degradedLayers.clear();
    },
    heartbeatStatus() {
      return degradedLayers.size > 0 ? 'degraded' : 'ok';
    }
  };
}
