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
} = require('../controllers/admin/orderAdminController');

const {
  getAdminUsers,
  adminDeleteUser,
  adminBlockUser,
  adminUnblockUser,
} = require('../controllers/admin/userAdminController');

const { getAdminDashboardMetrics } = require('../controllers/admin/dashboardAdminController');

const { protect, authorize } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.get('/dashboard/metrics', protect, authorize('admin'), getAdminDashboardMetrics);

router.get('/products', protect, authorize('admin'), getAdminProducts);
router.post('/products', protect, authorize('admin'), adminCreateProduct);
router.put('/products/:id', protect, authorize('admin'), adminUpdateProduct);
router.delete('/products/:id', protect, authorize('admin'), adminDeleteProduct);

router.get('/orders', protect, authorize('admin'), getAdminOrders);
router.patch('/orders/:id/status', protect, authorize('admin'), adminUpdateOrderStatus);
router.delete('/orders/:id', protect, authorize('admin'), adminDeleteOrder);

router.get('/users', protect, authorize('admin'), getAdminUsers);
router.delete('/users/:id', protect, authorize('admin'), adminDeleteUser);
router.post('/users/:id/block', protect, authorize('admin'), adminBlockUser);
router.post('/users/:id/unblock', protect, authorize('admin'), adminUnblockUser);

module.exports = router;

