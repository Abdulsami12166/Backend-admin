const { logger } = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info('Request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: ms,
    });
  });
  next();
};

module.exports = { requestLogger };

