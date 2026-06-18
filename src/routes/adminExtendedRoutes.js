const express = require('express');
const { authorizeAdmin, authorizePermission, authorizeRoles } = require('../middleware/adminAuthMiddleware');

// Import all controllers
const customerController = require('../controllers/admin/customerAdminController');
const inventoryController = require('../controllers/admin/inventoryAdminController');
const shipmentController = require('../controllers/admin/shipmentAdminController');
const refundReturnController = require('../controllers/admin/refundReturnAdminController');
const ticketController = require('../controllers/admin/ticketAdminController');
const invoiceController = require('../controllers/admin/invoiceAdminController');
const auditLogController = require('../controllers/admin/auditLogAdminController');
const settingsController = require('../controllers/admin/settingsAdminController');
const featureToggleController = require('../controllers/admin/featureToggleAdminController');
const notificationController = require('../controllers/admin/notificationAdminController');
const sessionController = require('../controllers/admin/sessionAdminController');
const orderTimelineController = require('../controllers/admin/orderTimelineAdminController');
const bulkOperationsController = require('../controllers/admin/bulkOperationsAdminController');

const router = express.Router();

// ============ CUSTOMERS ============
router.get('/customers', authorizeAdmin, authorizePermission('users:view'), customerController.getAllCustomers);
router.get('/customers/:userId', authorizeAdmin, authorizePermission('users:view'), customerController.getCustomerDetails);
router.get('/customers/:userId/activity-logs', authorizeAdmin, authorizePermission('users:view'), customerController.getCustomerActivityLogs);
router.get('/customers/:userId/notification-preferences', authorizeAdmin, customerController.getNotificationPreferences);
router.put('/customers/:userId/notification-preferences', authorizeAdmin, customerController.updateNotificationPreferences);
router.post('/customers/:userId/block', authorizeAdmin, authorizePermission('users:control'), customerController.toggleCustomerStatus);
router.post('/customers/:userId/unblock', authorizeAdmin, authorizePermission('users:control'), customerController.toggleCustomerStatus);
router.get('/customers/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), customerController.getCustomerStats);

// ============ INVENTORY ============
router.get('/inventory', authorizeAdmin, authorizePermission('inventory:view'), inventoryController.getAllInventory);
router.get('/inventory/product/:productId', authorizeAdmin, authorizePermission('inventory:view'), inventoryController.getProductInventory);
router.patch('/inventory/product/:productId/stock', authorizeAdmin, authorizePermission('inventory:manage'), inventoryController.updateStock);
router.patch('/inventory/product/:productId/reorder', authorizeAdmin, authorizePermission('inventory:manage'), inventoryController.updateReorderSettings);
router.get('/inventory/low-stock', authorizeAdmin, authorizePermission('inventory:view'), inventoryController.getLowStockProducts);
router.get('/inventory/product/:productId/movements', authorizeAdmin, authorizePermission('inventory:view'), inventoryController.getStockMovements);
router.get('/inventory/stats', authorizeAdmin, authorizePermission('analytics:view'), inventoryController.getInventoryStats);

// ============ SHIPMENTS ============
router.get('/shipments', authorizeAdmin, authorizePermission('orders:view'), shipmentController.getAllShipments);
router.get('/shipments/:shipmentId', authorizeAdmin, authorizePermission('orders:view'), shipmentController.getShipmentDetails);
router.post('/shipments/order/:orderId', authorizeAdmin, authorizePermission('orders:update'), shipmentController.createShipment);
router.patch('/shipments/:shipmentId/tracking', authorizeAdmin, authorizePermission('orders:update'), shipmentController.updateTrackingStatus);
router.get('/shipments/:shipmentId/tracking-history', authorizeAdmin, authorizePermission('orders:view'), shipmentController.getTrackingHistory);
router.get('/shipments/status/:status', authorizeAdmin, authorizePermission('orders:view'), shipmentController.getShipmentsByStatus);
router.get('/shipments/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), shipmentController.getShipmentStats);

// ============ RETURNS ============
router.get('/returns', authorizeAdmin, authorizePermission('orders:view'), refundReturnController.getAllReturns);
router.get('/returns/:returnId', authorizeAdmin, authorizePermission('orders:view'), refundReturnController.getReturnDetails);
router.post('/returns/:returnId/approve', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.approveReturn);
router.post('/returns/:returnId/reject', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.rejectReturn);
router.patch('/returns/:returnId/status', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.updateReturnStatus);

// ============ REFUNDS ============
router.get('/refunds', authorizeAdmin, authorizePermission('orders:view'), refundReturnController.getAllRefunds);
router.get('/refunds/:refundId', authorizeAdmin, authorizePermission('orders:view'), refundReturnController.getRefundDetails);
router.post('/refunds/:refundId/approve', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.approveRefund);
router.post('/refunds/:refundId/reject', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.rejectRefund);
router.post('/refunds/:refundId/process', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.processRefund);
router.post('/refunds/:refundId/complete', authorizeAdmin, authorizePermission('orders:update'), refundReturnController.completeRefund);
router.get('/refunds/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), refundReturnController.getRefundStats);

// ============ TICKETS ============
router.get('/tickets', authorizeAdmin, authorizePermission('support:view'), ticketController.getAllTickets);
router.get('/tickets/:ticketId', authorizeAdmin, authorizePermission('support:view'), ticketController.getTicketDetails);
router.post('/tickets', authorizeAdmin, authorizePermission('support:create'), ticketController.createTicket);
router.post('/tickets/:ticketId/assign', authorizeAdmin, authorizePermission('support:manage'), ticketController.assignTicket);
router.post('/tickets/:ticketId/message', authorizeAdmin, authorizePermission('support:respond'), ticketController.addMessage);
router.patch('/tickets/:ticketId/status', authorizeAdmin, authorizePermission('support:manage'), ticketController.updateTicketStatus);
router.post('/tickets/:ticketId/escalate', authorizeAdmin, authorizePermission('support:escalate'), ticketController.escalateTicket);
router.post('/tickets/:ticketId/rating', authorizeAdmin, ticketController.addTicketRating);
router.get('/tickets/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), ticketController.getTicketStats);

// ============ INVOICES ============
router.get('/invoices', authorizeAdmin, authorizePermission('finance:view'), invoiceController.getAllInvoices);
router.get('/invoices/:invoiceId', authorizeAdmin, authorizePermission('finance:view'), invoiceController.getInvoiceDetails);
router.post('/invoices/order/:orderId', authorizeAdmin, authorizePermission('finance:manage'), invoiceController.createInvoice);
router.post('/invoices/:invoiceId/send', authorizeAdmin, authorizePermission('finance:manage'), invoiceController.sendInvoice);
router.post('/invoices/:invoiceId/payment', authorizeAdmin, authorizePermission('finance:manage'), invoiceController.recordPayment);
router.post('/invoices/:invoiceId/credit-note', authorizeAdmin, authorizePermission('finance:manage'), invoiceController.issueCreditNote);
router.patch('/invoices/:invoiceId/status', authorizeAdmin, authorizePermission('finance:manage'), invoiceController.updateInvoiceStatus);
router.get('/invoices/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), invoiceController.getInvoiceStats);

// ============ AUDIT LOGS ============
router.get('/audit-logs', authorizeAdmin, authorizePermission('audit:view'), auditLogController.getAllAuditLogs);
router.get('/audit-logs/:logId', authorizeAdmin, authorizePermission('audit:view'), auditLogController.getAuditLogDetails);
router.get('/audit-logs/user/:userId', authorizeAdmin, authorizePermission('audit:view'), auditLogController.getUserActivity);
router.get('/audit-logs/entity/:entityType/:entityId', authorizeAdmin, authorizePermission('audit:view'), auditLogController.getEntityActivity);
router.get('/audit-logs/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), auditLogController.getAuditStats);
router.get('/audit-logs/export', authorizeAdmin, authorizePermission('audit:view'), auditLogController.exportAuditLogs);
router.get('/audit-logs/health/summary', authorizeAdmin, auditLogController.getSystemHealthSummary);

// ============ SETTINGS ============
router.get('/settings', authorizeAdmin, authorizePermission('settings:view'), settingsController.getAllSettings);
router.get('/settings/:key', authorizeAdmin, authorizePermission('settings:view'), settingsController.getSetting);
router.put('/settings/:key', authorizeAdmin, authorizePermission('settings:manage'), settingsController.updateSetting);
router.post('/settings/batch-update', authorizeAdmin, authorizePermission('settings:manage'), settingsController.updateMultipleSettings);
router.post('/settings', authorizeAdmin, authorizePermission('settings:manage'), settingsController.createSetting);
router.get('/settings/category/:category', authorizeAdmin, authorizePermission('settings:view'), settingsController.getSettingsByCategory);
router.post('/settings/:key/reset', authorizeAdmin, authorizePermission('settings:manage'), settingsController.resetSetting);
router.get('/settings/export', authorizeAdmin, authorizePermission('settings:view'), settingsController.exportSettings);
router.post('/settings/import', authorizeAdmin, authorizePermission('settings:manage'), settingsController.importSettings);

// ============ FEATURE TOGGLES ============
router.get('/feature-toggles', authorizeAdmin, authorizePermission('features:view'), featureToggleController.getAllFeatureToggles);
router.get('/feature-toggles/:name', authorizeAdmin, authorizePermission('features:view'), featureToggleController.getFeatureToggleDetails);
router.post('/feature-toggles/:name/enable', authorizeAdmin, authorizePermission('features:manage'), featureToggleController.enableFeature);
router.post('/feature-toggles/:name/disable', authorizeAdmin, authorizePermission('features:manage'), featureToggleController.disableFeature);
router.patch('/feature-toggles/:name/rollout', authorizeAdmin, authorizePermission('features:manage'), featureToggleController.updateRollout);
router.patch('/feature-toggles/:name/config', authorizeAdmin, authorizePermission('features:manage'), featureToggleController.updateConfiguration);
router.get('/feature-toggles/:name/check', featureToggleController.isFeatureEnabled); // Public endpoint
router.post('/feature-toggles', authorizeAdmin, authorizePermission('features:manage'), featureToggleController.createFeatureToggle);
router.get('/feature-toggles/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), featureToggleController.getFeatureStats);
router.get('/feature-toggles/:name/dependencies', authorizeAdmin, authorizePermission('features:view'), featureToggleController.getFeatureDependencies);

// ============ NOTIFICATIONS ============
router.get('/notifications/templates', authorizeAdmin, authorizePermission('notifications:view'), notificationController.getAllTemplates);
router.get('/notifications/templates/:templateId', authorizeAdmin, authorizePermission('notifications:view'), notificationController.getTemplateDetails);
router.post('/notifications/templates', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.createTemplate);
router.patch('/notifications/templates/:templateId', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.updateTemplate);
router.delete('/notifications/templates/:templateId', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.deleteTemplate);

router.get('/notifications/event-mappings', authorizeAdmin, authorizePermission('notifications:view'), notificationController.getAllEventMappings);
router.post('/notifications/event-mappings', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.createEventMapping);
router.patch('/notifications/event-mappings/:mappingId', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.updateEventMapping);
router.delete('/notifications/event-mappings/:mappingId', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.deleteEventMapping);

router.get('/notifications/logs', authorizeAdmin, authorizePermission('notifications:view'), notificationController.getAllNotificationLogs);
router.get('/notifications/logs/:logId', authorizeAdmin, authorizePermission('notifications:view'), notificationController.getNotificationLogDetails);
router.post('/notifications/logs', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.createNotificationLog);
router.post('/notifications/send', authorizeAdmin, authorizePermission('notifications:manage'), notificationController.sendDirectNotification);
router.get('/notifications/stats', authorizeAdmin, authorizePermission('analytics:view'), notificationController.getNotificationStats);

router.get('/notifications/marketing-rules', authorizeAdmin, authorizePermission('marketing:view'), notificationController.getAllMarketingRules);
router.post('/notifications/marketing-rules', authorizeAdmin, authorizePermission('marketing:manage'), notificationController.createMarketingRule);
router.patch('/notifications/marketing-rules/:ruleId', authorizeAdmin, authorizePermission('marketing:manage'), notificationController.updateMarketingRule);
router.delete('/notifications/marketing-rules/:ruleId', authorizeAdmin, authorizePermission('marketing:manage'), notificationController.deleteMarketingRule);

// ============ SESSIONS ============
router.get('/sessions', authorizeAdmin, authorizeRoles('super-admin'), sessionController.getAllActiveSessions);
router.get('/sessions/admin/:adminId', authorizeAdmin, authorizeRoles('super-admin'), sessionController.getAdminSessions);
router.get('/sessions/:sessionId', authorizeAdmin, authorizeRoles('super-admin'), sessionController.getSessionDetails);
router.post('/sessions', authorizeAdmin, authorizeRoles('super-admin'), sessionController.createSession);
router.post('/sessions/:sessionId/logout', authorizeAdmin, authorizeRoles('super-admin'), sessionController.forceLogout);
router.post('/sessions/admin/:adminId/logout-all', authorizeAdmin, authorizeRoles('super-admin'), sessionController.forceLogoutAllForAdmin);
router.patch('/sessions/:sessionId/activity', authorizeAdmin, authorizeRoles('super-admin'), sessionController.updateSessionActivity);
router.get('/sessions/stats/overview', authorizeAdmin, authorizeRoles('super-admin'), sessionController.getSessionStats);

// ============ ORDER TIMELINE ============
router.get('/orders/:orderId/timeline', authorizeAdmin, authorizePermission('orders:view'), orderTimelineController.getOrderTimeline);
router.post('/orders/:orderId/timeline/event', authorizeAdmin, authorizePermission('orders:update'), orderTimelineController.addTimelineEvent);
router.patch('/orders/:orderId/timeline/:eventId', authorizeAdmin, authorizePermission('orders:update'), orderTimelineController.updateTimelineEvent);
router.get('/orders/:orderId/timeline/lifecycle', authorizeAdmin, authorizePermission('orders:view'), orderTimelineController.getOrderLifecycleHistory);
router.get('/timeline/stats', authorizeAdmin, authorizePermission('analytics:view'), orderTimelineController.getTimelineStats);

// ============ BULK OPERATIONS ============
router.get('/bulk-operations', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.getBulkOperations);
router.get('/bulk-operations/:jobId', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.getBulkOperationDetails);
router.post('/bulk-operations/visibility', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.bulkToggleProductVisibility);
router.post('/bulk-operations/inventory', authorizeAdmin, authorizePermission('inventory:manage'), bulkOperationsController.bulkUpdateInventory);
router.post('/bulk-operations/category', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.bulkAssignCategory);
router.post('/bulk-operations/pricing', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.bulkUpdatePricing);
router.post('/bulk-operations/:jobId/cancel', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.cancelBulkOperation);
router.get('/bulk-operations/:jobId/logs', authorizeAdmin, authorizePermission('products:manage'), bulkOperationsController.getBulkOperationLogs);
router.get('/bulk-operations/stats/overview', authorizeAdmin, authorizePermission('analytics:view'), bulkOperationsController.getBulkOperationStats);

module.exports = router;
