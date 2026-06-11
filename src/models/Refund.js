const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    return: { type: mongoose.Schema.Types.ObjectId, ref: 'Return', sparse: true }, // Optional, for return-related refunds
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { 
      type: String, 
      enum: ['return', 'cancellation', 'complaint', 'duplicate_charge', 'other'],
      required: true 
    },
    refundType: {
      type: String,
      enum: ['full', 'partial'],
      default: 'full',
    },
    refundAmount: { type: Number, required: true, min: 0 },
    originalAmount: { type: Number, required: true, min: 0 },
    refundBreakdown: {
      productAmount: { type: Number, default: 0 },
      shippingRefund: { type: Number, default: 0 },
      taxRefund: { type: Number, default: 0 },
      additionalCredit: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'initiated',
    },
    refundMethod: {
      type: String,
      enum: ['original_payment', 'store_credit', 'replacement'],
      default: 'original_payment',
    },
    paymentDetails: {
      gateway: { type: String }, // e.g., "razorpay", "stripe"
      transactionId: { type: String },
      refundId: { type: String },
    },
    processingNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    approvalDate: { type: Date },
    processingDate: { type: Date },
    completionDate: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    timeline: [
      {
        event: { type: String, required: true },
        description: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      }
    ],
  },
  { timestamps: true }
);

// Indexes
refundSchema.index({ order: 1 });
refundSchema.index({ user: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ createdAt: -1 });
refundSchema.index({ 'paymentDetails.refundId': 1 });

module.exports = mongoose.model('Refund', refundSchema);
