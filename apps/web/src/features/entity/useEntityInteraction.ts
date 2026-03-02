import type { EarthEntity, StreamEvent } from '@earthly/shared';
import { useMemo, useReducer } from 'react';
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

  return {
    entities: state.entities,
    entityIds: state.entityIds,
    selectedEntityId: state.selectedEntityId,
    selectedEntity,
    selectedEntityDetails,
    followMode: state.followMode,
    applyStreamEvent: (event) => dispatch({ type: 'apply_stream_event', event }),
    selectEntity: (entityId) => dispatch({ type: 'select_entity', entityId }),
    selectPick: (pick) => dispatch({ type: 'select_pick', pick }),
    clearSelection: () => dispatch({ type: 'clear_selection' }),
    toggleFollow: () => dispatch({ type: 'toggle_follow' }),
    setFollowMode: (followMode) => dispatch({ type: 'set_follow', followMode })
  };
}
