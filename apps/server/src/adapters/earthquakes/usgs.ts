import { earthEntitySchema, type EarthEntity } from '@earthly/shared';
import { z } from 'zod';

export const USGS_EARTHQUAKE_SOURCE = 'USGS Earthquake Hazards Program';
export const DEFAULT_USGS_EARTHQUAKE_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

const usgsFeatureSchema = z
  .object({
    id: z.string().min(1),
    properties: z
      .object({
        mag: z.number().nullable().optional(),
        place: z.string().nullable().optional(),
        time: z.number().nullable().optional(),
        updated: z.number().nullable().optional(),
        type: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        tsunami: z.number().nullable().optional(),
        sig: z.number().nullable().optional(),
        title: z.string().nullable().optional(),
        felt: z.number().nullable().optional(),
        alert: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        detail: z.string().nullable().optional(),
        net: z.string().nullable().optional(),
        code: z.string().nullable().optional()
      })
      .partial()
      .optional(),
    geometry: z
      .object({
        coordinates: z.array(z.number()).min(2)
      })
      .partial()
      .optional()
  })
  .passthrough();

const usgsFeedSchema = z
  .object({
    metadata: z
      .object({
        generated: z.number().optional()
      })
      .partial()
      .optional(),
    features: z.array(usgsFeatureSchema)
  })
  .passthrough();

type UsgsFeature = z.infer<typeof usgsFeatureSchema>;

export interface UsgsEarthquakeFetchOptions {
  feedUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface UsgsEarthquakeSnapshot {
  source: string;
  feed_url: string;
  fetched_at: string;
  generated_at: string | null;
  total_features: number;
  dropped_features: number;
  entities: EarthEntity[];
}

export class UsgsEarthquakeAdapterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'UsgsEarthquakeAdapterError';

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function fetchUsgsEarthquakeSnapshot(
  options: UsgsEarthquakeFetchOptions = {}
): Promise<UsgsEarthquakeSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const feedUrl = options.feedUrl ?? DEFAULT_USGS_EARTHQUAKE_FEED_URL;
  const now = options.now ?? (() => new Date());

  let response: Response;
  try {
    response = await fetchImpl(feedUrl, {
      headers: {
        accept: 'application/geo+json, application/json'
      }
    });
  } catch (error) {
    throw new UsgsEarthquakeAdapterError('USGS request failed before response.', {
      cause: error
    });
  }

  if (!response.ok) {
    throw new UsgsEarthquakeAdapterError(
      `USGS request failed (${response.status} ${response.statusText || 'unknown'}).`
    );
  }

  const payload = await response.json();
  const parsedFeed = usgsFeedSchema.safeParse(payload);
  if (!parsedFeed.success) {
    throw new UsgsEarthquakeAdapterError('USGS payload failed validation.');
  }

  const fetchedAt = now().toISOString();
  const generatedAt = toIsoOrNull(parsedFeed.data.metadata?.generated);

  const entities: EarthEntity[] = [];
  let droppedFeatures = 0;

  for (const feature of parsedFeed.data.features) {
    const normalized = normalizeUsgsEarthquakeFeature(feature, fetchedAt);
    if (normalized) {
      entities.push(normalized);
    } else {
      droppedFeatures += 1;
    }
  }

  return {
    source: USGS_EARTHQUAKE_SOURCE,
    feed_url: feedUrl,
    fetched_at: fetchedAt,
    generated_at: generatedAt,
    total_features: parsedFeed.data.features.length,
    dropped_features: droppedFeatures,
    entities
  };
}

export function normalizeUsgsEarthquakeFeature(feature: UsgsFeature, fetchedAt: string): EarthEntity | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  const depthKm = isFiniteNumber(coordinates[2]) ? coordinates[2] : null;

  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude)) {
    return null;
  }

  const observedAt = toIsoOrFallback(feature.properties?.time, fetchedAt);
  const updatedAt = toIsoOrFallback(feature.properties?.updated, observedAt);
  const altitudeMeters = depthKm === null ? undefined : depthKm * -1000;

  const candidate = {
    entity_id: `usgs:${feature.id}`,
    entity_type: 'quake',
    position: {
      lat: latitude,
      lon: longitude,
      ...(altitudeMeters === undefined ? {} : { alt: altitudeMeters })
    },
    source: USGS_EARTHQUAKE_SOURCE,
    observed_at: observedAt,
    updated_at: updatedAt,
    metadata: buildMetadata(feature, depthKm)
  };

  const parsedEntity = earthEntitySchema.safeParse(candidate);
  return parsedEntity.success ? parsedEntity.data : null;
}

function buildMetadata(feature: UsgsFeature, depthKm: number | null): Record<string, unknown> {
  const properties = feature.properties;

  return {
    magnitude: toFiniteOrNull(properties?.mag),
    depth_km: depthKm,
    place: toStringOrNull(properties?.place),
    event_type: toStringOrNull(properties?.type),
    status: toStringOrNull(properties?.status),
    significance: toFiniteOrNull(properties?.sig),
    tsunami: typeof properties?.tsunami === 'number' ? properties.tsunami === 1 : null,
    felt_reports: toFiniteOrNull(properties?.felt),
    alert: toStringOrNull(properties?.alert),
    title: toStringOrNull(properties?.title),
    usgs_url: toStringOrNull(properties?.url),
    usgs_detail_url: toStringOrNull(properties?.detail),
    network: toStringOrNull(properties?.net),
    code: toStringOrNull(properties?.code)
  };
}

function toIsoOrFallback(value: number | null | undefined, fallback: string): string {
  const isoValue = toIsoOrNull(value);
  return isoValue ?? fallback;
}

function toIsoOrNull(value: number | null | undefined): string | null {
  if (!isFiniteNumber(value) || value <= 0) {
    return null;
  }

  const iso = new Date(value).toISOString();
  return Number.isNaN(new Date(iso).valueOf()) ? null : iso;
}

function toFiniteOrNull(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value : null;
}

function toStringOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
