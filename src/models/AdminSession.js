const mongoose = require('mongoose');

const adminSessionSchema = new mongoose.Schema(
  {
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminEmail: { type: String, required: true, index: true },
    sessionToken: { type: String, required: true, unique: true },
    refreshToken: { type: String, unique: true, sparse: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    device: {
      type: { type: String }, // e.g., "desktop", "mobile", "tablet"
      os: { type: String }, // e.g., "Windows", "iOS"
      browser: { type: String }, // e.g., "Chrome", "Safari"
    },
    location: {
      country: { type: String, default: '' },
      city: { type: String, default: '' },
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    lastActivityAt: { type: Date, default: Date.now },
    loginAt: { type: Date, required: true, default: Date.now },
    logoutAt: { type: Date, sparse: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isSuspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
    activityLog: [
      {
        action: { type: String }, // e.g., "page_view", "api_call"
        resource: { type: String },
        timestamp: { type: Date, default: Date.now },
        status: { type: Number }, // HTTP status
      }
    ],
    twoFactorVerified: { type: Boolean, default: false },
    twoFactorVerifiedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for efficient querying
adminSessionSchema.index({ adminUser: 1 });
adminSessionSchema.index({ isActive: 1 });
adminSessionSchema.index({ expiresAt: 1 });
adminSessionSchema.index({ adminUser: 1, isActive: 1 });
adminSessionSchema.index({ lastActivityAt: -1 });

// Auto cleanup of expired sessions (optional TTL index)
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminSession', adminSessionSchema);
