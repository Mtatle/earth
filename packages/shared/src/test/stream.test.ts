import { describe, expect, it } from 'vitest';
import { streamEventSchema, streamProtocolVersion } from '../schema/stream.js';

describe('streamEventSchema', () => {
  it('parses a valid entity upsert event', () => {
    const now = new Date().toISOString();
    const result = streamEventSchema.safeParse({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      entities: [
        {
          entity_id: 'flight-abc',
          entity_type: 'flight',
          position: { lat: 30.2672, lon: -97.7431, alt: 10345 },
          source: 'OpenSky',
          observed_at: now,
          updated_at: now,
          metadata: { callsign: 'EARTH1' }
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed event payload', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: 'not-a-date',
      entities: []
    });

    expect(result.success).toBe(false);
  });
});
