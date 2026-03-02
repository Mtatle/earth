import { z } from 'zod';

export const earthEntityTypeSchema = z.enum(['satellite', 'flight', 'quake', 'camera', 'unknown']);

export const earthPositionSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt: z.number().finite().optional()
  })
  .strict();

export const earthVelocitySchema = z
  .object({
    heading_deg: z.number().finite().optional(),
    speed_mps: z.number().finite().optional(),
    vertical_rate_mps: z.number().finite().optional()
  })
  .strict();

export const earthEntitySchema = z.object({
  entity_id: z.string().min(1),
  entity_type: earthEntityTypeSchema,
  position: earthPositionSchema,
  velocity: earthVelocitySchema.optional(),
  source: z.string().min(1),
  observed_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

export type EarthEntity = z.infer<typeof earthEntitySchema>;
