const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: 'Not specified' },
    condition: { type: String, trim: true, default: 'Good' },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },
  { _id: false },
);

const returnRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    returnItems: { type: [returnItemSchema], default: [] },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'rejected', 'in_transit', 'received', 'inspected', 'completed', 'cancelled'],
      default: 'initiated',
    },
    pickupAddress: addressSchema,
    images: [{ type: String }],
    adminNotes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    approvalDate: { type: Date },
    rejectionDate: { type: Date },
    completionDate: { type: Date },
    timeline: [
      {
        event: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      }
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
