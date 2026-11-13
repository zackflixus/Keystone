import Redis from 'ioredis';
import logger from './logger/index.js';

/**
 * Redis connections for BullMQ and the Socket.IO adapter.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on any connection it owns —
 * with a retry limit, blocking commands (BRPOPLPUSH) throw once the limit is
 * hit and the worker dies. ioredis warns about this at startup if unset.
 *
 * Redis is optional: when REDIS_URL is absent the app runs exactly as before,
 * with rule events piling up unpublished in the outbox instead of being
 * dispatched. That keeps local dev and existing deployments working untouched.
 */

export const REDIS_URL = process.env.REDIS_URL || '';
export const isRedisEnabled = () => Boolean(REDIS_URL);

const CONNECTION_OPTS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (attempts) => Math.min(attempts * 200, 5000)
};

// Every consumer that needs its own socket (BullMQ Queue/Worker, the pub and sub
// halves of the Socket.IO adapter) calls this. Sharing one connection across
// blocking and non-blocking consumers deadlocks them.
export const createRedisConnection = (label = 'redis') => {
  if (!REDIS_URL) throw new Error('REDIS_URL is not configured');

  const client = new Redis(REDIS_URL, CONNECTION_OPTS);

  client.on('error', (err) => logger.error({ err: err?.message, label }, 'Redis connection error'));
  client.on('ready', () => logger.info({ label }, 'Redis connected'));
  client.on('end',   () => logger.warn({ label }, 'Redis connection closed'));

  return client;
};

// Shared non-blocking connection, reused by the queues and the outbox publisher.
let shared;
export const getSharedRedis = () => {
  if (!shared) shared = createRedisConnection('shared');
  return shared;
};

export const closeSharedRedis = async () => {
  if (!shared) return;
  await shared.quit().catch(() => shared.disconnect());
  shared = undefined;
};
