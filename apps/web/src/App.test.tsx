import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

type StreamEventHandler = (event: MessageEvent<string>) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  private listeners = new Map<string, Set<StreamEventHandler>>();

  constructor(url: string | URL) {
    this.url = String(url);
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

  close() {}

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

function getLayerRow(layerName: string): HTMLElement {
  const label = screen.getByText(layerName);
  const row = label.closest('li');
  if (!row) {
    throw new Error(`could not find row for layer ${layerName}`);
  }
  return row;
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T00:00:00.000Z'));
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders layer manager and toggles a layer off', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /geospatial operations surface/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /camera presets/i })).toBeInTheDocument();
    expect(screen.getByText(/stream connecting/i)).toBeInTheDocument();

    const satellitesRow = getLayerRow('Satellites');
    const satellitesToggle = within(satellitesRow).getByRole('button', { name: /satellites/i });

    expect(within(satellitesRow).getByText('stale')).toBeInTheDocument();
    expect(satellitesToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(satellitesToggle);

    expect(satellitesToggle).toHaveAttribute('aria-pressed', 'false');
    expect(within(satellitesRow).getByText('off')).toBeInTheDocument();
  });

  it('updates layer status from stream events', () => {
    render(<App />);
    const source = MockEventSource.instances.at(0);

    if (!source) {
      throw new Error('expected EventSource instance');
    }

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

    expect(screen.getByText(/stream live/i)).toBeInTheDocument();

    const satellitesRow = getLayerRow('Satellites');
    expect(within(satellitesRow).getByText('11 tracked')).toBeInTheDocument();
    expect(within(satellitesRow).getByText('live')).toBeInTheDocument();

    act(() => {
      source.emitError();
    });

    expect(screen.getByText(/stream error/i)).toBeInTheDocument();
    expect(within(satellitesRow).getByText('error')).toBeInTheDocument();
  });

  it('marks stream stale when heartbeat stops', () => {
    render(<App />);
    const source = MockEventSource.instances.at(0);

    if (!source) {
      throw new Error('expected EventSource instance');
    }

    act(() => {
      source.emitOpen();
      source.emit('heartbeat', { timestamp: '2026-03-02T00:00:00.000Z' });
    });

    expect(screen.getByText(/stream live/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(26_000);
    });

    expect(screen.getByText(/stream stale/i)).toBeInTheDocument();
  });

  it('renders streamed entities and shows details when selected', () => {
    render(<App />);
    const source = MockEventSource.instances.at(0);

    if (!source) {
      throw new Error('expected EventSource instance');
    }

    act(() => {
      source.emit('entity_upsert', {
        event_type: 'entity_upsert',
        protocol_version: '1.0.0',
        sent_at: '2026-03-02T00:00:00.000Z',
        entities: [
          {
            entity_id: 'flight-abc',
            entity_type: 'flight',
            position: { lat: 30.2672, lon: -97.7431, alt: 10_345 },
            source: 'OpenSky',
            observed_at: '2026-03-02T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z',
            metadata: { callsign: 'EARTH1' }
          }
        ]
      });
    });

    const entityButton = screen.getByRole('button', { name: /flight-abc/i });
    fireEvent.click(entityButton);

    expect(screen.getByText('FLIGHT · flight-abc')).toBeInTheDocument();
    expect(screen.getByText('Source OpenSky')).toBeInTheDocument();
  });
});
