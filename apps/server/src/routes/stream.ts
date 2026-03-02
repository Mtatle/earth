import { streamProtocolVersion, type StreamEvent } from '@earthly/shared';
import { Router, type Response } from 'express';
import { serializeStreamEvent, summarizeZodIssues, validateStreamEvent } from '../streams/contract.js';

const HEARTBEAT_INTERVAL_MS = 10000;

export interface StreamLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface StreamRouterOptions {
  logger?: StreamLogger;
}

const defaultLogger: StreamLogger = {
  info(message, context) {
    console.info(`[stream] ${message}`, context ?? {});
  },
  warn(message, context) {
    console.warn(`[stream] ${message}`, context ?? {});
  }
};

export function createStreamRouter(options: StreamRouterOptions = {}) {
  const router = Router();
  const clients = new Set<Response>();
  const logger = options.logger ?? defaultLogger;

  const broadcast = (event: StreamEvent): number => {
    const serializedEvent = serializeStreamEvent(event);
    for (const client of clients) {
      client.write(serializedEvent);
    }
    return clients.size;
  };

  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.add(res);

    const now = new Date().toISOString();
    const bootstrapEvent: StreamEvent = {
      event_type: 'bootstrap',
      protocol_version: streamProtocolVersion,
      sent_at: now,
      message: 'Earthly stream online'
    };

    res.write(serializeStreamEvent(bootstrapEvent));

    const interval = setInterval(() => {
      const heartbeatEvent: StreamEvent = {
        event_type: 'heartbeat',
        protocol_version: streamProtocolVersion,
        sent_at: new Date().toISOString(),
        status: 'ok'
      };
      broadcast(heartbeatEvent);
    }, HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(interval);
      clients.delete(res);
      res.end();
    });
  });

  router.post('/stream/publish', (req, res) => {
    const parsedPayload = validateStreamEvent(req.body);

    if (!parsedPayload.success) {
      logger.warn('Rejected malformed stream payload', {
        issues: summarizeZodIssues(parsedPayload.error.issues)
      });

      return res.status(400).json({
        status: 'rejected',
        reason: 'malformed_stream_payload'
      });
    }

    const deliveredTo = broadcast(parsedPayload.data);

    logger.info('Accepted stream payload', {
      event_type: parsedPayload.data.event_type,
      delivered_to: deliveredTo
    });

    return res.status(202).json({
      status: 'accepted',
      event_type: parsedPayload.data.event_type,
      delivered_to: deliveredTo
    });
  });

  return router;
}
