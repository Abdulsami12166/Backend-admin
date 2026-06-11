const asyncHandler = require('../../middleware/asyncHandler');

// Mock sessions data
const activeSessions = new Map();

exports.getAllActiveSessions = asyncHandler(async (req, res) => {
  const sessions = Array.from(activeSessions.values());
  
  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions,
  });
});

exports.getAdminSessions = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const sessions = Array.from(activeSessions.values()).filter(
    session => session.adminId === adminId
  );
  
  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions,
  });
});

exports.getSessionDetails = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
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
  
  const sessionId = `sess_${Date.now()}`;
  const session = {
    id: sessionId,
    adminId,
    adminEmail,
    ipAddress,
    userAgent,
    loginTime: loginTime || new Date(),
    lastActivityTime: new Date(),
    status: 'active',
  };
  
  activeSessions.set(sessionId, session);
  
  res.status(201).json({
    success: true,
    message: 'Session created successfully',
    data: session,
  });
});

exports.forceLogout = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }
  
  session.status = 'terminated';
  session.terminatedAt = new Date();
  activeSessions.set(sessionId, session);
  
  res.status(200).json({
    success: true,
    message: 'Admin session terminated successfully',
    data: session,
  });
});

exports.forceLogoutAllForAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  
  let terminatedCount = 0;
  for (const [key, session] of activeSessions.entries()) {
    if (session.adminId === adminId) {
      session.status = 'terminated';
      session.terminatedAt = new Date();
      activeSessions.set(key, session);
      terminatedCount++;
    }
  }
  
  res.status(200).json({
    success: true,
    message: `${terminatedCount} session(s) terminated`,
    data: { terminatedCount },
  });
});

exports.updateSessionActivity = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }
  
  session.lastActivityTime = new Date();
  activeSessions.set(sessionId, session);
  
  res.status(200).json({
    success: true,
    message: 'Session activity updated',
    data: session,
  });
});

exports.getSessionStats = asyncHandler(async (req, res) => {
  const sessions = Array.from(activeSessions.values());
  const activeSessCount = sessions.filter(s => s.status === 'active').length;
  const totalLoginCount = sessions.length;
  
  // Group by admin
  const byAdmin = {};
  sessions.forEach(session => {
    if (!byAdmin[session.adminId]) {
      byAdmin[session.adminId] = 0;
    }
    if (session.status === 'active') {
      byAdmin[session.adminId]++;
    }
  });
  
  res.status(200).json({
    success: true,
    data: {
      activeSessions: activeSessCount,
      totalSessions: totalLoginCount,
      sessionsByAdmin: byAdmin,
    },
  });
});
