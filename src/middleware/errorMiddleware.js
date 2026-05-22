const { logger } = require('../utils/logger');

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
};

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
  });

  res.status(err?.statusCode || 500).json({
    success: false,
    message: err?.message || 'Server error',
  });
};

module.exports = { notFound, errorHandler };

