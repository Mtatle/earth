import type { EntityId } from './types';

type UnknownRecord = Record<string, unknown>;

export function extractEntityIdFromPick(pick: unknown): EntityId | null {
  if (!isRecord(pick)) {
    return null;
  }

  const candidateIds: unknown[] = [
    pick,
    pick.id,
    pick.primitive,
    isRecord(pick.primitive) ? pick.primitive.id : undefined,
    isRecord(pick.collection) ? pick.collection.id : undefined
  ];

  for (const candidate of candidateIds) {
    const entityId = coerceEntityId(candidate);
    if (entityId) {
      return entityId;
    }
  }

  return null;
}

export function coerceEntityId(value: unknown, depth: number = 0): EntityId | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directCandidates = [
    value.entity_id,
    value.entityId,
    value.id,
    value.value,
    isRecord(value.properties) ? value.properties.entity_id : undefined,
    isRecord(value.properties) ? value.properties.id : undefined
  ];

  for (const candidate of directCandidates) {
    const resolved = coerceEntityId(candidate, depth + 1);
    if (resolved) {
      return resolved;
    }
  }

  const valueWithGetter = value as { getValue?: (time?: unknown) => unknown };
  if (typeof valueWithGetter.getValue === 'function') {
    try {
      const resolved = coerceEntityId(valueWithGetter.getValue(), depth + 1);
      if (resolved) {
        return resolved;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}
