const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['super-admin', 'product-manager', 'inventory-manager', 'support'],
      required: true,
      unique: true,
    },
    permissions: [{ type: String, required: true }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
