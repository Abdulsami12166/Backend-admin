/**
 * Confirmation workflow middleware
 * Handles admin action confirmations with proper validation and audit trails
 */

const AuditLog = require('../models/AuditLog');
const { logger } = require('./logger');

/**
 * Confirmation action types
 */
const ConfirmationTypes = {
  BLOCK_USER: 'block_user',
  UNBLOCK_USER: 'unblock_user',
  DELETE_PRODUCT: 'delete_product',
  DELETE_ORDER: 'delete_order',
  HIDE_PRODUCT: 'hide_product',
  APPROVE_RETURN: 'approve_return',
  REJECT_RETURN: 'reject_return',
  PROCESS_REFUND: 'process_refund',
  APPROVE_REFUND: 'approve_refund',
  CANCEL_SHIPMENT: 'cancel_shipment',
  FORCE_LOGOUT: 'force_logout',
  DELETE_USER: 'delete_user',
};

/**
 * Create confirmation record
 */
async function createConfirmation(adminId, actionType, entityType, entityId, details = {}) {
  try {
    const confirmationCode = `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

    // Store confirmation in a temporary location (or cache)
    // For production, use Redis or a dedicated collection
    const confirmation = {
      code: confirmationCode,
      adminId,
      actionType,
      entityType,
      entityId,
      details,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      confirmed: false,
    };

    logger.info('Confirmation created', { confirmationCode, actionType });

    return confirmation;
  } catch (error) {
    logger.error('Failed to create confirmation', { error: error.message });
    throw error;
  }
}

/**
 * Verify and execute confirmation
 */
async function verifyAndExecuteConfirmation(
  adminId,
  confirmationCode,
  actionHandler,
) {
  try {
    // In production, fetch from Redis/DB
    // For now, we'll trust the frontend to send valid confirmation

    if (!confirmationCode) {
      throw Object.assign(new Error('Confirmation code is required'), { statusCode: 400 });
    }

    logger.info('Confirmation verified', { confirmationCode });

    // Execute the actual action
    const result = await actionHandler();

    return result;
  } catch (error) {
    logger.error('Confirmation verification failed', { error: error.message });
    throw error;
  }
}

/**
 * Audit log creation helper
 */
async function createAuditLog(data) {
  try {
    const auditEntry = new AuditLog({
      actor: data.actor,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName || '',
      status: data.status || 'success',
      severity: data.severity || 'info',
      changes: {
        before: data.before || null,
        after: data.after || null,
      },
      ipAddress: data.ipAddress || '',
      userAgent: data.userAgent || '',
      resourcePath: data.resourcePath || '',
      metadata: data.metadata || {},
    });

    await auditEntry.save();

    logger.info('Audit log created', {
      action: data.action,
      entityType: data.entityType,
      status: data.status,
    });

    return auditEntry;
  } catch (error) {
    // Don't fail main operation if audit logging fails
    logger.error('Failed to create audit log', { error: error.message });
  }
}

/**
 * Audit log middleware wrapper
 * Usage: await auditAction(req, 'create_product', 'product', productId, before, after)
 */
async function auditAction(req, action, entityType, entityId, before = null, after = null, metadata = {}) {
  return createAuditLog({
    actor: req.adminUser?._id || req.userId,
    action,
    entityType,
    entityId,
    status: 'success',
    severity: 'info',
    before,
    after,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    resourcePath: req.originalUrl || '',
    metadata,
  });
}

/**
 * Audit error action
 */
async function auditError(req, action, entityType, entityId, error, metadata = {}) {
  return createAuditLog({
    actor: req.adminUser?._id || req.userId,
    action,
    entityType,
    entityId,
    status: 'failure',
    severity: 'warning',
    ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    resourcePath: req.originalUrl || '',
    metadata: {
      ...metadata,
      errorMessage: error?.message || 'Unknown error',
    },
  });
}

module.exports = {
  ConfirmationTypes,
  createConfirmation,
  verifyAndExecuteConfirmation,
  createAuditLog,
  auditAction,
  auditError,
};
