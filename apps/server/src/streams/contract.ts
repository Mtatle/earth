import { streamEventSchema, type StreamEvent } from '@earthly/shared';
import type { ZodIssue } from 'zod';

export function validateStreamEvent(payload: unknown) {
  return streamEventSchema.safeParse(payload);
}

export function serializeStreamEvent(payload: StreamEvent): string {
  const event = streamEventSchema.parse(payload);
  return `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function summarizeZodIssues(issues: ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length === 0 ? 'root' : issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}
