const asyncHandler = require('../../middleware/asyncHandler');
const AdminSession = require('../../models/AdminSession');
const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');
const UserActivity = require('../../models/UserActivity');

const sanitizeSearch = value => typeof value === 'string' && value.trim() ? value.trim() : null;

exports.getAllActiveSessions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const skip = (Math.max(page, 1) - 1) * limit;
  const sortBy = String(req.query.sortBy || '-loginAt');
  const search = sanitizeSearch(req.query.search);
  const status = String(req.query.status || '').toLowerCase();

  const query = {};

  if (status === 'active') query.isActive = true;
  if (status === 'terminated') query.isActive = false;
  if (search) {
    query.$or = [
      { adminEmail: { $regex: search, $options: 'i' } },
      { ipAddress: { $regex: search, $options: 'i' } },
      { userAgent: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await AdminSession.countDocuments(query);
  const sessions = await AdminSession.find(query)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .populate('adminUser', 'name email role');

  res.status(200).json({
    success: true,
    count: sessions.length,
    total,
    data: sessions,
  });
});

exports.getAdminSessions = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const skip = (Math.max(page, 1) - 1) * limit;
  const sortBy = String(req.query.sortBy || '-loginAt');
  const status = String(req.query.status || '').toLowerCase();
  const search = sanitizeSearch(req.query.search);

  const query = { adminUser: adminId };

  if (status === 'active') query.isActive = true;
  if (status === 'terminated') query.isActive = false;
  if (search) {
    query.$or = [
      { ipAddress: { $regex: search, $options: 'i' } },
      { userAgent: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await AdminSession.countDocuments(query);
  const sessions = await AdminSession.find(query)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .populate('adminUser', 'name email role');

  res.status(200).json({
    success: true,
    count: sessions.length,
    total,
    data: sessions,
  });
});

exports.getSessionDetails = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AdminSession.findOne({ sessionToken: sessionId }).populate('adminUser', 'name email role');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  res.status(200).json({
    success: true,
    data: session,
  });
});

exports.createSession = asyncHandler(async (req, res) => {
  const { adminId, adminEmail, ipAddress, userAgent, loginTime } = req.body;

  const adminUser = await User.findById(adminId);
  if (!adminUser) {
    return res.status(404).json({ success: false, message: 'Admin user not found' });
  }

  const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const session = await AdminSession.create({
    adminUser: adminUser._id,
    adminEmail: adminEmail || adminUser.email,
    sessionToken,
    ipAddress: ipAddress || req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: userAgent || req.headers['user-agent'] || '',
    loginAt: loginTime ? new Date(loginTime) : new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: 'Session created successfully',
    data: session,
  });
});

exports.forceLogout = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AdminSession.findOne({ sessionToken: sessionId });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  session.isActive = false;
  session.logoutAt = new Date();
  await session.save();

  // record admin logout activity
  try {
    await UserActivity.create({
      user: session.adminUser,
      action: 'logout',
      details: 'Admin session forcefully terminated',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (e) {
    // swallow - non-critical
  }
  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'force_logout',
    entityType: 'admin_session',
    entityId: session._id,
    entityName: session.adminEmail,
    status: 'success',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || '',
    resourcePath: req.originalUrl,
    metadata: {
      sessionToken: session.sessionToken,
      adminUser: session.adminUser,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Admin session terminated successfully',
    data: session,
  });
});

exports.forceLogoutAllForAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;

  const result = await AdminSession.updateMany(
    { adminUser: adminId, isActive: true },
    { isActive: false, logoutAt: new Date() },
  );

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'force_logout_all',
    entityType: 'admin_user',
    entityId: adminId,
    entityName: String(adminId),
    status: 'success',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || '',
    resourcePath: req.originalUrl,
    metadata: {
      terminatedCount: result.modifiedCount || result.nModified || 0,
    },
  });

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.nModified || 0} session(s) terminated`,
    data: { terminatedCount: result.modifiedCount || result.nModified || 0 },
  });
});

exports.updateSessionActivity = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await AdminSession.findOne({ sessionToken: sessionId });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  session.lastActivityAt = new Date();
  await session.save();

  res.status(200).json({
    success: true,
    message: 'Session activity updated',
    data: session,
  });
});

exports.getSessionStats = asyncHandler(async (req, res) => {
  const total = await AdminSession.countDocuments();
  const activeSessions = await AdminSession.countDocuments({ isActive: true });
  const terminatedSessions = await AdminSession.countDocuments({ isActive: false });

  const sessionsByAdmin = await AdminSession.aggregate([
    {
      $group: {
        _id: '$adminEmail',
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        terminated: { $sum: { $cond: ['$isActive', 0, 1] } },
      },
    },
    { $sort: { total: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalSessions: total,
      activeSessions,
      terminatedSessions,
      sessionsByAdmin,
    },
  });
});
