const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    actorType: { type: String, enum: ['admin_user', 'system'], default: 'admin_user' },
    action: { type: String, required: true }, // e.g., "create", "update", "delete", "login", "logout"
    entityType: { type: String, required: true }, // e.g., "product", "order", "user", "admin_user"
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityName: { type: String, default: '' },
    changes: {
      before: mongoose.Schema.Types.Mixed, // Previous values
      after: mongoose.Schema.Types.Mixed, // New values
    },
    status: { type: String, enum: ['success', 'failure'], default: 'success' },
    statusCode: { type: Number },
    errorMessage: { type: String, default: '' },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: '' },
    location: {
      country: { type: String, default: '' },
      city: { type: String, default: '' },
      region: { type: String, default: '' },
    },
    duration: { type: Number, default: 0 }, // milliseconds
    metadata: mongoose.Schema.Types.Mixed,
    resourcePath: { type: String, default: '' }, // API endpoint
    queryParameters: mongoose.Schema.Types.Mixed,
    tags: [{ type: String }], // For grouping/filtering
    relatedEntities: [
      {
        type: { type: String },
        id: { type: mongoose.Schema.Types.ObjectId },
        name: { type: String },
      }
    ],
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  },
  { timestamps: true }
);

// Indexes for efficient querying
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1 });
auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ severity: 1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
