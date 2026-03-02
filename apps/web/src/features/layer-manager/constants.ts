import type { LayerCounts, LayerDefinition, LayerToggles } from './types';

export const LAYERS: LayerDefinition[] = [
  { id: 'satellites', label: 'Satellites', source: 'CelesTrak/NORAD (planned adapter)' },
  { id: 'flights', label: 'Flights', source: 'OpenSky (planned adapter)' },
  { id: 'earthquakes', label: 'Earthquakes', source: 'USGS (planned adapter)' }
];

export const INITIAL_LAYER_TOGGLES: LayerToggles = {
  satellites: true,
  flights: true,
  earthquakes: true
};

export const INITIAL_LAYER_COUNTS: LayerCounts = {
  satellites: 0,
  flights: 0,
  earthquakes: 0
};

export const STALE_THRESHOLD_MS = 25_000;

export const STALE_CHECK_INTERVAL_MS = 1_000;

export const DEFAULT_STREAM_URL = 'http://localhost:4000/api/stream';

export const STREAM_EVENT_BOOTSTRAP = 'bootstrap';

export const STREAM_EVENT_HEARTBEAT = 'heartbeat';

export const STREAM_EVENT_ENTITY_UPSERT = 'entity_upsert';

export const STREAM_EVENT_ENTITY_SNAPSHOT = 'entity_snapshot';

export const STREAM_EVENT_ENTITY_DELETE = 'entity_delete';

export const STREAM_EVENT_ERROR = 'error';
