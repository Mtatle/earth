import { streamProtocolVersion, type StreamEvent } from '@earthly/shared';
import { describe, expect, it } from 'vitest';
import { serializeStreamEvent, validateStreamEvent } from '../streams/contract.js';

describe('stream contract utilities', () => {
  it('serializes a valid stream event as SSE frame', () => {
    const now = new Date().toISOString();
    const event: StreamEvent = {
      event_type: 'heartbeat',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      status: 'ok'
    };

    const serialized = serializeStreamEvent(event);

    expect(serialized.startsWith('event: heartbeat\n')).toBe(true);
    expect(serialized.includes(`"protocol_version":"${streamProtocolVersion}"`)).toBe(true);
    expect(serialized.endsWith('\n\n')).toBe(true);
  });

  it('rejects malformed stream payloads', () => {
    const result = validateStreamEvent({
      event_type: 'entity_upsert',
      protocol_version: streamProtocolVersion,
      sent_at: 'not-a-date',
      entities: []
    });

    expect(result.success).toBe(false);
  });
});
