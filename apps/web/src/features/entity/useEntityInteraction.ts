import type { EarthEntity, StreamEvent } from '@earthly/shared';
import { useCallback, useMemo, useReducer } from 'react';
import { buildEntityDetails } from './format';
import {
  createEntityInteractionState,
  getSelectedEntity,
  reduceEntityInteractionState
} from './store';
import type { EntityDetailsViewModel, EntityId, EntityInteractionState, FollowMode } from './types';

export type UseEntityInteractionOptions = {
  initialEntities?: EarthEntity[];
  nowMs?: () => number;
};

export type UseEntityInteractionResult = {
  entities: EntityInteractionState['entities'];
  entityIds: EntityInteractionState['entityIds'];
  selectedEntityId: EntityId | null;
  selectedEntity: EarthEntity | null;
  selectedEntityDetails: EntityDetailsViewModel | null;
  followMode: FollowMode;
  applyStreamEvent: (event: StreamEvent) => void;
  selectEntity: (entityId: EntityId | null) => void;
  selectPick: (pick: unknown) => void;
  clearSelection: () => void;
  toggleFollow: () => void;
  setFollowMode: (followMode: FollowMode) => void;
};

export function useEntityInteraction(options: UseEntityInteractionOptions = {}): UseEntityInteractionResult {
  const nowMs = options.nowMs ?? (() => Date.now());

  const [state, dispatch] = useReducer(
    reduceEntityInteractionState,
    options.initialEntities ?? [],
    createEntityInteractionState
  );

  const selectedEntity = useMemo(() => getSelectedEntity(state), [state]);

  const selectedEntityDetails = useMemo(() => {
    if (!selectedEntity) {
      return null;
    }

    return buildEntityDetails(selectedEntity, nowMs());
  }, [nowMs, selectedEntity]);

  const applyStreamEvent = useCallback((event: StreamEvent) => {
    dispatch({ type: 'apply_stream_event', event });
  }, []);

  const selectEntity = useCallback((entityId: EntityId | null) => {
    dispatch({ type: 'select_entity', entityId });
  }, []);

  const selectPick = useCallback((pick: unknown) => {
    dispatch({ type: 'select_pick', pick });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'clear_selection' });
  }, []);

  const toggleFollow = useCallback(() => {
    dispatch({ type: 'toggle_follow' });
  }, []);

  const setFollowMode = useCallback((followMode: FollowMode) => {
    dispatch({ type: 'set_follow', followMode });
  }, []);

  return {
    entities: state.entities,
    entityIds: state.entityIds,
    selectedEntityId: state.selectedEntityId,
    selectedEntity,
    selectedEntityDetails,
    followMode: state.followMode,
    applyStreamEvent,
    selectEntity,
    selectPick,
    clearSelection,
    toggleFollow,
    setFollowMode
  };
}
