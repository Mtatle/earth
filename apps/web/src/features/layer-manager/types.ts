export type LayerId = 'satellites' | 'flights' | 'earthquakes';

export type LayerStatus = 'live' | 'stale' | 'error' | 'off';

export type StreamStatus = 'connecting' | 'live' | 'stale' | 'error';

export type LayerDefinition = {
  id: LayerId;
  label: string;
  source: string;
};

export type LayerToggles = Record<LayerId, boolean>;

export type LayerCounts = Record<LayerId, number>;

export type StreamPayload = {
  timestamp?: string;
  layers?: Partial<Record<LayerId, { count?: number }>>;
};

export type LayerViewItem = LayerDefinition & {
  enabled: boolean;
  status: LayerStatus;
  count: number;
};

export type LayerSummary = {
  activeLayerCount: number;
  visibleEntityCount: number;
};
