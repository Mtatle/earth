import type {
  EarthEntity,
  StreamBootstrapEvent,
  StreamEntityDeleteEvent,
  StreamEntitySnapshotEvent,
  StreamEntityUpsertEvent,
  StreamErrorEvent,
  StreamEvent,
  StreamHeartbeatEvent
} from '@earthly/shared';

export const SAMPLE_FLIGHT_ENTITY: EarthEntity = {
  entity_id: 'flight-AAL123',
  entity_type: 'flight',
  position: {
    lat: 40.641,
    lon: -73.778,
    alt: 10_668
  },
  velocity: {
    heading_deg: 78,
    speed_mps: 238,
    vertical_rate_mps: -2.1
  },
  source: 'opensky',
  observed_at: '2026-03-02T00:00:00.000Z',
  updated_at: '2026-03-02T00:00:00.000Z',
  confidence: 0.93,
  metadata: {
    callsign: 'AAL123',
    origin: 'KJFK',
    destination: 'KLAX'
  }
};

export const SAMPLE_QUAKE_ENTITY: EarthEntity = {
  entity_id: 'quake-us7000abcd',
  entity_type: 'quake',
  position: {
    lat: 37.122,
    lon: -121.504,
    alt: -8_500
  },
  source: 'usgs',
  observed_at: '2026-03-02T00:00:30.000Z',
  updated_at: '2026-03-02T00:00:35.000Z',
  metadata: {
    magnitude: 4.8,
    place: '12km NW of San Jose'
  }
};

export const SAMPLE_ENTITIES: EarthEntity[] = [SAMPLE_FLIGHT_ENTITY, SAMPLE_QUAKE_ENTITY];

type StreamEventInput =
  | Omit<StreamBootstrapEvent, 'protocol_version' | 'sent_at'>
  | Omit<StreamHeartbeatEvent, 'protocol_version' | 'sent_at'>
  | Omit<StreamEntityUpsertEvent, 'protocol_version' | 'sent_at'>
  | Omit<StreamEntitySnapshotEvent, 'protocol_version' | 'sent_at'>
  | Omit<StreamEntityDeleteEvent, 'protocol_version' | 'sent_at'>
  | Omit<StreamErrorEvent, 'protocol_version' | 'sent_at'>;

const STREAM_PROTOCOL_VERSION = '1.0.0' as const;

export function buildStreamEvent(event: StreamEventInput): StreamEvent {
  return {
    protocol_version: STREAM_PROTOCOL_VERSION,
    sent_at: '2026-03-02T00:00:00.000Z',
    ...event
  };
}
