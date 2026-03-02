import { describe, expect, it } from 'vitest';
import { buildStreamEvent, SAMPLE_ENTITIES, SAMPLE_FLIGHT_ENTITY } from './fixtures';
import {
  applyStreamEvent,
  clearSelection,
  createEntityInteractionState,
  getSelectedEntity,
  reduceEntityInteractionState,
  selectEntity,
  selectEntityFromPick,
  setFollowMode,
  toggleFollowMode
} from './store';

describe('entity interaction store', () => {
  it('creates empty state by default and indexed state with initial entities', () => {
    const empty = createEntityInteractionState();
    expect(empty.entityIds).toEqual([]);
    expect(empty.selectedEntityId).toBeNull();

    const initialized = createEntityInteractionState(SAMPLE_ENTITIES);
    expect(initialized.entityIds).toEqual(['quake-us7000abcd', 'flight-AAL123']);
    expect(initialized.entities['flight-AAL123']?.source).toBe('opensky');
  });

  it('applies snapshot/upsert/delete stream events and keeps selection valid', () => {
    let state = createEntityInteractionState(SAMPLE_ENTITIES);
    state = selectEntity(state, 'flight-AAL123');
    state = setFollowMode(state, 'follow');

    state = applyStreamEvent(
      state,
      buildStreamEvent({
        event_type: 'entity_upsert',
        entities: [
          {
            ...SAMPLE_FLIGHT_ENTITY,
            updated_at: '2026-03-02T00:00:45.000Z',
            metadata: {
              ...(SAMPLE_FLIGHT_ENTITY.metadata ?? {}),
              destination: 'KSFO'
            }
          }
        ]
      })
    );

    expect(state.entities['flight-AAL123']?.metadata?.destination).toBe('KSFO');
    expect(state.selectedEntityId).toBe('flight-AAL123');
    expect(state.followMode).toBe('follow');

    state = applyStreamEvent(
      state,
      buildStreamEvent({
        event_type: 'entity_delete',
        entity_ids: ['flight-AAL123']
      })
    );

    expect(state.entities['flight-AAL123']).toBeUndefined();
    expect(state.selectedEntityId).toBeNull();
    expect(state.followMode).toBe('off');

    state = applyStreamEvent(
      state,
      buildStreamEvent({
        event_type: 'entity_snapshot',
        entities: [SAMPLE_FLIGHT_ENTITY]
      })
    );

    expect(state.entityIds).toEqual(['flight-AAL123']);
  });

  it('selects entities from pick objects and clears when pick cannot be resolved', () => {
    let state = createEntityInteractionState(SAMPLE_ENTITIES);

    state = selectEntityFromPick(state, {
      primitive: {
        id: {
          entity_id: 'quake-us7000abcd'
        }
      }
    });

    expect(state.selectedEntityId).toBe('quake-us7000abcd');

    state = selectEntityFromPick(state, {
      id: {
        entity_id: 'missing-id'
      }
    });

    expect(state.selectedEntityId).toBeNull();
  });

  it('guards follow mode when no entity is selected', () => {
    let state = createEntityInteractionState(SAMPLE_ENTITIES);

    state = setFollowMode(state, 'follow');
    expect(state.followMode).toBe('off');

    state = selectEntity(state, 'flight-AAL123');
    state = toggleFollowMode(state);
    expect(state.followMode).toBe('follow');

    state = clearSelection(state);
    expect(state.followMode).toBe('off');
  });

  it('supports reducer actions without throwing under rapid selection changes', () => {
    let state = createEntityInteractionState(SAMPLE_ENTITIES);

    const actions = [
      { type: 'select_entity', entityId: 'flight-AAL123' as const },
      { type: 'select_entity', entityId: 'quake-us7000abcd' as const },
      { type: 'select_entity', entityId: null },
      { type: 'select_pick', pick: { id: 'flight-AAL123' } },
      { type: 'select_entity', entityId: 'missing-id' },
      {
        type: 'apply_stream_event',
        event: buildStreamEvent({
          event_type: 'heartbeat',
          status: 'ok'
        })
      }
    ] as const;

    for (const action of actions) {
      state = reduceEntityInteractionState(state, action);
    }

    expect(getSelectedEntity(state)).toBeNull();
    expect(state.followMode).toBe('off');
  });
});
