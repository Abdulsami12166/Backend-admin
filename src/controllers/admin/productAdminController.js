const Product = require('../../models/Product');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { logger } = require('../../utils/logger');

const slugify = value =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getAdminProducts = async (req, res, next) => {
  try {
    const products = await Product.find().populate('seller', 'name email role blocked');
    return sendSuccess(res, 200, 'Admin products fetched successfully', { products });
  } catch (e) {
    next(e);
  }
};

const adminCreateProduct = async (req, res, next) => {
  try {
    const baseSlug = slugify(req.body.slug || req.body.title);
    const product = await Product.create({
      ...req.body,
      slug: `${baseSlug || 'product'}-${Date.now()}`,
      seller: req.body.seller || req.userId,
      images: Array.isArray(req.body.images)
        ? req.body.images.filter(Boolean)
        : req.body.image
          ? [req.body.image]
          : [],
      isPublished: req.body.isPublished ?? true,
    });

    logger.info('Admin created product', { productId: product._id });
    return sendSuccess(res, 201, 'Product created successfully', { product });
  } catch (e) {
    next(e);
  }
};

const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    Object.assign(product, req.body);
    await product.save();

    return sendSuccess(res, 200, 'Product updated successfully', { product });
  } catch (e) {
    next(e);
  }
};

const adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    await product.deleteOne();
    return sendSuccess(res, 200, 'Product deleted successfully');
  } catch (e) {
    next(e);
  }
};

module.exports = {
  getAdminProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
};

