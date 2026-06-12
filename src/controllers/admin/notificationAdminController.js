const asyncHandler = require('../../middleware/asyncHandler');
const NotificationTemplate = require('../../models/NotificationTemplate');
const NotificationEventMapping = require('../../models/NotificationEventMapping');
const NotificationLog = require('../../models/NotificationLog');
const NotificationMarketingRule = require('../../models/NotificationMarketingRule');
const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');

const DEFAULT_RETRY_POLICY = { maxRetries: 3, retryIntervalInMinutes: 5 };

const normalizeDocument = (doc) => {
  if (!doc) return doc;
  const data = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  data.id = data._id;
  return data;
};

exports.getAllTemplates = asyncHandler(async (req, res) => {
  const { category, trigger, channel, active, page = 1, limit = 50 } = req.query;
  const query = {};

  if (category) query.category = category;
  if (trigger) query.trigger = trigger;
  if (channel) query[`channels.${channel}`] = true;
  if (active !== undefined) query.isActive = active === 'true';

  const total = await NotificationTemplate.countDocuments(query);
  const templates = await NotificationTemplate.find(query)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.status(200).json({
    success: true,
    data: templates.map((template) => ({ ...template, id: template._id })),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
});

exports.getTemplateDetails = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await NotificationTemplate.findById(templateId).lean();

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }

  res.status(200).json({
    success: true,
    data: { ...template, id: template._id },
  });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    displayName,
    description,
    category,
    trigger,
    channels = {},
    emailTemplate = {},
    smsTemplate = {},
    pushTemplate = {},
    inAppTemplate = {},
    isActive = true,
    isSystem = false,
    priority = 0,
    delayInMinutes = 0,
    retryPolicy = DEFAULT_RETRY_POLICY,
    tags = [],
    metadata = {},
  } = req.body;

  const template = new NotificationTemplate({
    name,
    displayName: displayName || name,
    description,
    category,
    trigger,
    channels,
    emailTemplate,
    smsTemplate,
    pushTemplate,
    inAppTemplate,
    isActive,
    isSystem,
    priority,
    delayInMinutes,
    retryPolicy,
    tags,
    metadata,
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });

  await template.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'create_notification_template',
    entityType: 'notification_template',
    entityId: template._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { after: template.toObject() },
  });

  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    data: normalizeDocument(template),
  });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await NotificationTemplate.findById(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }

  if (template.isSystem && req.body.isActive === false) {
    return res.status(403).json({ success: false, message: 'System templates cannot be deactivated' });
  }

  const before = template.toObject();
  Object.assign(template, req.body);
  template.updatedBy = req.adminUser._id;
  await template.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'update_notification_template',
    entityType: 'notification_template',
    entityId: template._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before, after: template.toObject() },
  });

  res.status(200).json({
    success: true,
    message: 'Template updated successfully',
    data: normalizeDocument(template),
  });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await NotificationTemplate.findById(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found',
    });
  }

  if (template.isSystem) {
    return res.status(403).json({
      success: false,
      message: 'System templates cannot be deleted',
    });
  }

  await template.deleteOne();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'delete_notification_template',
    entityType: 'notification_template',
    entityId: template._id,
    status: 'success',
    severity: 'warning',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before: normalizeDocument(template) },
  });

  res.status(200).json({
    success: true,
    message: 'Template deleted successfully',
  });
});

exports.getAllEventMappings = asyncHandler(async (req, res) => {
  const { event, active, page = 1, limit = 50 } = req.query;
  const query = {};

  if (event) query.event = event;
  if (active !== undefined) query.active = active === 'true';

  const total = await NotificationEventMapping.countDocuments(query);
  const mappings = await NotificationEventMapping.find(query)
    .populate('templates', 'name displayName')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    success: true,
    data: mappings.map(normalizeDocument),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
});

exports.createEventMapping = asyncHandler(async (req, res) => {
  const { event, templates = [], conditions = [], active = true, description = '' } = req.body;

  const mapping = new NotificationEventMapping({
    event,
    description,
    templates,
    conditions,
    active,
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });

  await mapping.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'create_notification_event_mapping',
    entityType: 'notification_event_mapping',
    entityId: mapping._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { after: mapping.toObject() },
  });

  res.status(201).json({
    success: true,
    message: 'Event mapping created successfully',
    data: normalizeDocument(mapping),
  });
});

exports.updateEventMapping = asyncHandler(async (req, res) => {
  const { mappingId } = req.params;
  const mapping = await NotificationEventMapping.findById(mappingId);

  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Event mapping not found',
    });
  }

  const before = mapping.toObject();
  Object.assign(mapping, req.body);
  mapping.updatedBy = req.adminUser._id;
  await mapping.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'update_notification_event_mapping',
    entityType: 'notification_event_mapping',
    entityId: mapping._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before, after: mapping.toObject() },
  });

  res.status(200).json({
    success: true,
    message: 'Event mapping updated successfully',
    data: normalizeDocument(mapping),
  });
});

exports.deleteEventMapping = asyncHandler(async (req, res) => {
  const { mappingId } = req.params;
  const mapping = await NotificationEventMapping.findById(mappingId);

  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Event mapping not found',
    });
  }

  await mapping.deleteOne();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'delete_notification_event_mapping',
    entityType: 'notification_event_mapping',
    entityId: mapping._id,
    status: 'success',
    severity: 'warning',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before: normalizeDocument(mapping) },
  });

  res.status(200).json({
    success: true,
    message: 'Event mapping deleted successfully',
  });
});

exports.getAllNotificationLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, channel, event, recipient } = req.query;
  const query = {};

  if (status) query.status = status;
  if (channel) query.channel = channel;
  if (event) query.event = event;
  if (recipient) query.$or = [
    { 'recipient.email': new RegExp(recipient, 'i') },
    { 'recipient.phone': new RegExp(recipient, 'i') },
  ];

  const total = await NotificationLog.countDocuments(query);
  const logs = await NotificationLog.find(query)
    .populate('template', 'name category trigger')
    .populate('user', 'name email')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    success: true,
    data: logs.map(normalizeDocument),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
});

exports.getNotificationLogDetails = asyncHandler(async (req, res) => {
  const { logId } = req.params;
  const log = await NotificationLog.findById(logId)
    .populate('template', 'name category trigger')
    .populate('user', 'name email');

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Notification log not found',
    });
  }

  res.status(200).json({
    success: true,
    data: normalizeDocument(log),
  });
});

exports.createNotificationLog = asyncHandler(async (req, res) => {
  const {
    templateId,
    userId,
    channel,
    subject,
    content,
    recipient = {},
    status = 'pending',
    event,
    variables = {},
    order,
    externalId = '',
    metadata = {},
  } = req.body;

  if (!templateId || !userId || !content || !channel) {
    return res.status(400).json({
      success: false,
      message: 'templateId, userId, channel and content are required',
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const log = new NotificationLog({
    template: templateId,
    user: userId,
    order,
    channel,
    subject,
    content,
    recipient,
    status,
    event,
    variables,
    externalId,
    metadata,
  });

  await log.save();

  res.status(201).json({
    success: true,
    message: 'Notification log created successfully',
    data: normalizeDocument(log),
  });
});

exports.getNotificationStats = asyncHandler(async (req, res) => {
  const total = await NotificationLog.countDocuments();
  const sent = await NotificationLog.countDocuments({ status: 'sent' });
  const failed = await NotificationLog.countDocuments({ status: 'failed' });
  const pending = await NotificationLog.countDocuments({ status: 'pending' });
  const byChannel = await NotificationLog.aggregate([
    { $group: { _id: '$channel', count: { $sum: 1 } } },
  ]);

  const byType = byChannel.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      total,
      sent,
      failed,
      pending,
      byType,
    },
  });
});

exports.getAllMarketingRules = asyncHandler(async (req, res) => {
  const { trigger, active, page = 1, limit = 50 } = req.query;
  const query = {};

  if (trigger) query.trigger = trigger;
  if (active !== undefined) query.active = active === 'true';

  const total = await NotificationMarketingRule.countDocuments(query);
  const rules = await NotificationMarketingRule.find(query)
    .populate('templates', 'name displayName')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    success: true,
    data: rules.map(normalizeDocument),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
});

exports.createMarketingRule = asyncHandler(async (req, res) => {
  const {
    name,
    trigger,
    description = '',
    conditions = [],
    templates = [],
    audience = {},
    frequency = 'once',
    active = true,
    metadata = {},
    tags = [],
  } = req.body;

  const rule = new NotificationMarketingRule({
    name,
    description,
    trigger,
    conditions,
    templates,
    audience,
    frequency,
    active,
    metadata,
    tags,
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });

  await rule.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'create_marketing_rule',
    entityType: 'marketing_rule',
    entityId: rule._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { after: rule.toObject() },
  });

  res.status(201).json({
    success: true,
    message: 'Marketing rule created successfully',
    data: normalizeDocument(rule),
  });
});

exports.updateMarketingRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const rule = await NotificationMarketingRule.findById(ruleId);

  if (!rule) {
    return res.status(404).json({
      success: false,
      message: 'Marketing rule not found',
    });
  }

  const before = rule.toObject();
  Object.assign(rule, req.body);
  rule.updatedBy = req.adminUser._id;
  await rule.save();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'update_marketing_rule',
    entityType: 'marketing_rule',
    entityId: rule._id,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before, after: rule.toObject() },
  });

  res.status(200).json({
    success: true,
    message: 'Marketing rule updated successfully',
    data: normalizeDocument(rule),
  });
});

exports.deleteMarketingRule = asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const rule = await NotificationMarketingRule.findById(ruleId);

  if (!rule) {
    return res.status(404).json({
      success: false,
      message: 'Marketing rule not found',
    });
  }

  await rule.deleteOne();

  await AuditLog.create({
    actor: req.adminUser._id,
    action: 'delete_marketing_rule',
    entityType: 'marketing_rule',
    entityId: rule._id,
    status: 'success',
    severity: 'warning',
    ipAddress: req.ip,
    resourcePath: req.originalUrl,
    changes: { before: normalizeDocument(rule) },
  });

  res.status(200).json({
    success: true,
    message: 'Marketing rule deleted successfully',
  });
});
