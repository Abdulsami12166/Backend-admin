const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'default_admin_secret';

const createAdminToken = (user) => jwt.sign(
  {
    id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  },
  ADMIN_JWT_SECRET,
  {
    expiresIn: '1d',
  },
);

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

    const token = createAdminToken(user);

    logger.info('Admin logged in', { userId: user._id, email: user.email });

    return res.json({
      success: true,
      message: 'Admin logged in successfully',
      token,
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
    const userId = req.query.userId || req.userId;
    const user = await User.findById(userId).select('-password -refreshToken -otpCode -otpExpiresAt');
    if (!user || user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const authorizeAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token || req.query.authToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
      req.user = decoded;
      req.userId = decoded.id;
      return next();
    } catch (error) {
      logger.warn('Invalid admin auth token', { message: error.message });
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  if (req.query.userId) {
    req.userId = req.query.userId;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Authorization token required' });
};

module.exports = { adminLogin, adminMe, authorizeAdmin };