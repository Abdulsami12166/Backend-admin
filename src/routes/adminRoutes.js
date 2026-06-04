const express = require('express');

const {
  getAdminProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUpdateInventory,
  adminCreateVariant,
  adminUpdateVariant,
  adminDeleteVariant,
} = require('../controllers/admin/productAdminController');

const {
  getAdminOrders,
  getAdminTransactions,
  adminUpdateOrderStatus,
  adminDeleteOrder,
  adminCreateOrder,
} = require('../controllers/admin/orderAdminController');

const {
  createAdminUser,
  getAdminAccessControl,
  getAdminUsers,
  getAdminUserOrders,
  adminDeleteUser,
  adminBlockUser,
  adminUnblockUser,
  adminForceLogoutUser,
  updateAdminRolePermissions,
  updateAdminUserRole,
} = require('../controllers/admin/userAdminController');

const { getAdminDashboardMetrics, getAdminActivities } = require('../controllers/admin/dashboardAdminController');

const {
  adminLogin,
  adminMe,
  authorizeAdmin,
  authorizePermission,
  authorizeRoles,
} = require('../middleware/adminAuthMiddleware');
const { uploadProductImages } = require('../middleware/productUploadMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.post('/auth/login', adminLogin);
router.get('/me', authorizeAdmin, adminMe);

router.get('/dashboard/metrics', authorizeAdmin, getAdminDashboardMetrics);
router.get('/activities', authorizeAdmin, authorizePermission('activity:view'), getAdminActivities);

router.get('/products', authorizeAdmin, authorizePermission('products:view'), getAdminProducts);
router.post('/products', authorizeAdmin, authorizePermission('products:create'), uploadProductImages, adminCreateProduct);
router.put('/products/:id', authorizeAdmin, authorizePermission('products:create'), uploadProductImages, adminUpdateProduct);
router.patch('/products/:id/inventory', authorizeAdmin, authorizePermission('inventory:manage'), adminUpdateInventory);
router.post('/products/:id/variants', authorizeAdmin, authorizePermission('products:create'), uploadProductImages, adminCreateVariant);
router.patch('/products/:id/variants/:variantId', authorizeAdmin, authorizePermission('products:create'), uploadProductImages, adminUpdateVariant);
router.delete('/products/:id/variants/:variantId', authorizeAdmin, authorizePermission('products:create'), adminDeleteVariant);
router.delete('/products/:id', authorizeAdmin, authorizePermission('products:delete'), adminDeleteProduct);

router.get('/orders', authorizeAdmin, authorizePermission('orders:view'), getAdminOrders);
router.get('/transactions', authorizeAdmin, authorizePermission('transactions:view'), getAdminTransactions);
router.post('/orders', authorizeAdmin, authorizePermission('orders:update'), adminCreateOrder);
router.patch('/orders/:id/status', authorizeAdmin, authorizePermission('orders:update'), adminUpdateOrderStatus);
router.delete('/orders/:id', authorizeAdmin, authorizePermission('orders:update'), adminDeleteOrder);

router.get('/access-control', authorizeAdmin, authorizePermission('admins:manage'), getAdminAccessControl);
router.put('/roles/:role/permissions', authorizeAdmin, authorizePermission('roles:assign'), updateAdminRolePermissions);
router.post('/admins', authorizeAdmin, authorizePermission('admins:manage'), createAdminUser);
router.patch('/admins/:id/role', authorizeAdmin, authorizePermission('roles:assign'), updateAdminUserRole);

router.get('/users', authorizeAdmin, authorizePermission('users:view'), getAdminUsers);
router.get('/users/:id/orders', authorizeAdmin, authorizePermission('users:view'), getAdminUserOrders);
router.delete('/users/:id', authorizeAdmin, authorizePermission('users:control'), adminDeleteUser);
router.post('/users/:id/block', authorizeAdmin, authorizePermission('users:control'), adminBlockUser);
router.post('/users/:id/unblock', authorizeAdmin, authorizePermission('users:control'), adminUnblockUser);
router.post('/users/:id/logout', authorizeAdmin, authorizePermission('users:control'), adminForceLogoutUser);

module.exports = router;
