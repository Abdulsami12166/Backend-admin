const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    channels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
    categories: {
      orders: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      shipments: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      newsletters: { type: Boolean, default: false },
      accountUpdates: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      returns: { type: Boolean, default: true },
      support: { type: Boolean, default: true },
    },
    frequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'monthly', 'never'],
      default: 'instant',
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '22:00' }, // HH:mm format
      endTime: { type: String, default: '08:00' },
      timezone: { type: String, default: 'UTC' },
    },
    unsubscribedCategories: [{ type: String }],
    marketingOptIn: { type: Boolean, default: false },
    dataRetention: {
      deleteAfterDays: { type: Number, default: 90 },
      deletePersonalData: { type: Boolean, default: false },
    },
    language: { type: String, default: 'en' },
    updatedBy: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
