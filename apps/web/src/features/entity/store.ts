import type { EarthEntity, StreamEvent } from '@earthly/shared';
import { extractEntityIdFromPick } from './pick';
import type { EntityId, EntityInteractionAction, EntityInteractionState, EntityMap, FollowMode } from './types';

export function createEntityInteractionState(initialEntities: EarthEntity[] = []): EntityInteractionState {
  const entities = indexEntities(initialEntities);

  return {
    entities,
    entityIds: sortEntityIds(entities),
    selectedEntityId: null,
    followMode: 'off'
  };
}

export function reduceEntityInteractionState(
  state: EntityInteractionState,
  action: EntityInteractionAction
): EntityInteractionState {
  switch (action.type) {
    case 'apply_stream_event':
      return applyStreamEvent(state, action.event);
    case 'select_entity':
      return selectEntity(state, action.entityId);
    case 'select_pick':
      return selectEntityFromPick(state, action.pick);
    case 'clear_selection':
      return clearSelection(state);
    case 'toggle_follow':
      return toggleFollowMode(state);
    case 'set_follow':
      return setFollowMode(state, action.followMode);
    default:
      return state;
  }
}

export function applyStreamEvent(state: EntityInteractionState, event: StreamEvent): EntityInteractionState {
  if (event.event_type === 'entity_snapshot') {
    return withEntities(state, indexEntities(event.entities));
  }

  if (event.event_type === 'entity_upsert') {
    const nextEntities = {
      ...state.entities,
      ...indexEntities(event.entities)
    };

    return withEntities(state, nextEntities);
  }

  if (event.event_type === 'entity_delete') {
    const nextEntities: EntityMap = { ...state.entities };

    for (const entityId of event.entity_ids) {
      delete nextEntities[entityId];
    }

    return withEntities(state, nextEntities);
  }

  return state;
}

export function selectEntity(state: EntityInteractionState, entityId: EntityId | null): EntityInteractionState {
  if (!entityId || !state.entities[entityId]) {
    return clearSelection(state);
  }

  return {
    ...state,
    selectedEntityId: entityId
  };
}

export function selectEntityFromPick(state: EntityInteractionState, pick: unknown): EntityInteractionState {
  const entityId = extractEntityIdFromPick(pick);

  return selectEntity(state, entityId);
}

export function clearSelection(state: EntityInteractionState): EntityInteractionState {
  if (state.selectedEntityId === null && state.followMode === 'off') {
    return state;
  }

  return {
    ...state,
    selectedEntityId: null,
    followMode: 'off'
  };
}

export function setFollowMode(state: EntityInteractionState, followMode: FollowMode): EntityInteractionState {
  if (!state.selectedEntityId && followMode === 'follow') {
    return {
      ...state,
      followMode: 'off'
    };
  }

  if (state.followMode === followMode) {
    return state;
  }

  return {
    ...state,
    followMode
  };
}

export function toggleFollowMode(state: EntityInteractionState): EntityInteractionState {
  if (!state.selectedEntityId) {
    return {
      ...state,
      followMode: 'off'
    };
  }

  return {
    ...state,
    followMode: state.followMode === 'follow' ? 'off' : 'follow'
  };
}

export function getSelectedEntity(state: EntityInteractionState): EarthEntity | null {
  const selectedEntityId = state.selectedEntityId;
  if (!selectedEntityId) {
    return null;
  }

  return state.entities[selectedEntityId] ?? null;
}

function withEntities(state: EntityInteractionState, entities: EntityMap): EntityInteractionState {
  const selectedEntityId = state.selectedEntityId && entities[state.selectedEntityId] ? state.selectedEntityId : null;

  return {
    ...state,
    entities,
    entityIds: sortEntityIds(entities),
    selectedEntityId,
    followMode: selectedEntityId ? state.followMode : 'off'
  };
}

function indexEntities(entities: EarthEntity[]): EntityMap {
  const indexed: EntityMap = {};

  for (const entity of entities) {
    indexed[entity.entity_id] = entity;
  }

  return indexed;
}

function sortEntityIds(entities: EntityMap): EntityId[] {
  return Object.values(entities)
    .sort((left, right) => {
      const byUpdatedAt = right.updated_at.localeCompare(left.updated_at);
      if (byUpdatedAt !== 0) {
        return byUpdatedAt;
      }

      return left.entity_id.localeCompare(right.entity_id);
    })
    .map((entity) => entity.entity_id);
}
