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

const { adminLogin, authorizeAdmin } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.post('/login', adminLogin);

router.get('/dashboard/metrics', authorizeAdmin, getAdminDashboardMetrics);
router.get('/activities', authorizeAdmin, getAdminActivities);

router.get('/products', authorizeAdmin, getAdminProducts);
router.post('/products', authorizeAdmin, adminCreateProduct);
router.put('/products/:id', authorizeAdmin, adminUpdateProduct);
router.delete('/products/:id', authorizeAdmin, adminDeleteProduct);

router.get('/orders', authorizeAdmin, getAdminOrders);
router.post('/orders', authorizeAdmin, adminCreateOrder);
router.patch('/orders/:id/status', authorizeAdmin, adminUpdateOrderStatus);
router.delete('/orders/:id', authorizeAdmin, adminDeleteOrder);

router.get('/users', authorizeAdmin, getAdminUsers);
router.get('/users/:id/orders', authorizeAdmin, getAdminUserOrders);
router.delete('/users/:id', authorizeAdmin, adminDeleteUser);
router.post('/users/:id/block', authorizeAdmin, adminBlockUser);
router.post('/users/:id/unblock', authorizeAdmin, adminUnblockUser);
router.post('/users/:id/logout', authorizeAdmin, adminForceLogoutUser);

module.exports = router;