const mongoose = require('mongoose');

const refundBreakdownSchema = new mongoose.Schema(
  {
    productAmount: { type: Number, default: 0, min: 0 },
    shippingRefund: { type: Number, default: 0, min: 0 },
    taxRefund: { type: Number, default: 0, min: 0 },
    additionalCredit: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const paymentDetailsSchema = new mongoose.Schema(
  {
    gateway: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    refundId: { type: String, trim: true },
  },
  { _id: false },
);

const refundRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    returnRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest' },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    reason: {
      type: String,
      enum: ['return', 'cancellation', 'complaint', 'duplicate_charge', 'other'],
      default: 'other',
    },
    refundType: {
      type: String,
      enum: ['full', 'partial'],
      default: 'partial',
    },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundBreakdown: { type: refundBreakdownSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'rejected', 'processing', 'completed', 'failed'],
      default: 'initiated',
    },
    paymentDetails: paymentDetailsSchema,
    notes: { type: String, trim: true },
    rejectionReason: { type: String, default: '' },
    approvalDate: { type: Date },
    processingDate: { type: Date },
    completionDate: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timeline: [
      {
        event: { type: String, required: true },
        description: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      }
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('RefundRequest', refundRequestSchema);
