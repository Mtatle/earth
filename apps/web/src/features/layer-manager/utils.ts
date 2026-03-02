import { DEFAULT_STREAM_URL, LAYERS } from './constants';
import type {
  LayerCounts,
  LayerDefinition,
  LayerId,
  LayerStatus,
  LayerSummary,
  LayerToggles,
  LayerViewItem,
  StreamPayload,
  StreamStatus
} from './types';

export function parsePayload(data: string): StreamPayload | null {
  try {
    const parsed = JSON.parse(data) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as StreamPayload;
  } catch {
    return null;
  }
}

export function formatUpdatedAt(value: string | null, nowMs: number = Date.now()): string {
  if (!value) {
    return 'never';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  const elapsedMs = nowMs - timestamp;
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

export function computeLayerStatus(enabled: boolean, streamStatus: StreamStatus): LayerStatus {
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

export function resolveStreamUrl(configuredBase: string | undefined = import.meta.env.VITE_API_BASE_URL): string {
  const normalizedBase = configuredBase?.trim();

  if (!normalizedBase) {
    return DEFAULT_STREAM_URL;
  }

  return `${normalizedBase.replace(/\/$/, '')}/api/stream`;
}

export function applyLayerCounts(
  previousCounts: LayerCounts,
  nextLayerPayloads: StreamPayload['layers']
): { counts: LayerCounts; changed: boolean } {
  if (!nextLayerPayloads) {
    return { counts: previousCounts, changed: false };
  }

  const nextCounts = { ...previousCounts };
  let changed = false;

  for (const layer of LAYERS) {
    const nextCount = nextLayerPayloads[layer.id]?.count;

    if (typeof nextCount === 'number' && Number.isFinite(nextCount) && nextCount >= 0) {
      if (nextCounts[layer.id] !== nextCount) {
        nextCounts[layer.id] = nextCount;
        changed = true;
      }
    }
  }

  return {
    counts: changed ? nextCounts : previousCounts,
    changed
  };
}

export function buildLayerView(
  layers: LayerDefinition[],
  toggles: LayerToggles,
  counts: LayerCounts,
  streamStatus: StreamStatus
): LayerViewItem[] {
  return layers.map((layer) => {
    const enabled = toggles[layer.id];

    return {
      ...layer,
      enabled,
      status: computeLayerStatus(enabled, streamStatus),
      count: enabled ? counts[layer.id] : 0
    };
  });
}

export function summarizeLayerView(layerView: LayerViewItem[]): LayerSummary {
  return layerView.reduce<LayerSummary>(
    (summary, layer) => ({
      activeLayerCount: summary.activeLayerCount + (layer.enabled ? 1 : 0),
      visibleEntityCount: summary.visibleEntityCount + layer.count
    }),
    {
      activeLayerCount: 0,
      visibleEntityCount: 0
    }
  );
}

export function shouldMarkStreamStale(lastHeartbeatAt: string | null, nowMs: number, staleThresholdMs: number): boolean {
  if (!lastHeartbeatAt) {
    return false;
  }

  const heartbeatMs = Date.parse(lastHeartbeatAt);
  if (Number.isNaN(heartbeatMs)) {
    return false;
  }

  return nowMs - heartbeatMs > staleThresholdMs;
}

export function withToggledLayer(previousToggles: LayerToggles, layerId: LayerId): LayerToggles {
  return {
    ...previousToggles,
    [layerId]: !previousToggles[layerId]
  };
}
