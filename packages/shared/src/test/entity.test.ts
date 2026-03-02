import { describe, expect, it } from 'vitest';
import { earthEntitySchema } from '../schema/entity.js';

describe('earthEntitySchema', () => {
  it('parses a valid flight entity', () => {
    const now = new Date().toISOString();

    const result = earthEntitySchema.safeParse({
      entity_id: 'flight-abc',
      entity_type: 'flight',
      position: { lat: 30.2672, lon: -97.7431, alt: 10345 },
      source: 'OpenSky',
      observed_at: now,
      updated_at: now,
      metadata: { callsign: 'EARTH1' }
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed coordinates', () => {
    const now = new Date().toISOString();

    const result = earthEntitySchema.safeParse({
      entity_id: 'flight-abc',
      entity_type: 'flight',
      position: { lat: 181, lon: -97.7431 },
      source: 'OpenSky',
      observed_at: now,
      updated_at: now
    });

    expect(result.success).toBe(false);
  });
});
