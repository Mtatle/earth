import { describe, expect, it } from 'vitest';
import { streamEventSchema, streamProtocolVersion } from '../schema/stream.js';

describe('streamEventSchema', () => {
  const now = new Date().toISOString();
  const entity = {
    entity_id: 'flight-abc',
    entity_type: 'flight' as const,
    position: { lat: 30.2672, lon: -97.7431, alt: 10345 },
    source: 'OpenSky',
    observed_at: now,
    updated_at: now,
    metadata: { callsign: 'EARTH1' }
  };

  it('parses bootstrap events', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'bootstrap',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      message: 'stream connected'
    });

    expect(result.success).toBe(true);
  });

  it('parses heartbeat events', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'heartbeat',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      status: 'degraded'
    });

    expect(result.success).toBe(true);
  });

  it('parses a valid entity upsert event', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      entities: [entity]
    });

    expect(result.success).toBe(true);
  });

  it('parses entity snapshot events', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_snapshot',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      entities: [entity]
    });

    expect(result.success).toBe(true);
  });

  it('parses entity delete events', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_delete',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      entity_ids: ['flight-abc'],
      entity_type: 'flight',
      source: 'OpenSky'
    });

    expect(result.success).toBe(true);
  });

  it('parses error events', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'error',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      code: 'adapter_timeout',
      message: 'OpenSky polling timed out',
      source: 'OpenSky',
      recoverable: true
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed payloads', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: 'not-a-date',
      entities: []
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown protocol versions', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'heartbeat',
      protocol_version: '2.0.0',
      sent_at: now,
      status: 'ok'
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown event types', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_patch',
      protocol_version: streamProtocolVersion,
      sent_at: now
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected extra properties', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'heartbeat',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      status: 'ok',
      extra: 'not-allowed'
    });

    expect(result.success).toBe(false);
  });

  it('rejects entity delete with empty ids', () => {
    const result = streamEventSchema.safeParse({
      event_type: 'entity_delete',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      entity_ids: []
    });

    expect(result.success).toBe(false);
  });
});
