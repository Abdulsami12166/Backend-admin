const mongoose = require('mongoose');

const refundLedgerSchema = new mongoose.Schema(
  {
    refund: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['refund', 'adjustment'], default: 'refund' },
    status: { type: String, enum: ['pending', 'processing', 'settled', 'failed'], default: 'pending' },
    gateway: { type: String, trim: true },
    transactionId: { type: String, trim: true, index: true },
    refundId: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

refundLedgerSchema.index({ refund: 1, transactionId: 1 }, { unique: false });

module.exports = mongoose.model('RefundLedger', refundLedgerSchema);
