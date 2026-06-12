const { logger } = require('../utils/logger');
const {
  sendError,
  sendServerError,
  sendValidationError,
} = require('../utils/feedback');

const notFound = (req, res) => {
  return sendError(res, 404, 'Not found', 'The requested endpoint does not exist', {
    code: 'NOT_FOUND',
  });
};

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err?.statusCode || 500;
  if (statusCode === 422) {
    return sendValidationError(res, err?.errors || err?.message || 'Validation failed', err?.message || 'Validation failed');
  }

  if (statusCode >= 400 && statusCode < 500) {
    return sendError(res, statusCode, err?.message || 'Bad request', err?.details || err?.message, {
      code: err?.code || 'BAD_REQUEST',
    });
  }

  return sendServerError(res, err?.message || 'Server error', err?.stack);
};

module.exports = { notFound, errorHandler };
