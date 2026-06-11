const mongoose = require('mongoose');

const storeSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed, // Can be string, number, boolean, object, array
    type: { 
      type: String, 
      enum: ['string', 'number', 'boolean', 'json', 'array'],
      default: 'string'
    },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['general', 'shipping', 'payment', 'tax', 'notifications', 'security', 'performance', 'display', 'inventory'],
      required: true,
    },
    section: { type: String, default: '' }, // Subcategory
    isPublic: { type: Boolean, default: false },
    isEditable: { type: Boolean, default: true },
    isRequired: { type: Boolean, default: false },
    validation: {
      min: mongoose.Schema.Types.Mixed,
      max: mongoose.Schema.Types.Mixed,
      pattern: { type: String }, // Regex pattern
      options: [mongoose.Schema.Types.Mixed], // For select dropdowns
    },
    defaultValue: mongoose.Schema.Types.Mixed,
    environment: { type: String, enum: ['all', 'development', 'production'], default: 'all' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

storeSettingSchema.index({ key: 1 });
storeSettingSchema.index({ category: 1 });
storeSettingSchema.index({ section: 1 });
storeSettingSchema.index({ category: 1, section: 1 });

module.exports = mongoose.model('StoreSetting', storeSettingSchema);
