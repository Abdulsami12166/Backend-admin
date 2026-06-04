const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { ADMIN_ROLES, normalizeRole } = require('../config/rbac');
const { getRolePermissions, hasPermission } = require('../services/rbacService');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'default_admin_secret';
const SUPPORTED_ADMIN_ROLES = [...ADMIN_ROLES, 'admin'];

const createAdminToken = (user, permissions) => jwt.sign(
  {
    id: user._id,
    role: user.role,
    permissions,
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
    const user = await User.findOne({ email }).select('+password +tokenVersion +blocked');

    if (!user || !SUPPORTED_ADMIN_ROLES.includes(normalizeRole(user.role))) {

      logger.warn('Admin login failed: not found or not admin', { email });
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    if (user.blocked) {
      logger.warn('Blocked admin attempted login', { email: user.email });
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by an administrator',
      });
    }

    const passOk = await user.comparePassword(password);
    if (!passOk) {

      logger.warn('Admin login failed: wrong password', { email, userId: user._id });
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const permissions = await getRolePermissions(user.role);
    const token = createAdminToken(user, permissions);

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
        permissions,
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
    if (!user || !SUPPORTED_ADMIN_ROLES.includes(normalizeRole(user.role))) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    const permissions = await getRolePermissions(user.role);
    return res.json({ success: true, user: { ...user.toObject(), permissions } });
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
      hasThreeParts: (token.match(/\./g) || []).length === 2,
    });

    // Validate JWT format (should have exactly 3 parts separated by dots)
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      logger.warn('Invalid JWT format: does not have 3 parts', {
        parts: jwtParts.length,
        token: token.substring(0, 30),
        hint: 'JWT must be in format: header.payload.signature. Did you forget to login first?',
      });
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token format. Login first (POST /api/v1/admin/login), then send the returned JWT as Authorization: Bearer <token>.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    // Check if user has admin role
    if (!SUPPORTED_ADMIN_ROLES.includes(normalizeRole(decoded.role))) {
      logger.warn('Admin role check failed', { userId: decoded.id });
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Verify user still exists and is admin
    const currentUser = await User.findById(decoded.id).select('+tokenVersion role blocked');
    if (!currentUser || !SUPPORTED_ADMIN_ROLES.includes(normalizeRole(currentUser.role))) {
      logger.warn('Admin user not found or role changed', { userId: decoded.id });
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Blocked admin users cannot access APIs (including re-login)
    if (currentUser.blocked) {
      logger.warn('Blocked admin attempted auth', { userId: decoded.id, email: currentUser.email });
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by an administrator',
      });
    }


    // Check token version for token invalidation
    if ((currentUser.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
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

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(normalizeRole(req.user?.role))) {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  return next();
};

const authorizePermission = permission => async (req, res, next) => {
  try {
    if (await hasPermission(req.user?.role, permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  adminLogin,
  adminMe,
  authorizeAdmin,
  authorizePermission,
  authorizeRoles,
  ADMIN_ROLES: SUPPORTED_ADMIN_ROLES,
  normalizeRole,
};
