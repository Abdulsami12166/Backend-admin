const User = require('../../../../backend/src/models/User');

const { sendSuccess, sendError } = require('../../../../backend/src/utils/responseHandler');

const getAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('name email phone role avatar isVerified blocked createdAt');
    return sendSuccess(res, 200, 'Admin users fetched successfully', { users });
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

module.exports = { getAdminUsers, adminDeleteUser, adminBlockUser, adminUnblockUser };

