import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayerManager } from './useLayerManager';

type StreamEventHandler = (event: MessageEvent<string>) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  closed = false;
  private listeners = new Map<string, Set<StreamEventHandler>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const handler = listener as StreamEventHandler;
    const handlers = this.listeners.get(type) ?? new Set<StreamEventHandler>();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const handler = listener as StreamEventHandler;
    this.listeners.get(type)?.delete(handler);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    this.onopen?.call(this as unknown as EventSource, new Event('open'));
  }

  emitError() {
    this.onerror?.call(this as unknown as EventSource, new Event('error'));
  }

  emit(eventName: string, payload: unknown) {
    const event = new MessageEvent<string>(eventName, {
      data: JSON.stringify(payload)
    });

    const handlers = this.listeners.get(eventName);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(event);
    }
  }
}

function getSource(): MockEventSource {
  const source = MockEventSource.instances.at(0);
  if (!source) {
    throw new Error('expected EventSource instance');
  }

  return source;
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLayerManager', () => {
  it('initializes with connecting stream and stale enabled layers', () => {
    const { result } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource
      })
    );

    expect(result.current.streamStatus).toBe('connecting');
    expect(result.current.activeLayerCount).toBe(3);
    expect(result.current.visibleEntityCount).toBe(0);
    expect(result.current.layerView.map((layer) => layer.status)).toEqual(['stale', 'stale', 'stale']);
  });

  it('toggles a layer off and back on', () => {
    const { result } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource
      })
    );

    act(() => {
      result.current.toggleLayer('satellites');
    });

    const satellitesOff = result.current.layerView.find((layer) => layer.id === 'satellites');
    expect(satellitesOff?.enabled).toBe(false);
    expect(satellitesOff?.status).toBe('off');
    expect(result.current.activeLayerCount).toBe(2);

    act(() => {
      result.current.toggleLayer('satellites');
    });

    const satellitesOn = result.current.layerView.find((layer) => layer.id === 'satellites');
    expect(satellitesOn?.enabled).toBe(true);
    expect(satellitesOn?.status).toBe('stale');
    expect(result.current.activeLayerCount).toBe(3);
  });

  it('updates counts and status from stream events', () => {
    const { result } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource
      })
    );

    const source = getSource();

    act(() => {
      source.emitOpen();
      source.emit('heartbeat', {
        timestamp: '2026-03-02T00:00:00.000Z',
        layers: {
          satellites: { count: 11 },
          flights: { count: 22 },
          earthquakes: { count: 3 }
        }
      });
    });

    expect(result.current.streamStatus).toBe('live');
    expect(result.current.layerCounts).toEqual({
      satellites: 11,
      flights: 22,
      earthquakes: 3
    });

    expect(result.current.visibleEntityCount).toBe(36);
    expect(result.current.layerView.map((layer) => layer.status)).toEqual(['live', 'live', 'live']);
    expect(result.current.lastHeartbeatAt).toBe('2026-03-02T00:00:00.000Z');
  });

  it('marks stream stale when heartbeat age exceeds threshold', () => {
    const { result } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource
      })
    );

    const source = getSource();

    act(() => {
      source.emit('heartbeat', {
        timestamp: '2026-03-02T00:00:00.000Z'
      });
    });

    expect(result.current.streamStatus).toBe('live');

    act(() => {
      vi.advanceTimersByTime(26_000);
    });

    expect(result.current.streamStatus).toBe('stale');
  });

  it('tracks entity counts from contract stream events', () => {
    const onStreamEvent = vi.fn();
    const { result } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource,
        onStreamEvent
      })
    );

    const source = getSource();

    act(() => {
      source.emit('entity_snapshot', {
        event_type: 'entity_snapshot',
        protocol_version: '1.0.0',
        sent_at: '2026-03-02T00:00:00.000Z',
        entities: [
          {
            entity_id: 'sat-25544',
            entity_type: 'satellite',
            position: { lat: 1, lon: 1 },
            source: 'CelesTrak',
            observed_at: '2026-03-02T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z'
          },
          {
            entity_id: 'flight-abc',
            entity_type: 'flight',
            position: { lat: 2, lon: 2 },
            source: 'OpenSky',
            observed_at: '2026-03-02T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z'
          }
        ]
      });
    });

    expect(result.current.layerCounts).toEqual({
      satellites: 1,
      flights: 1,
      earthquakes: 0
    });

    act(() => {
      source.emit('entity_delete', {
        event_type: 'entity_delete',
        protocol_version: '1.0.0',
        sent_at: '2026-03-02T00:00:05.000Z',
        entity_ids: ['flight-abc']
      });
    });

    expect(result.current.layerCounts).toEqual({
      satellites: 1,
      flights: 0,
      earthquakes: 0
    });
    expect(onStreamEvent).toHaveBeenCalledTimes(2);
  });

  it('preserves error state after stale checks and closes stream on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useLayerManager({
        streamUrl: 'http://localhost:4000/api/stream',
        eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource
      })
    );

    const source = getSource();

    act(() => {
      source.emit('heartbeat', {
        timestamp: '2026-03-02T00:00:00.000Z'
      });
      source.emitError();
    });

    expect(result.current.streamStatus).toBe('error');

    act(() => {
      vi.advanceTimersByTime(26_000);
    });

    expect(result.current.streamStatus).toBe('error');

    unmount();

    expect(source.closed).toBe(true);
  });
});
