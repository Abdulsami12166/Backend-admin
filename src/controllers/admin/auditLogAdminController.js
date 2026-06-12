const AuditLog = require('../../models/AuditLog');

/**
 * Get all audit logs with filters
 */
exports.getAllAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entityType, actor, status, severity, startDate, endDate, sortBy = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (actor) query.actor = actor;
    if (status) query.status = status;
    if (severity) query.severity = severity;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actor', 'name email')
      .populate('relatedEntities.id')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get audit log details
 */
exports.getAuditLogDetails = async (req, res) => {
  try {
    const { logId } = req.params;

    const log = await AuditLog.findById(logId)
      .populate('actor', 'name email role')
      .populate('relatedEntities.id');

    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }

    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get activity by user
 */
exports.getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const total = await AuditLog.countDocuments({ actor: userId });
    const logs = await AuditLog.find({ actor: userId })
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get activity by entity
 */
exports.getEntityActivity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = { entityType, entityId };
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actor', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get audit statistics
 */
exports.getAuditStats = async (req, res) => {
  try {
    const stats = await AuditLog.aggregate([
      {
        $facet: {
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } }
          ],
          byEntityType: [
            { $group: { _id: '$entityType', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          bySeverity: [
            { $group: { _id: '$severity', count: { $sum: 1 } } }
          ],
          recentFailures: [
            { $match: { status: 'failure' } },
            { $sort: { createdAt: -1 } },
            { $limit: 10 }
          ],
          recentCritical: [
            { $match: { severity: 'critical' } },
            { $sort: { createdAt: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    const total = await AuditLog.countDocuments();
    const totalFailed = await AuditLog.countDocuments({ status: 'failure' });

    res.json({
      success: true,
      data: {
        ...stats[0],
        total,
        totalFailed,
        successRate: ((total - totalFailed) / total * 100).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export audit logs
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    let query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('actor', 'name email')
      .sort('-createdAt');

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Timestamp,Actor,Action,EntityType,EntityID,Status,Severity,IPAddress\n';
      logs.forEach(log => {
        csv += `"${log.createdAt}","${log.actor?.name || 'System'}","${log.action}","${log.entityType}","${log.entityId}","${log.status}","${log.severity}","${log.ipAddress}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.send(csv);
    } else {
      res.json({ success: true, data: logs, count: logs.length });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get system health summary
 */
exports.getSystemHealthSummary = async (req, res) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const summary = await AuditLog.aggregate([
      {
        $match: { createdAt: { $gte: last24Hours } }
      },
      {
        $facet: {
          totalActions: [
            { $count: 'count' }
          ],
          failedActions: [
            { $match: { status: 'failure' } },
            { $count: 'count' }
          ],
          criticalActions: [
            { $match: { severity: 'critical' } },
            { $count: 'count' }
          ],
          avgResponseTime: [
            { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
          ],
          topActions: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period: 'last24Hours',
        totalActions: summary[0].totalActions[0]?.count || 0,
        failedActions: summary[0].failedActions[0]?.count || 0,
        criticalActions: summary[0].criticalActions[0]?.count || 0,
        avgResponseTime: summary[0].avgResponseTime[0]?.avgDuration?.toFixed(2) || 0,
        topActions: summary[0].topActions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
