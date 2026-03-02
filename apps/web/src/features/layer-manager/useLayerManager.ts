import type { EarthEntity, StreamEvent } from '@earthly/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_LAYER_COUNTS,
  INITIAL_LAYER_TOGGLES,
  LAYERS,
  STALE_CHECK_INTERVAL_MS,
  STALE_THRESHOLD_MS,
  STREAM_EVENT_BOOTSTRAP,
  STREAM_EVENT_ENTITY_DELETE,
  STREAM_EVENT_ENTITY_SNAPSHOT,
  STREAM_EVENT_ENTITY_UPSERT,
  STREAM_EVENT_ERROR,
  STREAM_EVENT_HEARTBEAT
} from './constants';
import type { LayerCounts, LayerId, LayerToggles, LayerViewItem, StreamStatus } from './types';
import {
  applyLayerCounts,
  buildLayerView,
  parsePayload,
  resolveStreamUrl,
  shouldMarkStreamStale,
  summarizeLayerView,
  withToggledLayer
} from './utils';

export type UseLayerManagerOptions = {
  eventSourceFactory?: (url: string) => EventSource;
  onStreamEvent?: (event: StreamEvent) => void;
  staleThresholdMs?: number;
  staleCheckIntervalMs?: number;
  streamUrl?: string;
  now?: () => number;
};

export type UseLayerManagerResult = {
  layerToggles: LayerToggles;
  layerCounts: LayerCounts;
  layerView: LayerViewItem[];
  streamStatus: StreamStatus;
  lastHeartbeatAt: string | null;
  activeLayerCount: number;
  visibleEntityCount: number;
  toggleLayer: (layerId: LayerId) => void;
};

const createDefaultEventSource = (url: string): EventSource => new EventSource(url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function layerIdFromEntity(entity: EarthEntity): LayerId | null {
  if (entity.entity_type === 'satellite') {
    return 'satellites';
  }

  if (entity.entity_type === 'flight') {
    return 'flights';
  }

  if (entity.entity_type === 'quake') {
    return 'earthquakes';
  }

  return null;
}

function computeLayerCountsFromEntityIndex(index: Map<string, LayerId>): LayerCounts {
  const counts: LayerCounts = {
    ...INITIAL_LAYER_COUNTS
  };

  for (const layerId of index.values()) {
    counts[layerId] += 1;
  }

  return counts;
}

function parseContractEvent(payload: unknown): StreamEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    typeof payload.protocol_version !== 'string' ||
    typeof payload.sent_at !== 'string' ||
    typeof payload.event_type !== 'string'
  ) {
    return null;
  }

  if (payload.event_type === STREAM_EVENT_BOOTSTRAP) {
    if (typeof payload.message !== 'string') {
      return null;
    }
    return payload as StreamEvent;
  }

  if (payload.event_type === STREAM_EVENT_HEARTBEAT) {
    if (payload.status !== 'ok' && payload.status !== 'degraded') {
      return null;
    }
    return payload as StreamEvent;
  }

  if (
    (payload.event_type === STREAM_EVENT_ENTITY_UPSERT ||
      payload.event_type === STREAM_EVENT_ENTITY_SNAPSHOT) &&
    Array.isArray(payload.entities)
  ) {
    return payload as StreamEvent;
  }

  if (
    payload.event_type === STREAM_EVENT_ENTITY_DELETE &&
    Array.isArray(payload.entity_ids) &&
    payload.entity_ids.every((entityId) => typeof entityId === 'string')
  ) {
    return payload as StreamEvent;
  }

  if (
    payload.event_type === STREAM_EVENT_ERROR &&
    typeof payload.code === 'string' &&
    typeof payload.message === 'string' &&
    typeof payload.recoverable === 'boolean'
  ) {
    return payload as StreamEvent;
  }

  return null;
}

export function useLayerManager(options: UseLayerManagerOptions = {}): UseLayerManagerResult {
  const {
    eventSourceFactory = createDefaultEventSource,
    onStreamEvent,
    staleThresholdMs = STALE_THRESHOLD_MS,
    staleCheckIntervalMs = STALE_CHECK_INTERVAL_MS,
    now = Date.now
  } = options;

  const streamUrl = useMemo(() => options.streamUrl ?? resolveStreamUrl(), [options.streamUrl]);

  const [layerToggles, setLayerToggles] = useState<LayerToggles>(INITIAL_LAYER_TOGGLES);
  const [layerCounts, setLayerCounts] = useState<LayerCounts>(INITIAL_LAYER_COUNTS);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting');
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const lastHeartbeatRef = useRef<string | null>(null);
  const entityLayerIndexRef = useRef<Map<string, LayerId>>(new Map());

  useEffect(() => {
    const eventSource = eventSourceFactory(streamUrl);

    const markLive = (timestamp?: string) => {
      const observedAt = timestamp ?? new Date(now()).toISOString();
      lastHeartbeatRef.current = observedAt;
      setLastHeartbeatAt(observedAt);
      setStreamStatus('live');
    };

    const syncLayerCountsFromEntityIndex = () => {
      setLayerCounts(computeLayerCountsFromEntityIndex(entityLayerIndexRef.current));
    };

    const handleLegacyPayload = (data: string) => {
      const parsed = parsePayload(data);
      if (!parsed) {
        return;
      }

      markLive(parsed.timestamp);
      setLayerCounts((previousCounts) => applyLayerCounts(previousCounts, parsed.layers).counts);
    };

    const handleContractEvent = (streamEvent: StreamEvent) => {
      onStreamEvent?.(streamEvent);
      markLive(streamEvent.sent_at);

      if (streamEvent.event_type === 'heartbeat' && streamEvent.status === 'degraded') {
        setStreamStatus((currentStatus) => (currentStatus === 'error' ? currentStatus : 'stale'));
      }

      if (streamEvent.event_type === STREAM_EVENT_ENTITY_SNAPSHOT) {
        entityLayerIndexRef.current.clear();
        for (const entity of streamEvent.entities) {
          const layerId = layerIdFromEntity(entity);
          if (!layerId) {
            continue;
          }
          entityLayerIndexRef.current.set(entity.entity_id, layerId);
        }
        syncLayerCountsFromEntityIndex();
        return;
      }

      if (streamEvent.event_type === STREAM_EVENT_ENTITY_UPSERT) {
        for (const entity of streamEvent.entities) {
          const layerId = layerIdFromEntity(entity);
          if (!layerId) {
            continue;
          }
          entityLayerIndexRef.current.set(entity.entity_id, layerId);
        }
        syncLayerCountsFromEntityIndex();
        return;
      }

      if (streamEvent.event_type === STREAM_EVENT_ENTITY_DELETE) {
        for (const entityId of streamEvent.entity_ids) {
          entityLayerIndexRef.current.delete(entityId);
        }
        syncLayerCountsFromEntityIndex();
        return;
      }

      if (streamEvent.event_type === STREAM_EVENT_ERROR) {
        setStreamStatus('error');
      }
    };

    const handleEventData = (data: string) => {
      try {
        const parsed = parseContractEvent(JSON.parse(data));
        if (parsed) {
          handleContractEvent(parsed);
          return;
        }
      } catch {
        // ignored - fallback to legacy payload parsing below
      }

      handleLegacyPayload(data);
    };

    eventSource.onopen = () => {
      markLive();
    };

    eventSource.onerror = () => {
      setStreamStatus('error');
    };

    eventSource.addEventListener(STREAM_EVENT_BOOTSTRAP, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    eventSource.addEventListener(STREAM_EVENT_HEARTBEAT, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    eventSource.addEventListener(STREAM_EVENT_ENTITY_UPSERT, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    eventSource.addEventListener(STREAM_EVENT_ENTITY_SNAPSHOT, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    eventSource.addEventListener(STREAM_EVENT_ENTITY_DELETE, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    eventSource.addEventListener(STREAM_EVENT_ERROR, (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string') {
        handleEventData(messageEvent.data);
      }
    });

    const staleInterval = window.setInterval(() => {
      if (shouldMarkStreamStale(lastHeartbeatRef.current, now(), staleThresholdMs)) {
        setStreamStatus((currentStatus) => (currentStatus === 'error' ? currentStatus : 'stale'));
      }
    }, staleCheckIntervalMs);

    return () => {
      eventSource.close();
      window.clearInterval(staleInterval);
    };
  }, [eventSourceFactory, now, onStreamEvent, staleCheckIntervalMs, staleThresholdMs, streamUrl]);

  const toggleLayer = (layerId: LayerId) => {
    setLayerToggles((previousToggles) => withToggledLayer(previousToggles, layerId));
  };

  const layerView = useMemo(
    () => buildLayerView(LAYERS, layerToggles, layerCounts, streamStatus),
    [layerCounts, layerToggles, streamStatus]
  );

  const summary = useMemo(() => summarizeLayerView(layerView), [layerView]);

  return {
    layerToggles,
    layerCounts,
    layerView,
    streamStatus,
    lastHeartbeatAt,
    activeLayerCount: summary.activeLayerCount,
    visibleEntityCount: summary.visibleEntityCount,
    toggleLayer
  };
}
