const express = require('express');
const { authorizeAdmin, authorizePermission } = require('../middleware/adminAuthMiddleware');

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

module.exports = router;
