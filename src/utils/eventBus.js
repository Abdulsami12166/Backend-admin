const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { corsOptions } = require('./corsOptions');
const { logger } = require('./logger');
const { socketEvents } = require('./socketEvents');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'default_admin_secret';
const USER_JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'default_user_secret';
const ADMIN_ROLES = ['admin', 'super-admin', 'product-manager', 'inventory-manager', 'support'];

const normalizeRole = role =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

const extractSocketToken = socket =>
  socket.handshake.auth?.token
  || socket.handshake.query?.token
  || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')
  || null;

const resolveSocketUser = async socket => {
  const token = extractSocketToken(socket);
  if (!token) return null;

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    } catch {
      decoded = jwt.verify(token, USER_JWT_SECRET);
    }
    const user = await User.findById(decoded.id).select('+tokenVersion role blocked');

    if (!user || user.blocked) {
      return null;
    }

    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
};

let ioInstance = null;

const attachSocketServer = (httpServer, app) => {
  const io = new Server(httpServer, {
    cors: corsOptions,
  });

  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next();
      }

      const user = await resolveSocketUser(socket);
      if (!user) {
        logger.warn('Rejected admin socket connection with invalid token', {
          socketId: socket.id,
        });
        return next(new Error('Invalid socket token'));
      }

      socket.data.user = {
        id: String(user._id),
        role: user.role,
      };
      return next();
    } catch (error) {
      return next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', socket => {
    logger.info('Admin socket connected', { socketId: socket.id });
    if (socket.data.user?.id) {
      socket.join(socketEvents.ROOMS.user(socket.data.user.id));
    }

    socket.on(socketEvents.ADMIN_SUBSCRIBE, () => {
      if (!ADMIN_ROLES.includes(normalizeRole(socket.data.user?.role))) {
        logger.warn('Rejected admin socket subscription', { socketId: socket.id });
        socket.emit('socket.error', { message: 'Admin access required' });
        socket.disconnect(true);
        return;
      }

      socket.join(socketEvents.ROOMS.ADMINS);
      logger.info('Admin socket subscribed', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      logger.info('Admin socket disconnected', { socketId: socket.id });
    });
  });

  app.set('io', io);
  ioInstance = io;
  return io;
};

const getIo = app => app ? app.get('io') : ioInstance;

const emitToAdmins = (app, event, payload) => {
  const io = getIo(app);
  if (io) {
    io.to(socketEvents.ROOMS.ADMINS).emit(event, payload);
  }
  try {
    const { triggerEventNotifications } = require('../services/notificationTriggerService');
    triggerEventNotifications(event, payload).catch(err => console.error(err));
  } catch (err) {
    console.error('Failed to trigger event notifications:', err);
  }
};

const emitToUser = (app, userId, event, payload) => {
  const io = getIo(app);
  if (!io || !userId) return;
  io.to(socketEvents.ROOMS.user(String(userId))).emit(event, payload);

  try {
    const { triggerEventNotifications } = require('../services/notificationTriggerService');
    triggerEventNotifications(event, { ...payload, userId }).catch(err => console.error(err));
  } catch (err) {
    console.error('Failed to trigger event notifications:', err);
  }
};

const emitToAll = (app, event, payload) => {
  const io = getIo(app);
  if (io) {
    io.emit(event, payload);
  }
  try {
    const { triggerEventNotifications } = require('../services/notificationTriggerService');
    triggerEventNotifications(event, payload).catch(err => console.error(err));
  } catch (err) {
    console.error('Failed to trigger event notifications:', err);
  }
};

module.exports = {
  attachSocketServer,
  emitToAdmins,
  emitToUser,
  emitToAll,
  socketEvents,
  getIo: () => ioInstance
};
