const mongoose = require('mongoose');

const featureToggleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['product', 'order', 'payment', 'customer', 'marketing', 'system', 'experimental'],
      required: true,
    },
    isEnabled: { type: Boolean, default: false },
    visibility: {
      type: String,
      enum: ['public', 'internal', 'beta'],
      default: 'internal',
    },
    rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 }, // Gradual rollout
    targetAudience: {
      userTypes: [{ type: String, enum: ['admin', 'customer', 'guest'] }],
      regions: [{ type: String }],
      customSegments: [{ type: String }],
    },
    version: { type: String, default: '1.0.0' },
    dependencies: [
      {
        featureName: { type: String },
        requiredEnabled: { type: Boolean, default: true },
      }
    ],
    configuration: mongoose.Schema.Types.Mixed, // Feature-specific config
    performance: {
      impactLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
      estimatedLatency: { type: Number, default: 0 }, // milliseconds
    },
    fallbackBehavior: { type: String, default: '' },
    errorHandling: { type: String, default: '' },
    enabledAt: { type: Date },
    disabledAt: { type: Date },
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    disabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    metadata: mongoose.Schema.Types.Mixed,
    tags: [{ type: String }],
    documentation: {
      url: { type: String, default: '' },
      releaseNotes: { type: String, default: '' },
    },
    monitoring: {
      metricsEnabled: { type: Boolean, default: false },
      alertsEnabled: { type: Boolean, default: false },
      slackChannel: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// name is already unique and indexed via field-level unique: true
featureToggleSchema.index({ category: 1 });
featureToggleSchema.index({ isEnabled: 1 });
featureToggleSchema.index({ visibility: 1 });

module.exports = mongoose.model('FeatureToggle', featureToggleSchema);
