require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { logger } = require('./utils/logger');
const { attachSocketServer } = require('./utils/eventBus');

const port = process.env.PORT || 5002;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    attachSocketServer(server, app);

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

