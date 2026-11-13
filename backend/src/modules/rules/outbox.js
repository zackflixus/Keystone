import prisma from '../../core/database/prisma.js';
import logger from '../../core/logger/index.js';
import { isRedisEnabled } from '../../core/redis.js';
import { getRuleEventsQueue } from '../../core/queues/index.js';

/**
 * Outbox publisher — drains committed DomainEvent rows onto the rule-events queue.
 *
 * Order of operations is deliberate: read, enqueue, *then* mark published. A crash
 * between enqueue and mark re-delivers the event on the next tick, which BullMQ
 * discards because `jobId` is the event id. Marking first would instead lose the
 * event silently — the failure mode nobody notices until someone asks why their
 * rule never ran.
 *
 * Duplicate work across multiple API instances is harmless for the same reason.
 */

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 100;

// Rows older than this are dropped by the retention sweep. Long enough to debug a
// weekend incident, short enough that the table does not grow without bound.
const RETENTION_DAYS = 7;
const SWEEP_EVERY_TICKS = 600; // ~10 minutes at a 1s poll

let timer = null;
let running = false;   // guards against overlapping ticks on a slow batch
let stopped = true;
let ticks = 0;

const publishBatch = async () => {
  const queue = getRuleEventsQueue();
  if (!queue) return 0;

  const pending = await prisma.domainEvent.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE
  });

  if (!pending.length) return 0;

  const published = [];
  for (const event of pending) {
    try {
      await queue.add(
        'evaluate',
        {
          eventId: event.id,
          type: event.type,
          workspaceId: event.workspaceId,
          projectId: event.projectId,
          payload: event.payload,
          occurredAt: event.createdAt
        },
        { jobId: event.id }   // idempotency key — a replay is dropped by BullMQ
      );
      published.push(event.id);
    } catch (err) {
      // Leave it unpublished; the next tick retries. Stop the batch so we do not
      // hammer a Redis that is clearly unavailable.
      logger.error({ err: err?.message, eventId: event.id }, 'Outbox enqueue failed');
      break;
    }
  }

  if (published.length) {
    await prisma.domainEvent.updateMany({
      where: { id: { in: published } },
      data: { publishedAt: new Date() }
    });
    logger.debug({ count: published.length }, 'Outbox published');
  }

  return published.length;
};

const sweepOldEvents = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000);
  const { count } = await prisma.domainEvent.deleteMany({
    where: { publishedAt: { not: null, lt: cutoff } }
  });
  if (count) logger.info({ count }, 'Outbox retention sweep removed old events');
};

const tick = async () => {
  if (running || stopped) return;
  running = true;
  try {
    // Keep draining while batches come back full, so a backlog clears fast
    // instead of trickling out 100 events per second.
    let drained;
    do {
      drained = await publishBatch();
    } while (drained === BATCH_SIZE && !stopped);

    if (++ticks % SWEEP_EVERY_TICKS === 0) await sweepOldEvents();
  } catch (err) {
    logger.error({ err: err?.message }, 'Outbox publisher tick failed');
  } finally {
    running = false;
  }
};

export const startOutboxPublisher = () => {
  if (!isRedisEnabled()) {
    logger.warn('REDIS_URL not set — rule events will be recorded but not dispatched');
    return;
  }
  if (timer) return;

  stopped = false;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  timer.unref?.();   // never hold the process open on this alone
  logger.info({ intervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE }, 'Outbox publisher started');
};

export const stopOutboxPublisher = async () => {
  stopped = true;
  if (timer) clearInterval(timer);
  timer = null;

  // Let an in-flight batch finish so its events get marked published.
  for (let i = 0; running && i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  logger.info('Outbox publisher stopped');
};

// Exported for the health check in Phase 5 and for tests.
export const getOutboxBacklog = () => prisma.domainEvent.count({ where: { publishedAt: null } });
