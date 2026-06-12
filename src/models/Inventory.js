const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    availableStock: { type: Number, required: true, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    reorderQuantity: { type: Number, default: 50, min: 1 },
    warehouseLocation: { type: String, default: '' },
    lastRestockedAt: { type: Date },
    lastRestockedQuantity: { type: Number, default: 0 },
    stockMovements: [
      {
        type: { type: String, enum: ['in', 'out', 'adjustment', 'damage', 'return'], required: true },
        quantity: { type: Number, required: true },
        reference: { type: String }, // Order ID, Return ID, etc.
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      }
    ],
    lowStockAlertSent: { type: Boolean, default: false },
    lowStockAlertSentAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Update availableStock before save
inventorySchema.pre('save', function(next) {
  this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
  next();
});

// Index for low stock queries
inventorySchema.index({ currentStock: 1 });
inventorySchema.index({ availableStock: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
