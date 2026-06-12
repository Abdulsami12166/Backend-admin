const Inventory = require('../../models/Inventory');
const Product = require('../../models/Product');
const AuditLog = require('../../models/AuditLog');

/**
 * Get all inventory items with pagination
 */
exports.getAllInventory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, lowStock, sortBy = '-currentStock' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      const products = await Product.find({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.product = { $in: products.map(p => p._id) };
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
    }

    const total = await Inventory.countDocuments(query);
    const inventory = await Inventory.find(query)
      .populate('product', 'title sku category price')
      .populate('lastRestockedBy', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: inventory,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get inventory for a product
 */
exports.getProductInventory = async (req, res) => {
  try {
    const { productId } = req.params;

    const inventory = await Inventory.findOne({ product: productId })
      .populate('product');

    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Inventory not found' });
    }

    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update stock quantity
 */
exports.updateStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, type = 'in', reason } = req.body; // type: 'in', 'out', 'adjustment'

    let inventory = await Inventory.findOne({ product: productId });

    if (!inventory) {
      inventory = new Inventory({ product: productId, currentStock: 0 });
    }

    const previousStock = inventory.currentStock;

    // Update stock based on type
    if (type === 'in') {
      inventory.currentStock += quantity;
      inventory.lastRestockedAt = new Date();
      inventory.lastRestockedQuantity = quantity;
    } else if (type === 'out') {
      inventory.currentStock = Math.max(0, inventory.currentStock - quantity);
    } else if (type === 'adjustment') {
      inventory.currentStock = quantity;
    }

    // Record movement
    inventory.stockMovements.push({
      type,
      quantity,
      reason: reason || `${type} movement`,
      createdBy: req.adminUser._id
    });

    await inventory.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'update_stock',
      entityType: 'inventory',
      entityId: inventory._id,
      changes: {
        before: { stock: previousStock },
        after: { stock: inventory.currentStock }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      resourcePath: `/api/admin/inventory/${productId}/stock`
    });

    res.json({ 
      success: true, 
      data: inventory,
      message: `Stock ${type === 'in' ? 'added' : type === 'out' ? 'removed' : 'adjusted'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update reorder settings
 */
exports.updateReorderSettings = async (req, res) => {
  try {
    const { productId } = req.params;
    const { reorderLevel, reorderQuantity } = req.body;

    let inventory = await Inventory.findOne({ product: productId });

    if (!inventory) {
      inventory = new Inventory({ product: productId });
    }

    inventory.reorderLevel = reorderLevel;
    inventory.reorderQuantity = reorderQuantity;
    await inventory.save();

    res.json({ success: true, data: inventory, message: 'Reorder settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get low stock products
 */
exports.getLowStockProducts = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const lowStockItems = await Inventory.find({
      $expr: { $lte: ['$currentStock', '$reorderLevel'] }
    })
      .populate('product', 'title sku category price')
      .limit(parseInt(limit))
      .sort('-reorderLevel');

    res.json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get stock movement history
 */
exports.getStockMovements = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const inventory = await Inventory.findOne({ product: productId });
    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Inventory not found' });
    }

    let movements = [...inventory.stockMovements];

    if (type) {
      movements = movements.filter(m => m.type === type);
    }

    if (startDate) {
      movements = movements.filter(m => m.createdAt >= new Date(startDate));
    }

    if (endDate) {
      movements = movements.filter(m => m.createdAt <= new Date(endDate));
    }

    const total = movements.length;
    movements = movements
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: movements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get inventory statistics
 */
exports.getInventoryStats = async (req, res) => {
  try {
    const totalProducts = await Inventory.countDocuments();
    const lowStockCount = await Inventory.countDocuments({
      $expr: { $lte: ['$currentStock', '$reorderLevel'] }
    });
    const outOfStockCount = await Inventory.countDocuments({ currentStock: 0 });

    const totalStock = await Inventory.aggregate([
      { $group: { _id: null, total: { $sum: '$currentStock' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalStock: totalStock[0]?.total || 0,
        healthPercentage: totalProducts > 0 
          ? (((totalProducts - lowStockCount - outOfStockCount) / totalProducts) * 100).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
