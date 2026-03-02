import { z } from 'zod';
import { earthEntitySchema, earthEntityTypeSchema } from './entity.js';

export const streamProtocolVersion = '1.0.0' as const;

const streamEventBaseSchema = z
  .object({
    protocol_version: z.literal(streamProtocolVersion),
    sent_at: z.string().datetime()
  })
  .strict();

export const streamBootstrapEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('bootstrap'),
    message: z.string().min(1)
  })
  .strict();

export const streamHeartbeatEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('heartbeat'),
    status: z.enum(['ok', 'degraded'])
  })
  .strict();

export const streamEntityUpsertEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('entity_upsert'),
    entities: z.array(earthEntitySchema).min(1)
  })
  .strict();

export const streamEntitySnapshotEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('entity_snapshot'),
    entities: z.array(earthEntitySchema)
  })
  .strict();

export const streamEntityDeleteEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('entity_delete'),
    entity_ids: z.array(z.string().min(1)).min(1),
    entity_type: earthEntityTypeSchema.optional(),
    source: z.string().min(1).optional()
  })
  .strict();

export const streamErrorEventSchema = streamEventBaseSchema
  .extend({
    event_type: z.literal('error'),
    code: z.string().min(1),
    message: z.string().min(1),
    source: z.string().min(1).optional(),
    recoverable: z.boolean()
  })
  .strict();

export const streamEventSchema = z.discriminatedUnion('event_type', [
  streamBootstrapEventSchema,
  streamHeartbeatEventSchema,
  streamEntityUpsertEventSchema,
  streamEntitySnapshotEventSchema,
  streamEntityDeleteEventSchema,
  streamErrorEventSchema
]);

export type StreamBootstrapEvent = z.infer<typeof streamBootstrapEventSchema>;
export type StreamHeartbeatEvent = z.infer<typeof streamHeartbeatEventSchema>;
export type StreamEntityUpsertEvent = z.infer<typeof streamEntityUpsertEventSchema>;
export type StreamEntitySnapshotEvent = z.infer<typeof streamEntitySnapshotEventSchema>;
export type StreamEntityDeleteEvent = z.infer<typeof streamEntityDeleteEventSchema>;
export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
