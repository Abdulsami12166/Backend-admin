const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, enum: ['login', 'logout', 'order', 'profile_update', 'password_change'] },
    details: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserActivity', userActivitySchema);