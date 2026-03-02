import { describe, expect, it } from 'vitest';
import { coerceEntityId, extractEntityIdFromPick } from './pick';

describe('entity pick helpers', () => {
  it('coerces entity IDs from common string/object shapes', () => {
    expect(coerceEntityId(' flight-AAL123 ')).toBe('flight-AAL123');
    expect(coerceEntityId({ entity_id: 'sat-25544' })).toBe('sat-25544');
    expect(coerceEntityId({ id: 'quake-us7000abcd' })).toBe('quake-us7000abcd');
    expect(coerceEntityId({ properties: { entity_id: 'flight-DAL77' } })).toBe('flight-DAL77');
    expect(coerceEntityId(123)).toBeNull();
  });

  it('extracts entity ID from Cesium-like picked objects', () => {
    expect(extractEntityIdFromPick({ id: 'flight-AAL123' })).toBe('flight-AAL123');
    expect(extractEntityIdFromPick({ primitive: { id: { entity_id: 'quake-us7000abcd' } } })).toBe('quake-us7000abcd');
    expect(
      extractEntityIdFromPick({
        id: {
          properties: {
            entity_id: {
              getValue: () => 'sat-25544'
            }
          }
        }
      })
    ).toBe('sat-25544');

    expect(extractEntityIdFromPick({ primitive: {} })).toBeNull();
    expect(extractEntityIdFromPick(null)).toBeNull();
  });
});
