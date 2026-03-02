import type { EarthEntity, StreamEvent } from '@earthly/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadRuntimeConfig } from '../config/env.js';
import { createStreamRuntime, type StreamRuntimeLogger } from '../streams/runtime.js';

function createFlightEntity(): EarthEntity {
  return {
    entity_id: 'flight-abc123',
    entity_type: 'flight',
    position: {
      lat: 30.2672,
      lon: -97.7431,
      alt: 10345
    },
    source: 'OpenSky Network',
    observed_at: '2026-03-02T12:00:00.000Z',
    updated_at: '2026-03-02T12:00:00.000Z',
    metadata: {
      icao24: 'abc123'
    }
  };
}

function createLogger(): StreamRuntimeLogger {
  return {
    info: vi.fn(),
    warn: vi.fn()
  };
}

function createFlightsEnabledConfig() {
  return loadRuntimeConfig({
    NODE_ENV: 'test',
    STRICT_ADAPTER_KEYS: 'true',
    ENABLE_LAYER_SATELLITES: 'false',
    ENABLE_LAYER_FLIGHTS: 'true',
    ENABLE_LAYER_EARTHQUAKES: 'false',
    OPENSKY_USERNAME: 'pilot',
    OPENSKY_PASSWORD: 'secret'
  });
}

describe('stream runtime resilience', () => {
  it('retries with exponential backoff and recovers after adapter success', async () => {
    vi.useFakeTimers();
    try {
      const logger = createLogger();
      const broadcast = vi.fn<(event: StreamEvent) => number>().mockReturnValue(0);
      const successPayload = {
        status: 'ok' as const,
        source: 'OpenSky Network',
        fetched_at: '2026-03-02T12:00:00.000Z',
        entities: [createFlightEntity()],
        dropped: 0
      };
      const pollFlights = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary timeout'))
        .mockRejectedValueOnce(new Error('upstream 503'))
        .mockResolvedValue(successPayload);

      const runtime = createStreamRuntime({
        config: createFlightsEnabledConfig(),
        logger,
        broadcast,
        now: () => new Date('2026-03-02T12:00:00.000Z'),
        adapters: {
          pollFlights
        },
        timing: {
          flightsPollIntervalMs: 1000,
          maxRetryBackoffMs: 4000
        }
      });

      runtime.start();
      await Promise.resolve();

      expect(pollFlights).toHaveBeenCalledTimes(1);
      expect(runtime.heartbeatStatus()).toBe('degraded');
      expect(logger.warn).toHaveBeenCalledWith(
        'Adapter poll failed',
        expect.objectContaining({
          layer: 'flights',
          consecutive_failures: 1,
          retry_in_ms: 1000
        })
      );

      await vi.advanceTimersByTimeAsync(999);
      expect(pollFlights).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(pollFlights).toHaveBeenCalledTimes(2);

      expect(logger.warn).toHaveBeenCalledWith(
        'Adapter poll failed',
        expect.objectContaining({
          layer: 'flights',
          consecutive_failures: 2,
          retry_in_ms: 2000
        })
      );

      await vi.advanceTimersByTimeAsync(1999);
      expect(pollFlights).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(pollFlights).toHaveBeenCalledTimes(3);
      expect(runtime.heartbeatStatus()).toBe('ok');
      expect(logger.info).toHaveBeenCalledWith(
        'Adapter recovered',
        expect.objectContaining({
          layer: 'flights',
          failed_attempts: 2
        })
      );

      const events = broadcast.mock.calls.map(([event]) => event);
      const errorEvents = events.filter((event) => event.event_type === 'error');
      const upsertEvents = events.filter((event) => event.event_type === 'entity_upsert');

      expect(errorEvents).toHaveLength(2);
      expect(upsertEvents).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(pollFlights).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(1);
      expect(pollFlights).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops pending retries and clears degraded status', async () => {
    vi.useFakeTimers();
    try {
      const logger = createLogger();
      const broadcast = vi.fn<(event: StreamEvent) => number>().mockReturnValue(0);
      const pollFlights = vi.fn().mockRejectedValue(new Error('always failing'));

      const runtime = createStreamRuntime({
        config: createFlightsEnabledConfig(),
        logger,
        broadcast,
        adapters: {
          pollFlights
        },
        timing: {
          flightsPollIntervalMs: 500
        }
      });

      runtime.start();
      await Promise.resolve();

      expect(pollFlights).toHaveBeenCalledTimes(1);
      expect(runtime.heartbeatStatus()).toBe('degraded');

      runtime.stop();
      expect(runtime.heartbeatStatus()).toBe('ok');

      await vi.advanceTimersByTimeAsync(10_000);
      expect(pollFlights).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

