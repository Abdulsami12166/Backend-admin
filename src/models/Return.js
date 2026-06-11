const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    orderItem: { type: mongoose.Schema.Types.ObjectId, required: true }, // Reference to item in order
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    condition: { type: String, enum: ['new', 'opened', 'used', 'damaged'], default: 'new' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    returnItems: [returnItemSchema],
    status: {
      type: String,
      enum: ['initiated', 'approved', 'rejected', 'in_transit', 'received', 'inspected', 'completed', 'cancelled'],
      default: 'initiated',
    },
    reason: { type: String, required: true }, // Main reason for return
    detailedReason: { type: String, default: '' },
    images: [{ type: String }], // URLs to product images showing condition
    pickupAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    trackingNumber: { type: String, default: '' },
    expectedRefundAmount: { type: Number, required: true, default: 0 },
    actualRefundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    approvalDate: { type: Date },
    rejectionDate: { type: Date },
    completionDate: { type: Date },
    adminNotes: { type: String, default: '' },
    timeline: [
      {
        event: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      }
    ],
  },
  { timestamps: true }
);

// Indexes
returnSchema.index({ order: 1 });
returnSchema.index({ user: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ refundStatus: 1 });
returnSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
