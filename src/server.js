require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { logger } = require('./utils/logger');

const port = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      logger.info('Admin backend started', {
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

