import type { EarthEntity } from '@earthly/shared';
import type { EntityDetailsViewModel } from './types';

export function buildEntityDetails(entity: EarthEntity, nowMs: number = Date.now()): EntityDetailsViewModel {
  const fields = [
    { label: 'Entity ID', value: entity.entity_id, monospace: true },
    { label: 'Type', value: entity.entity_type },
    { label: 'Source', value: entity.source },
    { label: 'Position', value: formatPosition(entity.position.lat, entity.position.lon) },
    { label: 'Altitude', value: formatAltitude(entity.position.alt) },
    { label: 'Heading', value: formatHeading(entity.velocity?.heading_deg) },
    { label: 'Speed', value: formatSpeed(entity.velocity?.speed_mps) },
    { label: 'Vertical Rate', value: formatVerticalRate(entity.velocity?.vertical_rate_mps) },
    { label: 'Observed', value: formatTimestamp(entity.observed_at, nowMs), monospace: true },
    { label: 'Updated', value: formatTimestamp(entity.updated_at, nowMs), monospace: true },
    { label: 'Confidence', value: formatConfidence(entity.confidence) }
  ];

  const metadataEntries = Object.entries(entity.metadata ?? {}).sort(([left], [right]) => left.localeCompare(right));

  return {
    title: `${entity.entity_type.toUpperCase()} · ${entity.entity_id}`,
    subtitle: `Source ${entity.source}`,
    fields,
    metadataFields: metadataEntries.map(([key, value]) => ({
      label: key,
      value: stringifyMetadataValue(value),
      monospace: typeof value !== 'number' && typeof value !== 'boolean'
    }))
  };
}

export function formatTimestamp(timestamp: string, nowMs: number = Date.now()): string {
  const parsedMs = Date.parse(timestamp);
  if (Number.isNaN(parsedMs)) {
    return 'invalid timestamp';
  }

  const ageSeconds = Math.floor((nowMs - parsedMs) / 1000);
  const ageLabel = formatAge(ageSeconds);

  return `${timestamp} (${ageLabel})`;
}

function formatPosition(latitude: number, longitude: number): string {
  const latLabel = `${Math.abs(latitude).toFixed(3)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lonLabel = `${Math.abs(longitude).toFixed(3)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${latLabel}, ${lonLabel}`;
}

function formatAltitude(altitude?: number): string {
  if (typeof altitude !== 'number' || Number.isNaN(altitude)) {
    return 'n/a';
  }

  return `${Math.round(altitude).toLocaleString()} m`;
}

function formatHeading(heading?: number): string {
  if (typeof heading !== 'number' || Number.isNaN(heading)) {
    return 'n/a';
  }

  const normalized = ((heading % 360) + 360) % 360;
  return `${normalized.toFixed(1)}°`;
}

function formatSpeed(speedMps?: number): string {
  if (typeof speedMps !== 'number' || Number.isNaN(speedMps)) {
    return 'n/a';
  }

  const knots = speedMps * 1.94384;
  return `${Math.round(speedMps)} m/s (${Math.round(knots)} kt)`;
}

function formatVerticalRate(verticalRateMps?: number): string {
  if (typeof verticalRateMps !== 'number' || Number.isNaN(verticalRateMps)) {
    return 'n/a';
  }

  return `${verticalRateMps.toFixed(1)} m/s`;
}

function formatConfidence(confidence?: number): string {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'n/a';
  }

  return `${Math.round(confidence * 100)}%`;
}

function formatAge(ageSeconds: number): string {
  if (ageSeconds < 0) {
    return 'in the future';
  }

  if (ageSeconds < 5) {
    return 'just now';
  }

  if (ageSeconds < 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours}h ago`;
}

function stringifyMetadataValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
