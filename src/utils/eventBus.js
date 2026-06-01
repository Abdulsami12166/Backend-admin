const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { logger } = require('./logger');
const { socketEvents } = require('./socketEvents');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'default_admin_secret';
const ADMIN_ROLES = ['admin', 'super-admin', 'product-manager', 'support'];

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
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    const user = await User.findById(decoded.id).select('+tokenVersion role');

    if (!user || !ADMIN_ROLES.includes(normalizeRole(user.role))) {
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

const attachSocketServer = (httpServer, app) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || process.env.ADMIN_CLIENT_URL || '*',
      credentials: true,
    },
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
  return io;
};

const getIo = app => app.get('io');

const emitToAdmins = (app, event, payload) => {
  const io = getIo(app);
  if (!io) return;
  io.to(socketEvents.ROOMS.ADMINS).emit(event, payload);
};

module.exports = {
  attachSocketServer,
  emitToAdmins,
  socketEvents,
};
