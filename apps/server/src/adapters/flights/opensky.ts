import { earthEntitySchema, type EarthEntity } from '@earthly/shared';
import type { LayerRuntimeConfig } from '../../config/env.js';

const DEFAULT_OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all';
const DEFAULT_SOURCE = 'OpenSky Network';

type OpenSkyStateVector = [
  icao24: string | null,
  callsign: string | null,
  origin_country: string | null,
  time_position: number | null,
  last_contact: number | null,
  longitude: number | null,
  latitude: number | null,
  baro_altitude: number | null,
  on_ground: boolean | null,
  velocity: number | null,
  true_track: number | null,
  vertical_rate: number | null,
  sensors: unknown,
  geo_altitude: number | null,
  squawk: string | null,
  spi: boolean | null,
  position_source: number | null
];

export interface OpenSkyCredentials {
  username: string;
  password: string;
}

export interface OpenSkyNormalizeResult {
  entities: EarthEntity[];
  dropped: number;
}

export interface OpenSkyFlightsAdapterOptions {
  layer: Pick<LayerRuntimeConfig, 'enabled' | 'notice' | 'source'>;
  credentials?: Partial<OpenSkyCredentials>;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface OpenSkyFlightsPollDisabled {
  status: 'disabled';
  source: string;
  reason: string;
  entities: [];
}

export interface OpenSkyFlightsPollSuccess {
  status: 'ok';
  source: string;
  fetched_at: string;
  entities: EarthEntity[];
  dropped: number;
}

export type OpenSkyFlightsPollResult = OpenSkyFlightsPollDisabled | OpenSkyFlightsPollSuccess;

function normalizeCredential(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasOpenSkyCredentials(credentials?: Partial<OpenSkyCredentials>): credentials is OpenSkyCredentials {
  const username = normalizeCredential(credentials?.username);
  const password = normalizeCredential(credentials?.password);
  return Boolean(username && password);
}

function asOpenSkyStateVector(payload: unknown): OpenSkyStateVector | null {
  if (!Array.isArray(payload) || payload.length < 17) {
    return null;
  }

  const stateVector = payload as OpenSkyStateVector;
  return stateVector;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isoFromUnixSeconds(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

function normalizeOpenSkyStateVector(
  stateRaw: unknown,
  observedAtFallback: string,
  updatedAt: string
): EarthEntity | null {
  const state = asOpenSkyStateVector(stateRaw);
  if (!state) {
    return null;
  }

  const icao24 = toTrimmedString(state[0])?.toLowerCase();
  const lon = toFiniteNumber(state[5]);
  const lat = toFiniteNumber(state[6]);

  if (!icao24 || lon === undefined || lat === undefined) {
    return null;
  }

  const callsign = toTrimmedString(state[1]);
  const originCountry = toTrimmedString(state[2]);
  const timePosition = toFiniteNumber(state[3]);
  const lastContact = toFiniteNumber(state[4]);
  const baroAltitude = toFiniteNumber(state[7]);
  const onGround = typeof state[8] === 'boolean' ? state[8] : undefined;
  const speedMps = toFiniteNumber(state[9]);
  const headingDeg = toFiniteNumber(state[10]);
  const verticalRateMps = toFiniteNumber(state[11]);
  const geoAltitude = toFiniteNumber(state[13]);
  const squawk = toTrimmedString(state[14]);
  const spi = typeof state[15] === 'boolean' ? state[15] : undefined;
  const positionSource = toFiniteNumber(state[16]);

  const observedAt = lastContact !== undefined ? isoFromUnixSeconds(lastContact) : timePosition !== undefined ? isoFromUnixSeconds(timePosition) : observedAtFallback;
  const altitude = geoAltitude ?? baroAltitude;

  const metadata: Record<string, unknown> = {
    icao24,
    on_ground: onGround
  };

  if (callsign) {
    metadata.callsign = callsign;
  }
  if (originCountry) {
    metadata.origin_country = originCountry;
  }
  if (squawk) {
    metadata.squawk = squawk;
  }
  if (spi !== undefined) {
    metadata.spi = spi;
  }
  if (positionSource !== undefined) {
    metadata.position_source = positionSource;
  }

  const entityCandidate: EarthEntity = {
    entity_id: `flight-${icao24}`,
    entity_type: 'flight',
    position: {
      lat,
      lon,
      ...(altitude !== undefined ? { alt: altitude } : {})
    },
    ...(headingDeg !== undefined || speedMps !== undefined || verticalRateMps !== undefined
      ? {
          velocity: {
            ...(headingDeg !== undefined ? { heading_deg: headingDeg } : {}),
            ...(speedMps !== undefined ? { speed_mps: speedMps } : {}),
            ...(verticalRateMps !== undefined ? { vertical_rate_mps: verticalRateMps } : {})
          }
        }
      : {}),
    source: DEFAULT_SOURCE,
    observed_at: observedAt,
    updated_at: updatedAt,
    metadata
  };

  const parsed = earthEntitySchema.safeParse(entityCandidate);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function normalizeOpenSkyStates(payload: unknown, now: Date = new Date()): OpenSkyNormalizeResult {
  const root = payload as { time?: unknown; states?: unknown } | null;
  const states = root && Array.isArray(root.states) ? root.states : [];
  const updatedAt = now.toISOString();
  const sourceTime = toFiniteNumber(root?.time);
  const observedAtFallback = sourceTime !== undefined ? isoFromUnixSeconds(sourceTime) : updatedAt;

  const entities: EarthEntity[] = [];
  let dropped = 0;

  for (const state of states) {
    const entity = normalizeOpenSkyStateVector(state, observedAtFallback, updatedAt);
    if (entity) {
      entities.push(entity);
      continue;
    }

    dropped += 1;
  }

  return { entities, dropped };
}

export function buildOpenSkyAuthorizationHeader(credentials: OpenSkyCredentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function disabledResult(reason: string): OpenSkyFlightsPollDisabled {
  return {
    status: 'disabled',
    source: DEFAULT_SOURCE,
    reason,
    entities: []
  };
}

export function createOpenSkyFlightsAdapter(options: OpenSkyFlightsAdapterOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? DEFAULT_OPENSKY_STATES_URL;
  const now = options.now ?? (() => new Date());
  const source = options.layer.source || DEFAULT_SOURCE;

  async function poll(): Promise<OpenSkyFlightsPollResult> {
    if (!options.layer.enabled) {
      return disabledResult(options.layer.notice ?? 'Flights layer is disabled by runtime configuration.');
    }

    if (!hasOpenSkyCredentials(options.credentials)) {
      return disabledResult('Flights adapter disabled: missing OpenSky credentials.');
    }

    const authHeader = buildOpenSkyAuthorizationHeader(options.credentials);
    const response = await fetchImpl(endpoint, {
      headers: {
        Authorization: authHeader
      }
    });

    if (!response.ok) {
      throw new Error(`OpenSky request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const currentTime = now();
    const normalized = normalizeOpenSkyStates(payload, currentTime);

    return {
      status: 'ok',
      source,
      fetched_at: currentTime.toISOString(),
      entities: normalized.entities,
      dropped: normalized.dropped
    };
  }

  return {
    source,
    poll
  };
}

