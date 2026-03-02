import { useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_LAYER_COUNTS,
  INITIAL_LAYER_TOGGLES,
  LAYERS,
  STALE_CHECK_INTERVAL_MS,
  STALE_THRESHOLD_MS,
  STREAM_EVENT_BOOTSTRAP,
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

export function useLayerManager(options: UseLayerManagerOptions = {}): UseLayerManagerResult {
  const {
    eventSourceFactory = createDefaultEventSource,
    staleThresholdMs = STALE_THRESHOLD_MS,
    staleCheckIntervalMs = STALE_CHECK_INTERVAL_MS,
    now = () => Date.now()
  } = options;

  const streamUrl = useMemo(() => options.streamUrl ?? resolveStreamUrl(), [options.streamUrl]);

  const [layerToggles, setLayerToggles] = useState<LayerToggles>(INITIAL_LAYER_TOGGLES);
  const [layerCounts, setLayerCounts] = useState<LayerCounts>(INITIAL_LAYER_COUNTS);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting');
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const lastHeartbeatRef = useRef<string | null>(null);

  useEffect(() => {
    const eventSource = eventSourceFactory(streamUrl);

    const markLive = (timestamp?: string) => {
      const observedAt = timestamp ?? new Date(now()).toISOString();
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
      setLayerCounts((previousCounts) => applyLayerCounts(previousCounts, parsed.layers).counts);
    };

    eventSource.onopen = () => {
      markLive();
    };

    eventSource.onerror = () => {
      setStreamStatus('error');
    };

    eventSource.addEventListener(STREAM_EVENT_BOOTSTRAP, (event) => {
      handlePayload((event as MessageEvent<string>).data);
    });

    eventSource.addEventListener(STREAM_EVENT_HEARTBEAT, (event) => {
      handlePayload((event as MessageEvent<string>).data);
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
  }, [eventSourceFactory, now, staleCheckIntervalMs, staleThresholdMs, streamUrl]);

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
