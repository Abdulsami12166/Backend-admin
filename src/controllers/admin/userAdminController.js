const User = require('../../models/User');
const Order = require('../../models/Order');
const UserActivity = require('../../models/UserActivity');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { emitToAdmins, socketEvents } = require('../../utils/eventBus');
const { ADMIN_ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, normalizeRole } = require('../../config/rbac');
const { getPermissionMatrix, updateRolePermissions } = require('../../services/rbacService');

const MANAGED_ADMIN_ROLES = ADMIN_ROLES.filter(role => role !== 'super-admin');

const getAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('name email phone role avatar isVerified blocked lastLoginAt createdAt').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Admin users fetched successfully', { users });
  } catch (e) {
    next(e);
  }
};

const getAdminAccessControl = async (req, res, next) => {
  try {
    const permissionsByRole = await getPermissionMatrix();
    const admins = await User.find({ role: { $in: ADMIN_ROLES } })
      .select('name email role isVerified blocked lastLoginAt createdAt')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Admin access control fetched successfully', {
      roles: ADMIN_ROLES,
      managedRoles: MANAGED_ADMIN_ROLES,
      permissions: PERMISSIONS,
      defaultPermissions: DEFAULT_ROLE_PERMISSIONS,
      permissionsByRole,
      admins,
    });
  } catch (e) {
    next(e);
  }
};

const updateAdminRolePermissions = async (req, res, next) => {
  try {
    const permissionsByRole = await updateRolePermissions({
      role: req.params.role,
      permissions: req.body.permissions,
      updatedBy: req.userId,
    });

    await UserActivity.create({
      user: req.userId,
      action: 'role_permissions_update',
      details: `Updated permissions for ${normalizeRole(req.params.role)}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return sendSuccess(res, 200, 'Role permissions updated successfully', { permissionsByRole });
  } catch (e) {
    next(e);
  }
};

const createAdminUser = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = normalizeRole(req.body.role);

    if (!name || !email || !password) {
      return sendError(res, 400, 'Name, email and password are required');
    }
    if (!MANAGED_ADMIN_ROLES.includes(role)) {
      return sendError(res, 400, 'Only managed sub-admin roles can be assigned here');
    }
    if (password.length < 10) {
      return sendError(res, 400, 'Admin password must be at least 10 characters');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return sendError(res, 409, 'An account with this email already exists');
    }

    const admin = await User.create({
      name,
      email,
      password,
      role,
      isVerified: true,
      blocked: false,
    });

    await UserActivity.create({
      user: admin._id,
      action: 'admin_created',
      details: `${admin.email} was created as ${admin.role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return sendSuccess(res, 201, 'Admin user created successfully', {
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified,
        blocked: admin.blocked,
      },
    });
  } catch (e) {
    next(e);
  }
};

const updateAdminUserRole = async (req, res, next) => {
  try {
    const role = normalizeRole(req.body.role);
    if (!MANAGED_ADMIN_ROLES.includes(role)) {
      return sendError(res, 400, 'Only managed sub-admin roles can be assigned here');
    }

    const admin = await User.findById(req.params.id).select('+tokenVersion');
    if (!admin) return sendError(res, 404, 'Admin not found');
    if (!MANAGED_ADMIN_ROLES.includes(normalizeRole(admin.role))) {
      return sendError(res, 403, 'Super Admin role cannot be changed here');
    }

    admin.role = role;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();

    return sendSuccess(res, 200, 'Admin role updated successfully', { admin });
  } catch (e) {
    next(e);
  }
};

const getAdminUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'User orders fetched successfully', { orders });
  } catch (e) {
    next(e);
  }
};

const adminDeleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    await user.deleteOne();
    return sendSuccess(res, 200, 'User deleted successfully');
  } catch (e) {
    next(e);
  }
};

const adminBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+refreshToken +tokenVersion');
    if (!user) return sendError(res, 404, 'User not found');

    user.blocked = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = undefined;
    await user.save();

    await UserActivity.create({
      user: user._id,
      action: 'profile_update',
      details: `${user.name || user.email} was blocked by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return sendSuccess(res, 200, 'User blocked successfully', { user });
  } catch (e) {
    next(e);
  }
};

const adminUnblockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    user.blocked = false;
    await user.save();

    await UserActivity.create({
      user: user._id,
      action: 'profile_update',
      details: `${user.name || user.email} was unblocked by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return sendSuccess(res, 200, 'User unblocked successfully', { user });
  } catch (e) {
    next(e);
  }
};

const adminForceLogoutUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+refreshToken +tokenVersion');
    if (!user) return sendError(res, 404, 'User not found');

    // Increment tokenVersion so existing JWTs become invalid immediately
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.refreshToken = undefined;
    await user.save();

    const payload = {
      userId: String(user._id),
      message: `${user.name || user.email} was forcefully logged out`,
    };

    emitToAdmins(req.app, socketEvents.LEGACY.USER_FORCE_LOGOUT, payload);
    emitToAdmins(req.app, socketEvents.DOMAIN.ADMIN_FORCE_LOGOUT, payload);

    await UserActivity.create({
      user: user._id,
      action: 'logout',
      details: `${user.name || user.email} was forcefully logged out by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return sendSuccess(res, 200, 'User has been forcefully logged out');
  } catch (e) {
    next(e);
  }
};

module.exports = {
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
};
