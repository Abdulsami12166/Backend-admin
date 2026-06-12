const mongoose = require('mongoose');

const notificationMarketingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    trigger: { type: String, required: true },
    conditions: [{ type: mongoose.Schema.Types.Mixed }],
    templates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate' }],
    audience: {
      segments: [{ type: String }],
      countries: [{ type: String }],
      tags: [{ type: String }],
      minOrderValue: { type: Number },
      customerTier: { type: String },
      lastActiveDays: { type: Number },
    },
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once',
    },
    active: { type: Boolean, default: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);

notificationMarketingRuleSchema.index({ trigger: 1, active: 1 });

module.exports = mongoose.model('NotificationMarketingRule', notificationMarketingRuleSchema);
