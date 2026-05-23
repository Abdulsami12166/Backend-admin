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

const authorizeAdmin = async (req, res, next) => {
  try {
    // Extract token from Authorization header or query params
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader) {
      // Handle "Bearer <token>" format
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      } else if (parts.length === 1) {
        token = parts[0];
      }
    }

    // Fallback to query parameters
    if (!token) {
      token = req.query.token || req.query.authToken;
    }

    // Validate token exists and is not empty
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      logger.warn('Missing or invalid authorization token', {
        hasAuthHeader: !!authHeader,
        headerLength: authHeader ? authHeader.length : 0,
        hasQueryToken: !!(req.query.token || req.query.authToken),
      });
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    token = token.trim();

    // Log token for debugging (first 20 chars only for security)
    logger.info('Attempting JWT verification', {
      tokenPreview: token.substring(0, 20) + '...',
      tokenLength: token.length,
    });

    // Verify JWT token
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    // Check if user has admin role
    if (decoded.role !== 'admin') {
      logger.warn('Admin role check failed', { userId: decoded.id });
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Verify user still exists and is admin
    const currentUser = await User.findById(decoded.id).select('+tokenVersion role');
    if (!currentUser || currentUser.role !== 'admin') {
      logger.warn('Admin user not found or role changed', { userId: decoded.id });
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Check token version for token invalidation
    if (currentUser.tokenVersion !== decoded.tokenVersion) {
      logger.warn('Admin token version mismatch', { userId: decoded.id });
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = decoded;
    req.userId = decoded.id;
    return next();
  } catch (error) {
    // Log detailed error for JWT-related issues
    if (error.name === 'JsonWebTokenError') {
      logger.warn('JWT validation error', { 
        message: error.message,
        name: error.name,
        errorString: error.toString(),
      });
    } else if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired', { expiredAt: error.expiredAt });
    } else {
      logger.warn('Admin auth error', { 
        message: error.message,
        name: error.name,
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

module.exports = { adminLogin, adminMe, authorizeAdmin };