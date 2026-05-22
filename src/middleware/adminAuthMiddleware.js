const jwt = require('jsonwebtoken');
const User = require('../../../backend/src/models/User');
const { logger } = require('../utils/logger');

// Admin server validates admin JWT.
// This reuses the same User collection/role field.
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      logger.warn('Admin protected route denied because token is missing');
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken -otpCode -otpExpiresAt');

    if (!user) {
      logger.warn('Admin protected route denied because user not found');
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    logger.warn('Admin role-based access denied', {
      role: req.user?.role,
      requiredRoles: roles,
    });
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  next();
};

module.exports = { protect, authorize };

