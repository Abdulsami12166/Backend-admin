const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { logger } = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/responseHandler');


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

