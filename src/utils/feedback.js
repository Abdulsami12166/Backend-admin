/**
 * Unified feedback utility for admin actions
 * Provides consistent response formatting for success, error, and validation feedback
 */

const { logger } = require('./logger');

class FeedbackResponse {
  constructor(success, statusCode, message, data = null, metadata = {}) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.code = metadata.code || (success ? 'SUCCESS' : 'ERROR');
    this.timestamp = new Date().toISOString();
    this.requestId = metadata.requestId || null;
    this.details = metadata.details || null;
    this.errors = metadata.errors || null;
  }

  toJSON() {
    const obj = {
      success: this.success,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
    };

    if (this.data) obj.data = this.data;
    if (this.details) obj.details = this.details;
    if (this.errors) obj.errors = this.errors;
    if (this.requestId) obj.requestId = this.requestId;

    return obj;
  }
}

/**
 * Send success feedback with data
 */
function sendSuccess(res, statusCode = 200, message = 'Operation successful', data = null, metadata = {}) {
  const response = new FeedbackResponse(true, statusCode, message, data, metadata);
  logger.info('Success response', { statusCode, message, dataKeys: data ? Object.keys(data) : [] });
  return res.status(statusCode).json(response.toJSON());
}

/**
 * Send error feedback with details
 */
function sendError(res, statusCode = 400, message = 'Operation failed', errorDetails = null, metadata = {}) {
  const response = new FeedbackResponse(false, statusCode, message, null, {
    ...metadata,
    code: metadata.code || getErrorCode(statusCode),
    details: errorDetails,
  });

  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Error response', {
    statusCode,
    message,
    details: errorDetails,
  });

  return res.status(statusCode).json(response.toJSON());
}

/**
 * Send validation error feedback
 */
function sendValidationError(res, validationErrors, message = 'Validation failed', metadata = {}) {
  const response = new FeedbackResponse(false, 422, message, null, {
    ...metadata,
    code: 'VALIDATION_ERROR',
    errors: Array.isArray(validationErrors) ? validationErrors : [validationErrors],
  });

  logger.warn('Validation error', {
    message,
    errorCount: Array.isArray(validationErrors) ? validationErrors.length : 1,
  });

  return res.status(422).json(response.toJSON());
}

/**
 * Send permission denied feedback
 */
function sendPermissionDenied(res, message = 'Permission denied', metadata = {}) {
  return sendError(res, 403, message, 'You do not have permission to perform this action', {
    ...metadata,
    code: 'PERMISSION_DENIED',
  });
}

/**
 * Send not found feedback
 */
function sendNotFound(res, resourceName = 'Resource', metadata = {}) {
  return sendError(res, 404, `${resourceName} not found`, `The requested ${resourceName} does not exist`, {
    ...metadata,
    code: 'NOT_FOUND',
  });
}

/**
 * Send conflict feedback
 */
function sendConflict(res, message = 'Resource conflict', details = null, metadata = {}) {
  return sendError(res, 409, message, details, {
    ...metadata,
    code: 'CONFLICT',
  });
}

/**
 * Send server error feedback
 */
function sendServerError(res, message = 'Internal server error', details = null, metadata = {}) {
  return sendError(res, 500, message, details, {
    ...metadata,
    code: 'SERVER_ERROR',
  });
}

/**
 * Map HTTP status code to error code
 */
function getErrorCode(statusCode) {
  const codeMap = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'SERVER_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codeMap[statusCode] || 'ERROR';
}

module.exports = {
  FeedbackResponse,
  sendSuccess,
  sendError,
  sendValidationError,
  sendPermissionDenied,
  sendNotFound,
  sendConflict,
  sendServerError,
  getErrorCode,
};
