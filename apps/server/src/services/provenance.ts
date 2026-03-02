import type { LayerKey, RuntimeConfig } from '../config/env.js';

const DEFAULT_COMPLIANCE_NOTE =
  'Public feed; verify provider terms and attribution requirements before redistribution.';

const DEFAULT_REFRESH_INTERVAL_MS: Record<LayerKey, number> = {
  satellites: 20_000,
  flights: 15_000,
  earthquakes: 45_000
};

const DEFAULT_STALE_MULTIPLIER = 3;

export type SourceHealthStatus = 'live' | 'stale' | 'error' | 'off' | 'unknown';

export interface SourceHealthSnapshot {
  status?: 'live' | 'error' | 'off' | 'unknown';
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
}

export interface LayerProvenanceRecord {
  key: LayerKey;
  label: string;
  enabled: boolean;
  source_name: string;
  source_url: string | null;
  terms_url: string | null;
  compliance_note: string;
  refresh_interval_ms: number;
  stale_after_ms: number;
  health: SourceHealthStatus;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
}

export interface ProvenanceSnapshot {
  generated_at: string;
  layers: LayerProvenanceRecord[];
}

export interface CreateProvenanceServiceOptions {
  config: RuntimeConfig;
  now?: () => Date;
  getHealthSnapshots?: () => Partial<Record<LayerKey, SourceHealthSnapshot>>;
  refreshIntervalsMs?: Partial<Record<LayerKey, number>>;
  staleMultiplier?: number;
}

export interface SourceDescriptor {
  sourceUrl: string | null;
  termsUrl: string | null;
}

const SOURCE_DESCRIPTOR_BY_LAYER: Record<LayerKey, SourceDescriptor> = {
  satellites: {
    sourceUrl: 'https://celestrak.org/',
    termsUrl: 'https://celestrak.org/NORAD/documentation/gp-data-formats.php'
  },
  flights: {
    sourceUrl: 'https://opensky-network.org/',
    termsUrl: 'https://opensky-network.org/about/terms-of-use'
  },
  earthquakes: {
    sourceUrl: 'https://earthquake.usgs.gov/',
    termsUrl: 'https://www.usgs.gov/laws/policies_notices.html'
  }
};

const ADSBX_SOURCE_DESCRIPTOR: SourceDescriptor = {
  sourceUrl: 'https://www.adsbexchange.com/data/',
  termsUrl: 'https://www.adsbexchange.com/data/'
};

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveFlightsDescriptor(sourceName: string): SourceDescriptor {
  const normalized = sourceName.toLowerCase();
  if (normalized.includes('adsb')) {
    return ADSBX_SOURCE_DESCRIPTOR;
  }

  return SOURCE_DESCRIPTOR_BY_LAYER.flights;
}

export function resolveSourceDescriptor(layer: LayerKey, sourceName: string): SourceDescriptor {
  if (layer === 'flights') {
    return resolveFlightsDescriptor(sourceName);
  }

  return SOURCE_DESCRIPTOR_BY_LAYER[layer];
}

export function createProvenanceService(options: CreateProvenanceServiceOptions) {
  const now = options.now ?? (() => new Date());
  const getHealthSnapshots: () => Partial<Record<LayerKey, SourceHealthSnapshot>> =
    options.getHealthSnapshots ?? (() => ({}));
  const refreshIntervals: Record<LayerKey, number> = {
    ...DEFAULT_REFRESH_INTERVAL_MS,
    ...(options.refreshIntervalsMs ?? {})
  };
  const staleMultiplier = options.staleMultiplier ?? DEFAULT_STALE_MULTIPLIER;

  function resolveHealthStatus(
    layer: LayerKey,
    enabled: boolean,
    snapshot: SourceHealthSnapshot | undefined,
    referenceTime: Date
  ): { status: SourceHealthStatus; lastSuccessAt: string | null } {
    if (!enabled) {
      return { status: 'off', lastSuccessAt: null };
    }

    if (!snapshot) {
      return { status: 'unknown', lastSuccessAt: null };
    }

    if (snapshot.status === 'error') {
      return { status: 'error', lastSuccessAt: snapshot.lastSuccessAt ?? null };
    }

    const parsedLastSuccessAt = parseIsoTimestamp(snapshot.lastSuccessAt);
    if (parsedLastSuccessAt === null) {
      if (snapshot.status === 'live') {
        return { status: 'live', lastSuccessAt: null };
      }
      return { status: snapshot.status ?? 'unknown', lastSuccessAt: null };
    }

    const ageMs = referenceTime.getTime() - parsedLastSuccessAt;
    const staleAfterMs = refreshIntervals[layer] * staleMultiplier;
    const status = ageMs > staleAfterMs ? 'stale' : 'live';

    return { status, lastSuccessAt: new Date(parsedLastSuccessAt).toISOString() };
  }

  function getSnapshot(): ProvenanceSnapshot {
    const generatedAtDate = now();
    const snapshots = getHealthSnapshots();

    const layers = (Object.keys(options.config.layers) as LayerKey[]).map((layerKey) => {
      const layer = options.config.layers[layerKey];
      const snapshot = snapshots[layerKey];
      const descriptor = resolveSourceDescriptor(layerKey, layer.source);
      const refreshIntervalMs = refreshIntervals[layerKey];
      const staleAfterMs = refreshIntervalMs * staleMultiplier;
      const { status, lastSuccessAt } = resolveHealthStatus(
        layerKey,
        layer.enabled,
        snapshot,
        generatedAtDate
      );

      return {
        key: layerKey,
        label: layer.label,
        enabled: layer.enabled,
        source_name: layer.source,
        source_url: descriptor.sourceUrl,
        terms_url: descriptor.termsUrl,
        compliance_note: DEFAULT_COMPLIANCE_NOTE,
        refresh_interval_ms: refreshIntervalMs,
        stale_after_ms: staleAfterMs,
        health: status,
        last_success_at: lastSuccessAt,
        last_error_at: snapshot?.lastErrorAt ?? null,
        last_error_message: snapshot?.lastErrorMessage ?? null
      } satisfies LayerProvenanceRecord;
    });

    return {
      generated_at: generatedAtDate.toISOString(),
      layers
    };
  }

  return {
    getSnapshot
  };
}
