const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema(
  {
    status: { 
      type: String, 
      enum: ['created', 'picked', 'packed', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
      required: true 
    },
    location: { type: String, default: '' },
    description: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    trackingNumber: { type: String, unique: true, sparse: true },
    carrier: { type: String, default: '' }, // e.g., "FedEx", "UPS", "DHL"
    estimatedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
    weight: { type: Number, default: 0 }, // in kg
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['pending', 'picked', 'packed', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
      default: 'pending',
    },
    trackingEvents: [trackingEventSchema],
    cost: { type: Number, default: 0 },
    insuranceCost: { type: Number, default: 0 },
    isInsured: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for tracking
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ order: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
