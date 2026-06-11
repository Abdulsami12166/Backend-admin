const asyncHandler = require('../../middleware/asyncHandler');

// Mock data for notifications
const notificationTemplates = new Map();
const eventMappings = new Map();
const notificationLogs = new Map();
const marketingRules = new Map();

// TEMPLATES
exports.getAllTemplates = asyncHandler(async (req, res) => {
  const templates = Array.from(notificationTemplates.values());
  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates,
  });
});

exports.getTemplateDetails = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = notificationTemplates.get(templateId);
  
  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }
  
  res.status(200).json({
    success: true,
    data: template,
  });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const { name, type, subject, body, variables, channel } = req.body;
  
  const templateId = `tpl_${Date.now()}`;
  const template = {
    id: templateId,
    name,
    type, // email, sms, push
    subject,
    body,
    variables: variables || [],
    channel,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };
  
  notificationTemplates.set(templateId, template);
  
  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    data: template,
  });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = notificationTemplates.get(templateId);
  
  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }
  
  const updated = {
    ...template,
    ...req.body,
    updatedAt: new Date(),
  };
  
  notificationTemplates.set(templateId, updated);
  
  res.status(200).json({
    success: true,
    message: 'Template updated successfully',
    data: updated,
  });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  
  if (!notificationTemplates.has(templateId)) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }
  
  notificationTemplates.delete(templateId);
  
  res.status(200).json({
    success: true,
    message: 'Template deleted successfully',
  });
});

// EVENT MAPPINGS
exports.getAllEventMappings = asyncHandler(async (req, res) => {
  const mappings = Array.from(eventMappings.values());
  res.status(200).json({
    success: true,
    count: mappings.length,
    data: mappings,
  });
});

exports.createEventMapping = asyncHandler(async (req, res) => {
  const { event, templates, conditions, active } = req.body;
  
  const mappingId = `evt_${Date.now()}`;
  const mapping = {
    id: mappingId,
    event, // order.created, order.shipped, return.initiated, etc
    templates: templates || [],
    conditions: conditions || [],
    active: active !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  eventMappings.set(mappingId, mapping);
  
  res.status(201).json({
    success: true,
    message: 'Event mapping created successfully',
    data: mapping,
  });
});

exports.updateEventMapping = asyncHandler(async (req, res) => {
  const { mappingId } = req.params;
  const mapping = eventMappings.get(mappingId);
  
  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Event mapping not found',
    });
  }
  
  const updated = {
    ...mapping,
    ...req.body,
    updatedAt: new Date(),
  };
  
  eventMappings.set(mappingId, updated);
  
  res.status(200).json({
    success: true,
    message: 'Event mapping updated successfully',
    data: updated,
  });
});

exports.deleteEventMapping = asyncHandler(async (req, res) => {
  const { mappingId } = req.params;
  
  if (!eventMappings.has(mappingId)) {
    return res.status(404).json({
      success: false,
      message: 'Event mapping not found',
    });
  }
  
  eventMappings.delete(mappingId);
  
  res.status(200).json({
    success: true,
    message: 'Event mapping deleted successfully',
  });
});

// NOTIFICATION LOGS
exports.getAllNotificationLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;
  
  let logs = Array.from(notificationLogs.values());
  
  if (status) logs = logs.filter(log => log.status === status);
  if (type) logs = logs.filter(log => log.type === type);
  
  const start = (page - 1) * limit;
  const paginatedLogs = logs.slice(start, start + parseInt(limit));
  
  res.status(200).json({
    success: true,
    count: paginatedLogs.length,
    total: logs.length,
    page: parseInt(page),
    limit: parseInt(limit),
    data: paginatedLogs,
  });
});

exports.getNotificationLogDetails = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const log = notificationLogs.get(logId);
  
  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Notification log not found',
    });
  }
  
  res.status(200).json({
    success: true,
    data: log,
  });
});

exports.createNotificationLog = asyncHandler(async (req, res) => {
  const { templateId, userId, type, recipient, status, event } = req.body;
  
  const logId = `ntf_${Date.now()}`;
  const log = {
    id: logId,
    templateId,
    userId,
    type, // email, sms, push
    recipient,
    status, // pending, sent, failed
    event,
    attempts: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  notificationLogs.set(logId, log);
  
  res.status(201).json({
    success: true,
    message: 'Notification log created successfully',
    data: log,
  });
});

exports.getNotificationStats = asyncHandler(async (req, res) => {
  const logs = Array.from(notificationLogs.values());
  
  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    pending: logs.filter(l => l.status === 'pending').length,
    byType: {
      email: logs.filter(l => l.type === 'email').length,
      sms: logs.filter(l => l.type === 'sms').length,
      push: logs.filter(l => l.type === 'push').length,
    },
  };
  
  res.status(200).json({
    success: true,
    data: stats,
  });
});

// MARKETING RULES
exports.getAllMarketingRules = asyncHandler(async (req, res) => {
  const rules = Array.from(marketingRules.values());
  res.status(200).json({
    success: true,
    count: rules.length,
    data: rules,
  });
});

exports.createMarketingRule = asyncHandler(async (req, res) => {
  const { name, trigger, condition, templates, audience, frequency, active } = req.body;
  
  const ruleId = `mrk_${Date.now()}`;
  const rule = {
    id: ruleId,
    name,
    trigger, // signup, purchase, abandoned_cart, etc
    condition: condition || {},
    templates: templates || [],
    audience: audience || {},
    frequency: frequency || 'once',
    active: active !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  marketingRules.set(ruleId, rule);
  
  res.status(201).json({
    success: true,
    message: 'Marketing rule created successfully',
    data: rule,
  });
});

exports.updateMarketingRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const rule = marketingRules.get(ruleId);
  
  if (!rule) {
    return res.status(404).json({
      success: false,
      message: 'Marketing rule not found',
    });
  }
  
  const updated = {
    ...rule,
    ...req.body,
    updatedAt: new Date(),
  };
  
  marketingRules.set(ruleId, updated);
  
  res.status(200).json({
    success: true,
    message: 'Marketing rule updated successfully',
    data: updated,
  });
});

exports.deleteMarketingRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  
  if (!marketingRules.has(ruleId)) {
    return res.status(404).json({
      success: false,
      message: 'Marketing rule not found',
    });
  }
  
  marketingRules.delete(ruleId);
  
  res.status(200).json({
    success: true,
    message: 'Marketing rule deleted successfully',
  });
});
