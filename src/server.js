require('dotenv').config();

const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { logger } = require('./utils/logger');

const port = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    const io = socketIo(server, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      logger.info('Admin dashboard connected via WebSocket', { socketId: socket.id });

      socket.on('subscribe-admin', () => {
        socket.join('admin-room');
        logger.info('Admin subscribed to real-time updates');
      });

      socket.on('disconnect', () => {
        logger.info('Admin disconnected from WebSocket', { socketId: socket.id });
      });
    });

    const emitAdminEvent = (event, data) => {
      io.to('admin-room').emit(event, data);
    };

    app.set('io', io);
    app.set('emitAdminEvent', emitAdminEvent);

    server.listen(port, () => {
      logger.info('Admin backend started with WebSocket', {
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
      });
    });
  } catch (error) {
    logger.error('Failed to start admin server', {
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
    process.exit(1);
  }
};

startServer();

