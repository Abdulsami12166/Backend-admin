const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['order', 'payment', 'delivery', 'return', 'support', 'marketing', 'system', 'account'],
      required: true,
    },
    trigger: { type: String, required: true }, // e.g., "order_placed", "payment_received"
    channels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      inApp: { type: Boolean, default: false },
    },
    emailTemplate: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
      htmlBody: { type: String, default: '' },
      variables: [{ type: String }], // e.g., ["{{orderNumber}}", "{{customerName}}"]
    },
    smsTemplate: {
      body: { type: String, default: '' },
      variables: [{ type: String }],
    },
    pushTemplate: {
      title: { type: String, default: '' },
      body: { type: String, default: '' },
      variables: [{ type: String }],
    },
    inAppTemplate: {
      title: { type: String, default: '' },
      message: { type: String, default: '' },
      variables: [{ type: String }],
    },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false }, // Cannot be deleted
    priority: { type: Number, default: 0 },
    delayInMinutes: { type: Number, default: 0 }, // Delay before sending
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      retryIntervalInMinutes: { type: Number, default: 5 },
    },
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true }
);

// name is already unique and indexed via field-level unique: true
notificationTemplateSchema.index({ trigger: 1 });
notificationTemplateSchema.index({ category: 1 });
notificationTemplateSchema.index({ isActive: 1 });

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
