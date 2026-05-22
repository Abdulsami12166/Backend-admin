const path = require('path');

// Render-safe absolute imports (avoids fragile deep relative paths)
const backendRoot = process.cwd();

const User = require(path.join(backendRoot, 'models', 'User'));
const Order = require(path.join(backendRoot, 'models', 'Order'));
const Product = require(path.join(backendRoot, 'models', 'Product'));

const { logger } = require(path.join(backendRoot, 'utils', 'logger'));

const { sendSuccess, sendError } = require(path.join(backendRoot, 'utils', 'responseHandler'));


const getAdminDashboardMetrics = async (req, res, next) => {
  try {
    const [totalUsers, totalOrders, productCount] = await Promise.all([
      User.countDocuments({}),
      Order.countDocuments({}),
      Product.countDocuments({}),
    ]);

    const revenueAgg = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered',
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    const revenue = revenueAgg?.[0]?.totalRevenue || 0;

    logger.info('Admin dashboard metrics fetched');

    return sendSuccess(res, 200, 'Dashboard metrics fetched successfully', {
      totalUsers,
      totalOrders,
      productCount,
      revenue,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboardMetrics };

