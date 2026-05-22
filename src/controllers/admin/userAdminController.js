const User = require('../../models/User');
const Order = require('../../models/Order');
const { sendSuccess, sendError } = require('../../utils/responseHandler');

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

    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('user-force-logout', {
        userId: user._id,
        message: `${user.name || user.email} was forcefully logged out`,
      });
    }

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
