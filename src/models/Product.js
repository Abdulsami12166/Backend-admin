const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, trim: true },
    width: Number,
    height: Number,
    format: { type: String, trim: true },
    bytes: Number,
  },
  { _id: false },
);

const inventorySchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { _id: false },
);

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    value: { type: String, trim: true },
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    price: { type: Number, min: 0 },
    stock: { type: Number, min: 0 },
    sku: { type: String, trim: true },
    images: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    brand: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, trim: true },
    subcategory: { type: String, trim: true },
    type: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, default: 0 },
    images: [{ type: String }],
    imageMetadata: [productImageSchema],
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    specifications: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    inventory: { type: inventorySchema, default: () => ({}) },
    variants: [variantSchema],
    sizes: [{ type: String, trim: true }],
    material: { type: String, trim: true },
    color: { type: String, trim: true },
    gender: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Product', productSchema);
