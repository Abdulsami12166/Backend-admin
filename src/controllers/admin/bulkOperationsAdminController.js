const Product = require('../../models/Product');
const Inventory = require('../../models/Inventory');
const asyncHandler = require('../../middleware/asyncHandler');

/**
 * Build a synchronous job-result response (no persistent job store needed for synchronous ops).
 */
function jobResult(type, opts = {}) {
  return {
    id: `bulk_${Date.now()}`,
    type,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...opts,
  };
}

// GET /admin/bulk-operations  — list historical jobs (no persistent store; return empty)
exports.getBulkOperations = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
    data: [],
    message: 'Bulk operations are executed synchronously. Check product/inventory data for results.',
  });
});

// GET /admin/bulk-operations/:jobId
exports.getBulkOperationDetails = asyncHandler(async (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Bulk operation job not found. Operations are executed synchronously.',
  });
});

// POST /admin/bulk-operations/visibility
exports.bulkToggleProductVisibility = asyncHandler(async (req, res) => {
  const { productIds, visible, scheduleDate } = req.body;

  if (!productIds || productIds.length === 0) {
    return res.status(400).json({ success: false, message: 'productIds are required' });
  }

  if (scheduleDate) {
    // Scheduled operations would need a job queue — acknowledge and advise
    return res.status(202).json({
      success: true,
      message: 'Scheduled bulk operations require a job-queue service. Execute immediately instead.',
      data: jobResult('bulk_visibility_toggle', {
        status: 'scheduled',
        productIds,
        action: visible ? 'show' : 'hide',
        scheduleDate,
        totalProducts: productIds.length,
        processedProducts: 0,
      }),
    });
  }

  const result = await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: { isPublished: Boolean(visible) } },
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) visibility updated`,
    data: jobResult('bulk_visibility_toggle', {
      productIds,
      action: visible ? 'show' : 'hide',
      totalProducts: productIds.length,
      processedProducts: result.modifiedCount,
      errorCount: productIds.length - result.modifiedCount,
    }),
  });
});

// POST /admin/bulk-operations/inventory
exports.bulkUpdateInventory = asyncHandler(async (req, res) => {
  const { updates } = req.body; // [{ productId, quantity, action: 'set'|'increment'|'decrement' }]

  if (!updates || updates.length === 0) {
    return res.status(400).json({ success: false, message: 'updates array is required' });
  }

  const bulkOps = updates.map(({ productId, quantity, action }) => {
    const qty = Number(quantity) || 0;
    let update;
    if (action === 'increment') {
      update = {
        $inc: { currentStock: qty },
        $set: { updatedAt: new Date() },
      };
    } else if (action === 'decrement') {
      update = {
        $inc: { currentStock: -Math.abs(qty) },
        $set: { updatedAt: new Date() },
      };
    } else {
      // default: set
      update = {
        $set: { currentStock: qty, availableStock: qty, updatedAt: new Date() },
      };
    }
    return {
      updateOne: {
        filter: { product: productId },
        update,
        upsert: false,
      },
    };
  });

  const result = await Inventory.bulkWrite(bulkOps);

  // Also sync Product.stock for backward compat
  const stockBulk = updates.map(({ productId, quantity, action }) => {
    const qty = Number(quantity) || 0;
    let stockUpdate;
    if (action === 'increment') {
      stockUpdate = { $inc: { stock: qty } };
    } else if (action === 'decrement') {
      stockUpdate = { $inc: { stock: -Math.abs(qty) } };
    } else {
      stockUpdate = { $set: { stock: qty } };
    }
    return {
      updateOne: {
        filter: { _id: productId },
        update: stockUpdate,
      },
    };
  });

  await Product.bulkWrite(stockBulk).catch(() => null); // best-effort

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} inventory record(s) updated`,
    data: jobResult('bulk_inventory_update', {
      totalUpdates: updates.length,
      processedUpdates: result.modifiedCount,
      errorCount: updates.length - result.modifiedCount,
    }),
  });
});

// POST /admin/bulk-operations/category
exports.bulkAssignCategory = asyncHandler(async (req, res) => {
  const { productIds, categoryId, subCategory } = req.body;

  if (!productIds || productIds.length === 0) {
    return res.status(400).json({ success: false, message: 'productIds are required' });
  }
  if (!categoryId) {
    return res.status(400).json({ success: false, message: 'categoryId is required' });
  }

  const setFields = { category: categoryId };
  if (subCategory) setFields.subCategory = subCategory;

  const result = await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: setFields },
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) category updated`,
    data: jobResult('bulk_category_assignment', {
      productIds,
      categoryId,
      subCategory: subCategory || null,
      totalProducts: productIds.length,
      processedProducts: result.modifiedCount,
      errorCount: productIds.length - result.modifiedCount,
    }),
  });
});

// POST /admin/bulk-operations/pricing
exports.bulkUpdatePricing = asyncHandler(async (req, res) => {
  const { productIds, priceAdjustment, adjustmentType } = req.body;
  // adjustmentType: 'fixed' = set price directly, 'percentage' = multiply current price

  if (!productIds || productIds.length === 0) {
    return res.status(400).json({ success: false, message: 'productIds are required' });
  }
  if (priceAdjustment === undefined || priceAdjustment === null) {
    return res.status(400).json({ success: false, message: 'priceAdjustment is required' });
  }

  let result;
  if (adjustmentType === 'fixed') {
    // Set all prices to the fixed amount
    result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { price: Number(priceAdjustment) } },
    );
  } else if (adjustmentType === 'percentage') {
    // Apply percentage multiplier (e.g., 10 = +10%, -10 = -10%)
    const multiplier = 1 + Number(priceAdjustment) / 100;
    result = await Product.updateMany(
      { _id: { $in: productIds } },
      [{ $set: { price: { $max: [0, { $multiply: ['$price', multiplier] }] } } }],
    );
  } else {
    // Default: increment price by fixed amount
    result = await Product.updateMany(
      { _id: { $in: productIds } },
      [{ $set: { price: { $max: [0, { $add: ['$price', Number(priceAdjustment)] }] } } }],
    );
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) price updated`,
    data: jobResult('bulk_pricing_update', {
      productIds,
      priceAdjustment,
      adjustmentType: adjustmentType || 'increment',
      totalProducts: productIds.length,
      processedProducts: result.modifiedCount,
      errorCount: productIds.length - result.modifiedCount,
    }),
  });
});

// POST /admin/bulk-operations/:jobId/cancel
exports.cancelBulkOperation = asyncHandler(async (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Bulk operations are synchronous and cannot be cancelled after execution.',
  });
});

// GET /admin/bulk-operations/:jobId/logs
exports.getBulkOperationLogs = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
    data: [],
    message: 'Bulk operation logs are not persisted for synchronous operations.',
  });
});

// GET /admin/bulk-operations/stats/overview
exports.getBulkOperationStats = asyncHandler(async (req, res) => {
  const [totalProducts, publishedProducts, hiddenProducts, totalInventory] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ isPublished: true }),
    Product.countDocuments({ isPublished: false }),
    Inventory.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: 0,
      completed: 0,
      processing: 0,
      scheduled: 0,
      failed: 0,
      cancelled: 0,
      productStats: {
        total: totalProducts,
        published: publishedProducts,
        hidden: hiddenProducts,
        inventoryRecords: totalInventory,
      },
    },
  });
});
