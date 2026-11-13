import express from 'express';
import cors from 'cors';
import config from './core/config/index.js';
import logger from './core/logger/index.js';
import { errorHandler } from './core/middlewares/errorHandler.js';
import { requestLogger } from './core/middlewares/requestLogger.js';

// Routes
import authRoutes from './modules/auth/authRoutes.js';
import userRoutes from './modules/users/userRoutes.js';
import workspaceRoutes from './modules/workspace/workspaceRoutes.js';
import projectRoutes from './modules/projects/projectRoutes.js';
import listRoutes from './modules/lists/listRoutes.js';
import taskRoutes from './modules/tasks/taskRoutes.js';
import commentRoutes from './modules/comments/commentRoutes.js';
import activityRoutes from './modules/activity/activityRoutes.js';
import inviteRoutes from './modules/invites/inviteRoutes.js';
import customFieldRoutes from './modules/customFields/customFieldRoutes.js';
import timeTrackingRoutes from './modules/timeTracking/timeTrackingRoutes.js';
import reportRoutes from './modules/reports/reportRoutes.js';
import viewPrefsRoutes from './modules/viewPrefs/viewPrefsRoutes.js';
import ruleRoutes from './modules/rules/ruleRoutes.js';

// Rules engine
import { startOutboxPublisher, stopOutboxPublisher, getOutboxBacklog } from './modules/rules/outbox.js';
import { closeQueues } from './core/queues/index.js';
import { closeSharedRedis, isRedisEnabled } from './core/redis.js';

const app = express();

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Attach socket ID from request header to req object
app.use((req, res, next) => { req.socketId = req.headers['x-socket-id'] || null; next(); });
app.use(requestLogger);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/lists', listRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/invites', inviteRoutes);
app.use('/api/v1/custom-fields', customFieldRoutes);
app.use('/api/v1/time-tracking', timeTrackingRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/view-prefs', viewPrefsRoutes);
app.use('/api/v1/rules', ruleRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rules engine health — outbox backlog. A backlog that keeps climbing means the
// publisher can't reach Redis or the worker is down.
app.get('/health/rules', async (req, res) => {
  try {
    const backlog = await getOutboxBacklog();
    res.json({ status: 'ok', redis: isRedisEnabled(), outboxBacklog: backlog });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err?.message });
  }
});

// Error handler (must be last)
app.use(errorHandler);

import http from 'http';
import { initSocket } from './core/socket.js';

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Drain the rules outbox onto the queue. Safe to run in every API instance —
// duplicate enqueues are de-duplicated by BullMQ on the event id.
startOutboxPublisher();

// Start server
const { port } = config;

server.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${port} in ${config.nodeEnv} mode`);
});

// ── Shutdown ────────────────────────────────────────────────────────────────
// Stop the publisher before the process exits so an in-flight batch finishes
// marking its events published, rather than re-delivering them on next boot.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);

  server.close();
  await stopOutboxPublisher();
  await closeQueues();
  await closeSharedRedis();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
