const express = require('express');

const {
  getAdminProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
} = require('../controllers/admin/productAdminController');

const {
  getAdminOrders,
  adminUpdateOrderStatus,
  adminDeleteOrder,
  adminCreateOrder,
} = require('../controllers/admin/orderAdminController');

const {
  getAdminUsers,
  getAdminUserOrders,
  adminDeleteUser,
  adminBlockUser,
  adminUnblockUser,
  adminForceLogoutUser,
} = require('../controllers/admin/userAdminController');

const { getAdminDashboardMetrics, getAdminActivities } = require('../controllers/admin/dashboardAdminController');

const { adminLogin, adminMe, authorizeAdmin, authorizeRoles } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/me', authorizeAdmin, adminMe);

router.get('/dashboard/metrics', authorizeAdmin, getAdminDashboardMetrics);
router.get('/activities', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'support'), getAdminActivities);

router.get('/products', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager'), getAdminProducts);
router.post('/products', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager'), adminCreateProduct);
router.put('/products/:id', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager'), adminUpdateProduct);
router.delete('/products/:id', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminDeleteProduct);

router.get('/orders', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager', 'support'), getAdminOrders);
router.post('/orders', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager'), adminCreateOrder);
router.patch('/orders/:id/status', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'product-manager'), adminUpdateOrderStatus);
router.delete('/orders/:id', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminDeleteOrder);

router.get('/users', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'support'), getAdminUsers);
router.get('/users/:id/orders', authorizeAdmin, authorizeRoles('admin', 'super-admin', 'support'), getAdminUserOrders);
router.delete('/users/:id', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminDeleteUser);
router.post('/users/:id/block', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminBlockUser);
router.post('/users/:id/unblock', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminUnblockUser);
router.post('/users/:id/logout', authorizeAdmin, authorizeRoles('admin', 'super-admin'), adminForceLogoutUser);

module.exports = router;
