const Product = require('../../models/Product');
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendServerError,
} = require('../../utils/feedback');
const { logger } = require('../../utils/logger');
const { uploadProductImages } = require('../../services/productImageService');
const { emitToAdmins, emitToAll, socketEvents } = require('../../utils/eventBus');
const { auditAction, auditError } = require('../../utils/workflow');

const CATEGORY_CONFIG = {
  Mobiles: {
    subcategories: ['Gaming Phones', 'Camera Phones', 'Performance Phones', 'Battery Phones', 'Budget Phones', 'Flagship Phones'],
    attributes: ['ram', 'storage', 'battery', 'camera', 'processor'],
  },
  Laptops: {
    subcategories: ['Gaming Laptops', 'Performance Laptops', 'Student Laptops', 'Business Laptops', 'Creator Laptops', 'Budget Laptops'],
    attributes: ['processor', 'ram', 'storage', 'gpu', 'displaySize'],
  },
  Fashion: {
    subcategories: ['Men', 'Women', 'Kids', 'Footwear', 'Traditional', 'Casual', 'Formal'],
    attributes: ['size', 'color', 'material', 'brand'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  Accessories: {
    subcategories: ['Watches', 'Headphones', 'Chargers', 'Power Banks', 'Cases'],
    attributes: ['brand', 'color', 'material'],
  },
  Gaming: {
    subcategories: ['Gaming Consoles', 'Gaming Accessories', 'Gaming Laptops', 'Gaming Phones'],
    attributes: ['platform', 'storage', 'edition'],
  },
  Electronics: {
    subcategories: ['Audio', 'Cameras', 'Wearables', 'Smart Home', 'Storage'],
    attributes: ['brand', 'model', 'warranty'],
  },
};

const parseMaybeJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const cleanObject = value =>
  (value instanceof Map ? Array.from(value.entries()) : Object.entries(value || {})).reduce((next, [key, rawValue]) => {
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      next[key] = rawValue;
    }
    return next;
  }, {});

const normalizeArray = value => {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
};

const validateProductPayload = (body, files = [], existingProduct = null) => {
  const title = String(body.title || body.name || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const subcategory = String(body.subcategory || body.subCategory || '').trim();
  const price = Number(body.price);
  const discountedPrice = body.discountedPrice === undefined || body.discountedPrice === ''
    ? undefined
    : Number(body.discountedPrice);
  const stock = body.stock === undefined || body.stock === '' ? 0 : Number(body.stock);

  if (!title) throw Object.assign(new Error('Product title is required'), { statusCode: 400 });
  if (!description) throw Object.assign(new Error('Product description is required'), { statusCode: 400 });
  if (!CATEGORY_CONFIG[category]) throw Object.assign(new Error('Unsupported product category'), { statusCode: 400 });
  if (!CATEGORY_CONFIG[category].subcategories.includes(subcategory)) {
    throw Object.assign(new Error('Unsupported product subcategory'), { statusCode: 400 });
  }
  if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error('Valid product price is required'), { statusCode: 400 });
  if (discountedPrice !== undefined && (!Number.isFinite(discountedPrice) || discountedPrice < 0)) {
    throw Object.assign(new Error('Discounted price must be a positive number'), { statusCode: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0) throw Object.assign(new Error('Stock must be a positive number'), { statusCode: 400 });
  if (!files.length && !existingProduct?.images?.length) {
    throw Object.assign(new Error('At least one product image is required'), { statusCode: 400 });
  }

  const rawAttributes = cleanObject(parseMaybeJson(body.attributes, {}));
  const attributes = rawAttributes;

  const specifications = cleanObject(parseMaybeJson(body.specifications, {}));
  const inventory = {
    ...cleanObject(parseMaybeJson(body.inventory, {})),
    stock,
    sku: String(body.sku || parseMaybeJson(body.inventory, {})?.sku || '').trim(),
  };

  const variants = Array.isArray(parseMaybeJson(body.variants, []))
    ? parseMaybeJson(body.variants, []).map(cleanObject).filter(item => Object.keys(item).length)
    : [];

  return {
    title,
    name: title,
    description,
    brand: String(body.brand || attributes.brand || '').trim(),
    category,
    subCategory: subcategory,
    subcategory,
    type: String(body.type || subcategory).trim(),
    price,
    discountedPrice,
    stock,
    sizes: category === 'Fashion' ? normalizeArray(attributes.size || body.sizes) : [],
    material: category === 'Fashion' ? String(attributes.material || body.material || '').trim() : '',
    color: category === 'Fashion' ? String(attributes.color || body.color || '').trim() : '',
    tags: normalizeArray(body.tags),
    attributes,
    specifications,
    inventory,
    variants,
    isPublished: String(body.isPublished ?? 'true') !== 'false',
  };
};

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
    const productPayload = validateProductPayload(req.body, req.files);
    const uploadedImages = await uploadProductImages(req.files || []);
    const baseSlug = slugify(req.body.slug || productPayload.title);
    const product = await Product.create({
      ...productPayload,
      slug: `${baseSlug || 'product'}-${Date.now()}`,
      seller: req.body.seller || req.userId,
      images: uploadedImages.map(image => image.url),
      imageMetadata: uploadedImages,
    });

    const eventPayload = {
      productId: String(product._id),
      title: product.title,
      category: product.category,
    };
    emitToAdmins(req.app, socketEvents.DOMAIN.PRODUCT_CREATED, eventPayload);
    emitToAll(req.app, socketEvents.DOMAIN.PRODUCT_CREATED, eventPayload);

    await auditAction(req, 'create_product', 'product', product._id, null, product.toObject(), {
      productSlug: product.slug,
      category: product.category,
      metadata: { stock: product.stock },
    });

    logger.info('Admin created product', { productId: product._id });
    return sendSuccess(res, 201, 'Product created successfully', { product });
  } catch (e) {
    await auditError(req, 'create_product', 'product', null, e, {
      payload: req.body,
    });
    next(e);
  }
};

const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    const beforeProduct = product.toObject();
    const productPayload = validateProductPayload(req.body, req.files || [], product);
    const uploadedImages = await uploadProductImages(req.files || []);
    Object.assign(product, productPayload);
    if (uploadedImages.length) {
      product.images = uploadedImages.map(image => image.url);
      product.imageMetadata = uploadedImages;
    }
    await product.save();

    emitProductUpdated(req, product);

    await auditAction(req, 'update_product', 'product', product._id, beforeProduct, product.toObject(), {
      metadata: { updates: Object.keys(productPayload) },
    });

    return sendSuccess(res, 200, 'Product updated successfully', { product });
  } catch (e) {
    await auditError(req, 'update_product', 'product', req.params.id, e, {
      payload: req.body,
    });
    next(e);
  }
};

const adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    const beforeProduct = product.toObject();
    await product.deleteOne();

    await auditAction(req, 'delete_product', 'product', req.params.id, beforeProduct, null, {
      metadata: { reason: 'deleted by admin' },
    });

    return sendSuccess(res, 200, 'Product deleted successfully');
  } catch (e) {
    await auditError(req, 'delete_product', 'product', req.params.id, e, {
      payload: req.params,
    });
    next(e);
  }
};

const adminUpdateInventory = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    const stock = Number(req.body.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      return sendValidationError(res, [{ field: 'stock', message: 'Stock must be a positive number', code: 'NOT_POSITIVE' }], 'Stock update failed');
    }

    const beforeProduct = product.toObject();
    product.stock = stock;
    product.inventory = {
      ...(product.inventory?.toObject ? product.inventory.toObject() : product.inventory || {}),
      stock,
      sku: req.body.sku || product.inventory?.sku || '',
    };
    await product.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.PRODUCT_UPDATED, {
      productId: String(product._id),
      title: product.title,
      category: product.category,
      stock: product.stock,
    });

    await auditAction(req, 'update_inventory', 'product', product._id, beforeProduct, product.toObject(), {
      metadata: { stock: product.stock },
    });

    return sendSuccess(res, 200, 'Inventory updated successfully', { product });
  } catch (e) {
    await auditError(req, 'update_inventory', 'product', req.params.id, e, {
      payload: req.body,
    });
    next(e);
  }
};

const normalizeVariantPayload = body => {
  const attributes = cleanObject(parseMaybeJson(body.attributes, {}));
  const images = normalizeArray(body.images);
  const price = body.price === undefined || body.price === '' ? undefined : Number(body.price);
  const stock = body.stock === undefined || body.stock === '' ? 0 : Number(body.stock);

  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    throw Object.assign(new Error('Variant price must be a positive number'), { statusCode: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0) {
    throw Object.assign(new Error('Variant stock must be a positive number'), { statusCode: 400 });
  }

  return cleanObject({
    name: String(body.name || '').trim(),
    value: String(body.value || '').trim(),
    attributes,
    price,
    stock,
    sku: String(body.sku || '').trim(),
    images,
  });
};

const emitProductUpdated = (req, product) => {
  const payload = {
    productId: String(product._id),
    title: product.title,
    category: product.category,
    stock: product.stock,
    variants: product.variants,
  };
  emitToAdmins(req.app, socketEvents.DOMAIN.PRODUCT_UPDATED, payload);
  emitToAll(req.app, socketEvents.DOMAIN.PRODUCT_UPDATED, payload);
};

const adminCreateVariant = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');

    const variantPayload = normalizeVariantPayload(req.body);
    const uploadedImages = await uploadProductImages(req.files || []);
    if (uploadedImages.length) variantPayload.images = uploadedImages.map(image => image.url);
    product.variants.push(variantPayload);
    await product.save();
    emitProductUpdated(req, product);

    const addedVariant = product.variants.at(-1);
    await auditAction(req, 'create_variant', 'product_variant', addedVariant?._id, null, addedVariant?.toObject(), {
      productId: product._id,
    });

    return sendSuccess(res, 201, 'Variant created successfully', { product, variant: addedVariant });
  } catch (e) {
    await auditError(req, 'create_variant', 'product_variant', null, e, {
      payload: req.body,
    });
    next(e);
  }
};

const adminUpdateVariant = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) return sendError(res, 404, 'Variant not found');

    const beforeVariant = variant.toObject();
    const variantPayload = normalizeVariantPayload({ ...variant.toObject(), ...req.body });
    const uploadedImages = await uploadProductImages(req.files || []);
    if (uploadedImages.length) variantPayload.images = uploadedImages.map(image => image.url);
    Object.assign(variant, variantPayload);
    await product.save();
    emitProductUpdated(req, product);

    await auditAction(req, 'update_variant', 'product_variant', variant._id, beforeVariant, variant.toObject(), {
      productId: product._id,
    });

    return sendSuccess(res, 200, 'Variant updated successfully', { product, variant });
  } catch (e) {
    await auditError(req, 'update_variant', 'product_variant', req.params.variantId, e, {
      payload: req.body,
    });
    next(e);
  }
};

const adminDeleteVariant = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) return sendError(res, 404, 'Variant not found');

    const beforeVariant = variant.toObject();
    variant.deleteOne();
    await product.save();
    emitProductUpdated(req, product);

    await auditAction(req, 'delete_variant', 'product_variant', req.params.variantId, beforeVariant, null, {
      productId: product._id,
    });

    return sendSuccess(res, 200, 'Variant deleted successfully', { product });
  } catch (e) {
    await auditError(req, 'delete_variant', 'product_variant', req.params.variantId, e, {
      payload: req.params,
    });
    next(e);
  }
};

module.exports = {
  getAdminProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUpdateInventory,
  adminCreateVariant,
  adminUpdateVariant,
  adminDeleteVariant,
};

