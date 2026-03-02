import { earthEntitySchema, type EarthEntity } from '@earthly/shared';
import { z } from 'zod';

export const CELESTRAK_ACTIVE_CATALOG_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';

const DEFAULT_SOURCE = 'CelesTrak / NORAD public catalogs';

export interface SatelliteAdapterLogger {
  warn: (message: string, context?: Record<string, unknown>) => void;
}

export interface NormalizeSatelliteOptions {
  receivedAt?: Date;
  source?: string;
}

export interface NormalizeSatelliteCatalogOptions extends NormalizeSatelliteOptions {
  logger?: SatelliteAdapterLogger;
  maxEntities?: number;
}

export interface FetchSatelliteEntitiesOptions extends NormalizeSatelliteCatalogOptions {
  fetchImpl?: typeof fetch;
  url?: string;
  signal?: AbortSignal;
}

export interface SatellitePollingJobOptions extends FetchSatelliteEntitiesOptions {
  intervalMs: number;
  onBatch: (entities: EarthEntity[]) => void | Promise<void>;
  onError?: (error: unknown) => void;
  runImmediately?: boolean;
}

const noopLogger: SatelliteAdapterLogger = {
  warn: () => undefined
};

const numberFieldSchema = z.preprocess((value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite());

const nonEmptyStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1));

const optionalNonEmptyStringSchema = nonEmptyStringSchema.optional();

const rawSatelliteRecordSchema = z
  .object({
    NORAD_CAT_ID: z.union([nonEmptyStringSchema, z.number().int().nonnegative()]).optional(),
    OBJECT_NAME: optionalNonEmptyStringSchema,
    OBJECT_ID: optionalNonEmptyStringSchema,
    EPOCH: optionalNonEmptyStringSchema,
    TLE_LINE0: optionalNonEmptyStringSchema,
    TLE_LINE1: optionalNonEmptyStringSchema,
    TLE_LINE2: optionalNonEmptyStringSchema,
    OBJECT_TYPE: optionalNonEmptyStringSchema,
    RCS_SIZE: optionalNonEmptyStringSchema,
    COUNTRY_CODE: optionalNonEmptyStringSchema,
    LAUNCH_DATE: optionalNonEmptyStringSchema,
    DECAY_DATE: optionalNonEmptyStringSchema,
    latitude: numberFieldSchema.optional(),
    longitude: numberFieldSchema.optional(),
    altitude_km: numberFieldSchema.optional(),
    velocity_kms: numberFieldSchema.optional(),
    LAT: numberFieldSchema.optional(),
    LON: numberFieldSchema.optional(),
    ALT: numberFieldSchema.optional(),
    VELOCITY: numberFieldSchema.optional()
  })
  .passthrough();

export type RawSatelliteRecord = z.infer<typeof rawSatelliteRecordSchema>;

const rawCatalogPayloadSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()) }),
  z.object({ satellites: z.array(z.unknown()) })
]);

function pickFirstNumber(...values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function parseIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function slugifyIdPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function deriveEntityId(record: RawSatelliteRecord): string | null {
  if (record.NORAD_CAT_ID !== undefined) {
    const norad = String(record.NORAD_CAT_ID).trim();
    if (norad.length > 0) {
      return `sat-${norad}`;
    }
  }

  if (record.OBJECT_ID) {
    const slug = slugifyIdPart(record.OBJECT_ID);
    if (slug.length > 0) {
      return `sat-object-${slug}`;
    }
  }

  if (record.OBJECT_NAME) {
    const slug = slugifyIdPart(record.OBJECT_NAME);
    if (slug.length > 0) {
      return `sat-name-${slug}`;
    }
  }

  return null;
}

function compactMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null)
  );
}

function unpackCatalogPayload(payload: unknown): unknown[] {
  const parsed = rawCatalogPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      'Invalid CelesTrak payload. Expected an array or an object containing data/satellites arrays.'
    );
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }

  if ('data' in parsed.data) {
    return parsed.data.data;
  }

  return parsed.data.satellites;
}

export function normalizeCelestrakSatellite(
  record: RawSatelliteRecord,
  options: NormalizeSatelliteOptions = {}
): EarthEntity | null {
  const lat = pickFirstNumber(record.latitude, record.LAT);
  const lon = pickFirstNumber(record.longitude, record.LON);
  const entityId = deriveEntityId(record);

  if (lat === undefined || lon === undefined || !entityId) {
    return null;
  }

  const altitudeKm = pickFirstNumber(record.altitude_km, record.ALT);
  const velocityKmPerSecond = pickFirstNumber(record.velocity_kms, record.VELOCITY);
  const receivedAt = options.receivedAt ?? new Date();
  const observedAt = parseIsoDate(record.EPOCH) ?? receivedAt.toISOString();

  const candidateEntity: EarthEntity = {
    entity_id: entityId,
    entity_type: 'satellite',
    position: {
      lat,
      lon,
      ...(altitudeKm === undefined ? {} : { alt: altitudeKm * 1000 })
    },
    ...(velocityKmPerSecond === undefined
      ? {}
      : {
          velocity: {
            speed_mps: velocityKmPerSecond * 1000
          }
        }),
    source: options.source ?? DEFAULT_SOURCE,
    observed_at: observedAt,
    updated_at: receivedAt.toISOString(),
    metadata: compactMetadata({
      object_name: record.OBJECT_NAME,
      object_id: record.OBJECT_ID,
      norad_cat_id:
        record.NORAD_CAT_ID === undefined ? undefined : String(record.NORAD_CAT_ID).trim(),
      object_type: record.OBJECT_TYPE,
      country_code: record.COUNTRY_CODE,
      rcs_size: record.RCS_SIZE,
      launch_date: record.LAUNCH_DATE,
      decay_date: record.DECAY_DATE,
      tle_line0: record.TLE_LINE0,
      tle_line1: record.TLE_LINE1,
      tle_line2: record.TLE_LINE2
    })
  };

  const parsedEntity = earthEntitySchema.safeParse(candidateEntity);
  return parsedEntity.success ? parsedEntity.data : null;
}

export function normalizeCelestrakCatalog(
  records: unknown[],
  options: NormalizeSatelliteCatalogOptions = {}
): EarthEntity[] {
  const logger = options.logger ?? noopLogger;
  const receivedAt = options.receivedAt ?? new Date();
  const normalizedEntities: EarthEntity[] = [];

  for (let index = 0; index < records.length; index += 1) {
    if (options.maxEntities !== undefined && normalizedEntities.length >= options.maxEntities) {
      break;
    }

    const parsedRecord = rawSatelliteRecordSchema.safeParse(records[index]);
    if (!parsedRecord.success) {
      logger.warn('satellite_record_rejected', {
        index,
        reason: 'invalid_record_shape'
      });
      continue;
    }

    const entity = normalizeCelestrakSatellite(parsedRecord.data, {
      receivedAt,
      source: options.source
    });

    if (!entity) {
      logger.warn('satellite_record_rejected', {
        index,
        reason: 'failed_normalization'
      });
      continue;
    }

    normalizedEntities.push(entity);
  }

  return normalizedEntities;
}

export async function fetchSatelliteEntities(
  options: FetchSatelliteEntitiesOptions = {}
): Promise<EarthEntity[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? CELESTRAK_ACTIVE_CATALOG_URL;

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json'
    },
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`CelesTrak request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rawRecords = unpackCatalogPayload(payload);

  return normalizeCelestrakCatalog(rawRecords, options);
}

export function startSatellitePollingJob(options: SatellitePollingJobOptions): () => void {
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('intervalMs must be a positive number.');
  }

  const {
    intervalMs,
    onBatch,
    onError,
    runImmediately = true,
    fetchImpl,
    logger,
    maxEntities,
    receivedAt,
    signal,
    source,
    url
  } = options;

  let stopped = false;

  const tick = async () => {
    if (stopped) {
      return;
    }

    try {
      const entities = await fetchSatelliteEntities({
        fetchImpl,
        logger,
        maxEntities,
        receivedAt,
        signal,
        source,
        url
      });
      if (!stopped) {
        await onBatch(entities);
      }
    } catch (error) {
      if (!stopped) {
        onError?.(error);
      }
    }
  };

  if (runImmediately) {
    void tick();
  }

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
