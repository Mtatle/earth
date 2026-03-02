import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildStreamEvent, SAMPLE_ENTITIES, SAMPLE_FLIGHT_ENTITY, SAMPLE_QUAKE_ENTITY } from './fixtures';
import { useEntityInteraction } from './useEntityInteraction';

describe('useEntityInteraction', () => {
  it('selects entity and returns formatted detail model', () => {
    const { result } = renderHook(() =>
      useEntityInteraction({
        initialEntities: SAMPLE_ENTITIES,
        nowMs: () => Date.parse('2026-03-02T00:01:00.000Z')
      })
    );

    act(() => {
      result.current.selectEntity('flight-AAL123');
    });

    expect(result.current.selectedEntityId).toBe('flight-AAL123');
    expect(result.current.selectedEntity?.source).toBe('opensky');
    expect(result.current.selectedEntityDetails?.title).toContain('FLIGHT · flight-AAL123');
    expect(result.current.selectedEntityDetails?.fields.find((field) => field.label === 'Observed')?.value).toContain(
      '(1m ago)'
    );
  });

  it('supports pick selection and follow mode toggling', () => {
    const { result } = renderHook(() => useEntityInteraction({ initialEntities: SAMPLE_ENTITIES }));

    act(() => {
      result.current.selectPick({
        primitive: {
          id: {
            entity_id: 'quake-us7000abcd'
          }
        }
      });
    });

    expect(result.current.selectedEntityId).toBe('quake-us7000abcd');

    act(() => {
      result.current.toggleFollow();
    });

    expect(result.current.followMode).toBe('follow');

    act(() => {
      result.current.toggleFollow();
    });

    expect(result.current.followMode).toBe('off');
  });

  it('clears selection if selected entity is removed by stream event', () => {
    const { result } = renderHook(() => useEntityInteraction({ initialEntities: SAMPLE_ENTITIES }));

    act(() => {
      result.current.selectEntity('flight-AAL123');
      result.current.setFollowMode('follow');
    });

    act(() => {
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'entity_delete',
          entity_ids: ['flight-AAL123']
        })
      );
    });

    expect(result.current.selectedEntityId).toBeNull();
    expect(result.current.followMode).toBe('off');
  });

  it('handles rapid selection changes without throwing', () => {
    const { result } = renderHook(() => useEntityInteraction({ initialEntities: SAMPLE_ENTITIES }));

    expect(() => {
      act(() => {
        result.current.selectEntity('flight-AAL123');
        result.current.selectEntity('quake-us7000abcd');
        result.current.selectEntity('missing-id');
        result.current.selectPick({ id: 'flight-AAL123' });
        result.current.selectPick({ id: '' });
        result.current.clearSelection();
      });
    }).not.toThrow();

    expect(result.current.selectedEntityId).toBeNull();
  });

  it('applies entity snapshot and upsert events in order', () => {
    const { result } = renderHook(() => useEntityInteraction());

    act(() => {
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'entity_snapshot',
          entities: [SAMPLE_QUAKE_ENTITY]
        })
      );
    });

    expect(result.current.entityIds).toEqual(['quake-us7000abcd']);

    act(() => {
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'entity_upsert',
          entities: [SAMPLE_FLIGHT_ENTITY]
        })
      );
    });

    expect(result.current.entityIds).toEqual(['quake-us7000abcd', 'flight-AAL123']);
  });

  it('keeps stable state on non-entity stream events', () => {
    const { result } = renderHook(() => useEntityInteraction({ initialEntities: SAMPLE_ENTITIES }));
    const before = result.current.entityIds;

    act(() => {
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'bootstrap',
          message: 'ready'
        })
      );
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'heartbeat',
          status: 'ok'
        })
      );
      result.current.applyStreamEvent(
        buildStreamEvent({
          event_type: 'error',
          code: 'ADAPTER_DOWN',
          message: 'Source unavailable',
          recoverable: true,
          source: 'opensky'
        })
      );
    });

    expect(result.current.entityIds).toEqual(before);
  });
});
