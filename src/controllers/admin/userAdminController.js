const User = require('../../models/User');
const Order = require('../../models/Order');
const UserActivity = require('../../models/UserActivity');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { emitToAdmins, socketEvents } = require('../../utils/eventBus');

const getAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('name email phone role avatar isVerified blocked lastLoginAt createdAt').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Admin users fetched successfully', { users });
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
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    user.blocked = true;
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
  getAdminUsers,
  getAdminUserOrders,
  adminDeleteUser,
  adminBlockUser,
  adminUnblockUser,
  adminForceLogoutUser,
};
