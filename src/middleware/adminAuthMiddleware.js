const User = require('../models/User');
const { logger } = require('../utils/logger');

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || user.role !== 'admin') {
      logger.warn('Admin login failed: not found or not admin', { email });
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const passOk = await user.comparePassword(password);
    if (!passOk) {
      logger.warn('Admin login failed: wrong password', { email, userId: user._id });
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    logger.info('Admin logged in', { userId: user._id, email: user.email });

    return res.json({
      success: true,
      message: 'Admin logged in successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const adminMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.query.userId).select('-password -refreshToken -otpCode -otpExpiresAt');
    if (!user || user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const authorizeAdmin = (req, res, next) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'User ID required' });
  }
  req.userId = userId;
  next();
};

module.exports = { adminLogin, adminMe, authorizeAdmin };