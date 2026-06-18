const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate', required: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', sparse: true },
    recipient: {
      email: { type: String },
      phone: { type: String },
      userId: { type: mongoose.Schema.Types.ObjectId },
    },
    channel: { type: String, enum: ['email', 'sms', 'push', 'inApp'], required: true },
    subject: { type: String, default: '' },
    content: { type: String, required: true },
    variables: mongoose.Schema.Types.Mixed, // Filled variables used in template
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'unsubscribed'],
      default: 'pending',
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failureReason: { type: String, default: '' },
    retryCount: { type: Number, default: 0 },
    externalId: { type: String, default: '' }, // Provider's message ID
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

// Indexes
notificationLogSchema.index({ template: 1 });
notificationLogSchema.index({ user: 1 });
notificationLogSchema.index({ order: 1 });
notificationLogSchema.index({ channel: 1 });
notificationLogSchema.index({ status: 1 });
notificationLogSchema.index({ createdAt: -1 });
notificationLogSchema.index({ 'recipient.email': 1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
