const Product = require('../../../../backend/src/models/Product');
const { sendSuccess, sendError } = require('../../../../backend/src/utils/responseHandler');
const { logger } = require('../../utils/logger');

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
    const product = await Product.create({
      ...req.body,
      seller: req.body.seller,
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

