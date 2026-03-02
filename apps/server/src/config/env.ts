import { z } from 'zod';

export type LayerKey = 'satellites' | 'flights' | 'earthquakes';

export type LayerHealth = 'live' | 'off';

export interface LayerRuntimeConfig {
  key: LayerKey;
  label: string;
  enabled: boolean;
  health: LayerHealth;
  source: string;
  notice: string | null;
  requiresCredentials: boolean;
}

export interface RuntimeConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  strictAdapterKeys: boolean;
  credentials: {
    opensky: {
      username: string;
      password: string;
    } | null;
    adsbxApiKey: string | null;
  };
  layers: Record<LayerKey, LayerRuntimeConfig>;
}

const BOOL_TRUE = new Set(['1', 'true', 'yes', 'on']);
const BOOL_FALSE = new Set(['0', 'false', 'no', 'off']);

function booleanFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (BOOL_TRUE.has(normalized)) {
        return true;
      }
      if (BOOL_FALSE.has(normalized)) {
        return false;
      }
    }
    return value;
  }, z.boolean());
}

const optionalSecret = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 'development';
      }
      return value;
    },
    z.enum(['development', 'test', 'production'])
  ),
  PORT: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 4000;
      }
      return value;
    },
    z.coerce.number().int().min(1).max(65535)
  ),
  STRICT_ADAPTER_KEYS: booleanFromEnv(false),
  ENABLE_LAYER_SATELLITES: booleanFromEnv(true),
  ENABLE_LAYER_FLIGHTS: booleanFromEnv(true),
  ENABLE_LAYER_EARTHQUAKES: booleanFromEnv(true),
  OPENSKY_USERNAME: optionalSecret,
  OPENSKY_PASSWORD: optionalSecret,
  ADSBX_API_KEY: optionalSecret
});

type ParsedEnv = z.infer<typeof envSchema>;

export class RuntimeConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'RuntimeConfigError';
    this.issues = issues;
  }
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new RuntimeConfigError(issues);
  }

  return mapToRuntimeConfig(parsed.data);
}

function mapToRuntimeConfig(env: ParsedEnv): RuntimeConfig {
  const hasOpenSkyUsername = Boolean(env.OPENSKY_USERNAME);
  const hasOpenSkyPassword = Boolean(env.OPENSKY_PASSWORD);
  const hasOpenSkyCredentials = hasOpenSkyUsername && hasOpenSkyPassword;
  const hasAdsbxKey = Boolean(env.ADSBX_API_KEY);
  const flightsHasCredentials = hasOpenSkyCredentials || hasAdsbxKey;

  const issues: string[] = [];

  if (hasOpenSkyUsername !== hasOpenSkyPassword) {
    issues.push('Set both OPENSKY_USERNAME and OPENSKY_PASSWORD together, or leave both empty.');
  }

  if (env.STRICT_ADAPTER_KEYS && env.ENABLE_LAYER_FLIGHTS && !flightsHasCredentials) {
    issues.push(
      'ENABLE_LAYER_FLIGHTS=true requires OPENSKY_USERNAME/OPENSKY_PASSWORD or ADSBX_API_KEY when STRICT_ADAPTER_KEYS=true.'
    );
  }

  if (issues.length > 0) {
    throw new RuntimeConfigError(issues);
  }

  const satellites: LayerRuntimeConfig = {
    key: 'satellites',
    label: 'Satellites',
    enabled: env.ENABLE_LAYER_SATELLITES,
    health: env.ENABLE_LAYER_SATELLITES ? 'live' : 'off',
    source: 'CelesTrak / NORAD public catalogs',
    notice: env.ENABLE_LAYER_SATELLITES ? null : 'Disabled by ENABLE_LAYER_SATELLITES=false.',
    requiresCredentials: false
  };

  let flightsNotice: string | null = null;
  let flightsEnabled = env.ENABLE_LAYER_FLIGHTS;

  if (!env.ENABLE_LAYER_FLIGHTS) {
    flightsNotice = 'Disabled by ENABLE_LAYER_FLIGHTS=false.';
  } else if (!flightsHasCredentials) {
    flightsEnabled = false;
    flightsNotice =
      'Disabled in demo mode: set OPENSKY_USERNAME/OPENSKY_PASSWORD or ADSBX_API_KEY to enable live flight data.';
  }

  const flights: LayerRuntimeConfig = {
    key: 'flights',
    label: 'Flights',
    enabled: flightsEnabled,
    health: flightsEnabled ? 'live' : 'off',
    source: hasAdsbxKey ? 'ADSB Exchange API' : 'OpenSky Network',
    notice: flightsNotice,
    requiresCredentials: true
  };

  const earthquakes: LayerRuntimeConfig = {
    key: 'earthquakes',
    label: 'Earthquakes',
    enabled: env.ENABLE_LAYER_EARTHQUAKES,
    health: env.ENABLE_LAYER_EARTHQUAKES ? 'live' : 'off',
    source: 'USGS Earthquake Hazards Program',
    notice: env.ENABLE_LAYER_EARTHQUAKES ? null : 'Disabled by ENABLE_LAYER_EARTHQUAKES=false.',
    requiresCredentials: false
  };

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    strictAdapterKeys: env.STRICT_ADAPTER_KEYS,
    credentials: {
      opensky: hasOpenSkyCredentials
        ? {
            username: env.OPENSKY_USERNAME!,
            password: env.OPENSKY_PASSWORD!
          }
        : null,
      adsbxApiKey: env.ADSBX_API_KEY ?? null
    },
    layers: {
      satellites,
      flights,
      earthquakes
    }
  };
}
