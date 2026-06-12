const mongoose = require('mongoose');

const notificationEventMappingSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    event: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    templates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate' }],
    conditions: [{ type: mongoose.Schema.Types.Mixed }],
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationEventMappingSchema.index({ event: 1, active: 1 });

module.exports = mongoose.model('NotificationEventMapping', notificationEventMappingSchema);
