import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import logger from './logger/index.js';
import { createRedisConnection, getSharedRedis, isRedisEnabled } from './redis.js';

let io;

// Emit-only handle for processes that serve no sockets of their own — the rules
// worker. Without this, a worker calling emitToProject would write to its own
// empty in-memory room registry and no browser would ever see the change.
let emitter;

const getEmitter = () => {
  if (!isRedisEnabled()) return null;
  if (!emitter) {
    emitter = new Emitter(getSharedRedis());
    logger.info('Socket emitter attached (emit-only, via Redis)');
  }
  return emitter;
};

export const initSocket = (server) => {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // With Redis configured, rooms are shared across processes. This is what lets
  // the rules worker (and any second API instance) broadcast into project rooms
  // whose sockets are connected elsewhere.
  if (isRedisEnabled()) {
    const pubClient = createRedisConnection('socket-pub');
    const subClient = createRedisConnection('socket-sub');
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter attached');
  } else {
    logger.warn('REDIS_URL not set — sockets are single-process only');
  }

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join a project room
    socket.on('join_project', (projectId) => {
      socket.join(`project_${projectId}`);
    });

    socket.on('leave_project', (projectId) => {
      socket.leave(`project_${projectId}`);
    });

    // Join a workspace room
    socket.on('join_workspace', (workspaceId) => {
      socket.join(`workspace_${workspaceId}`);
    });

    socket.on('leave_workspace', (workspaceId) => {
      socket.leave(`workspace_${workspaceId}`);
    });

    // Broadcast pending items to other users in the same project
    socket.on('pending_item', (data) => {
      if (data?.projectId) {
        socket.to(`project_${data.projectId}`).emit('pending_item', data);
      }
    });

    // Live typing — broadcast character-by-character edits to other users
    socket.on('live_edit', (data) => {
      if (data?.projectId) {
        socket.to(`project_${data.projectId}`).emit('live_edit', data);
      }
    });

    // Instant structural changes — broadcast directly to other users (no API round-trip)
    socket.on('instant_change', (data) => {
      if (data?.projectId) {
        socket.to(`project_${data.projectId}`).emit('instant_change', data);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

// Resolves to the live server in the API process, or the Redis emitter in the
// rules worker. Both expose the same to()/except()/emit() surface, so callers
// never need to know which process they are running in.
const broadcaster = () => io || getEmitter();

const emitToRoom = (room, event, data, excludeSocketId) => {
  const target = broadcaster();
  if (!target) return;
  if (excludeSocketId) {
    target.to(room).except(excludeSocketId).emit(event, data);
  } else {
    target.to(room).emit(event, data);
  }
};

// ── Project-level events ──
// excludeSocketId: if provided, that socket won't receive the event (the sender)
export const emitToProject = (projectId, event, data, excludeSocketId) => {
  emitToRoom(`project_${projectId}`, event, data, excludeSocketId);
};

// ── Workspace-level events ──
export const emitToWorkspace = (workspaceId, event, data, excludeSocketId) => {
  emitToRoom(`workspace_${workspaceId}`, event, data, excludeSocketId);
};
