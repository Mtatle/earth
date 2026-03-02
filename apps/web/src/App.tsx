import { useEffect, useMemo, useRef, useState } from 'react';
import { CesiumGlobe } from './scene/CesiumGlobe';

type LayerId = 'satellites' | 'flights' | 'earthquakes';
type LayerStatus = 'live' | 'stale' | 'error' | 'off';
type StreamStatus = 'connecting' | 'live' | 'stale' | 'error';

type LayerDefinition = {
  id: LayerId;
  label: string;
  source: string;
};

const LAYERS: LayerDefinition[] = [
  { id: 'satellites', label: 'Satellites', source: 'CelesTrak/NORAD (planned adapter)' },
  { id: 'flights', label: 'Flights', source: 'OpenSky (planned adapter)' },
  { id: 'earthquakes', label: 'Earthquakes', source: 'USGS (planned adapter)' }
];

const INITIAL_LAYER_TOGGLES: Record<LayerId, boolean> = {
  satellites: true,
  flights: true,
  earthquakes: true
};

const INITIAL_LAYER_COUNTS: Record<LayerId, number> = {
  satellites: 0,
  flights: 0,
  earthquakes: 0
};

const STALE_THRESHOLD_MS = 25_000;
const STALE_CHECK_INTERVAL_MS = 1_000;

type StreamPayload = {
  timestamp?: string;
  layers?: Partial<Record<LayerId, { count?: number }>>;
};

function parsePayload(data: string): StreamPayload | null {
  try {
    const parsed = JSON.parse(data) as StreamPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return 'never';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds < 5) {
    return 'just now';
  }

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return `${elapsedMinutes}m ago`;
}

function computeLayerStatus(enabled: boolean, streamStatus: StreamStatus): LayerStatus {
  if (!enabled) {
    return 'off';
  }

  if (streamStatus === 'error') {
    return 'error';
  }

  if (streamStatus === 'stale' || streamStatus === 'connecting') {
    return 'stale';
  }

  return 'live';
}

function resolveStreamUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBase) {
    return 'http://localhost:4000/api/stream';
  }

  return `${configuredBase.replace(/\/$/, '')}/api/stream`;
}

export function App() {
  const [layerToggles, setLayerToggles] = useState<Record<LayerId, boolean>>(INITIAL_LAYER_TOGGLES);
  const [layerCounts, setLayerCounts] = useState<Record<LayerId, number>>(INITIAL_LAYER_COUNTS);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting');
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const lastHeartbeatRef = useRef<string | null>(null);
  const streamUrl = useMemo(resolveStreamUrl, []);

  useEffect(() => {
    const eventSource = new EventSource(streamUrl);

    const markLive = (timestamp?: string) => {
      const observedAt = timestamp ?? new Date().toISOString();
      lastHeartbeatRef.current = observedAt;
      setLastHeartbeatAt(observedAt);
      setStreamStatus('live');
    };

    const handlePayload = (data: string) => {
      const parsed = parsePayload(data);
      if (!parsed) {
        return;
      }

      markLive(parsed.timestamp);

      if (!parsed.layers) {
        return;
      }

      setLayerCounts((previousCounts) => {
        const nextCounts = { ...previousCounts };
        let changed = false;

        for (const layer of LAYERS) {
          const nextCount = parsed.layers?.[layer.id]?.count;
          if (typeof nextCount === 'number' && Number.isFinite(nextCount) && nextCount >= 0) {
            if (nextCounts[layer.id] !== nextCount) {
              nextCounts[layer.id] = nextCount;
              changed = true;
            }
          }
        }

        return changed ? nextCounts : previousCounts;
      });
    };

    eventSource.onopen = () => {
      markLive();
    };

    eventSource.onerror = () => {
      setStreamStatus('error');
    };

    eventSource.addEventListener('bootstrap', (event) => {
      const messageEvent = event as MessageEvent<string>;
      handlePayload(messageEvent.data);
    });

    eventSource.addEventListener('heartbeat', (event) => {
      const messageEvent = event as MessageEvent<string>;
      handlePayload(messageEvent.data);
    });

    const staleInterval = window.setInterval(() => {
      if (!lastHeartbeatRef.current) {
        return;
      }

      const ageMs = Date.now() - Date.parse(lastHeartbeatRef.current);
      if (ageMs > STALE_THRESHOLD_MS) {
        setStreamStatus((currentStatus) => (currentStatus === 'error' ? currentStatus : 'stale'));
      }
    }, STALE_CHECK_INTERVAL_MS);

    return () => {
      eventSource.close();
      window.clearInterval(staleInterval);
    };
  }, [streamUrl]);

  const toggleLayer = (layerId: LayerId) => {
    setLayerToggles((previous) => ({
      ...previous,
      [layerId]: !previous[layerId]
    }));
  };

  const layerView = useMemo(
    () =>
      LAYERS.map((layer) => {
        const enabled = layerToggles[layer.id];
        const status = computeLayerStatus(enabled, streamStatus);
        const count = enabled ? layerCounts[layer.id] : 0;

        return {
          ...layer,
          enabled,
          status,
          count
        };
      }),
    [layerCounts, layerToggles, streamStatus]
  );

  const activeLayerCount = layerView.filter((layer) => layer.enabled).length;
  const visibleEntityCount = layerView.reduce((total, layer) => total + layer.count, 0);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="kicker">Earthly v0.1</p>
          <h1>Geospatial Operations Surface</h1>
        </div>
        <span className={`status status-${streamStatus}`}>Stream {streamStatus}</span>
      </header>

      <main className="content">
        <aside className="panel">
          <h2>Layers</h2>
          <ul className="layer-list">
            {layerView.map((layer) => (
              <li key={layer.id} className="layer-row">
                <button
                  type="button"
                  aria-pressed={layer.enabled}
                  className={`layer-toggle ${layer.enabled ? 'is-on' : 'is-off'}`}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <span>{layer.label}</span>
                  <span>{layer.enabled ? 'On' : 'Off'}</span>
                </button>
                <div className="layer-meta">
                  <span className={`layer-badge badge-${layer.status}`}>{layer.status}</span>
                  <span className="layer-count">{layer.count} tracked</span>
                </div>
                <p className="layer-source">Source: {layer.source}</p>
                <p className="layer-updated">Updated: {layer.enabled ? formatUpdatedAt(lastHeartbeatAt) : 'disabled'}</p>
              </li>
            ))}
          </ul>
        </aside>

        <section className="viewport" aria-label="3D globe viewport">
          <div className="viewport-summary">
            <p>
              {activeLayerCount} layers active · {visibleEntityCount} entities visible
            </p>
            <p>Camera presets provide smooth global-to-regional transitions.</p>
          </div>
          <CesiumGlobe />
        </section>

        <aside className="panel">
          <h2>Entity</h2>
          <p>Click interaction starts in T-022.</p>
        </aside>
      </main>
    </div>
  );
}
