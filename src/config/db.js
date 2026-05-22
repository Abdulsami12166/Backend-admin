const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  await mongoose.connect(mongoUri);
  logger.info('MongoDB connected (admin server)', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
  });
};

module.exports = connectDB;

