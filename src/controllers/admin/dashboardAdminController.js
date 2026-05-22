const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { logger } = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/responseHandler');

const getAdminDashboardMetrics = async (req, res, next) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalOrders,
      productCount,
      blockedUsers,
      newUsersToday,
      ordersLast24h,
      orderStatusCounts,
      revenueAgg,
      recentOrders,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments({}),
      Order.countDocuments({}),
      Product.countDocuments({}),
      User.countDocuments({ blocked: true }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.countDocuments({ createdAt: { $gte: last24h } }),
      Order.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { orderStatus: 'delivered', paymentStatus: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name email')
        .select('totalAmount orderStatus paymentStatus createdAt user'),
      User.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select('name email role blocked isVerified createdAt'),
    ]);

    const ordersByStatus = orderStatusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const revenue = revenueAgg?.[0]?.totalRevenue || 0;

    logger.info('Admin dashboard metrics fetched');

    return sendSuccess(res, 200, 'Dashboard metrics fetched successfully', {
      totalUsers,
      totalOrders,
      productCount,
      revenue,
      blockedUsers,
      newUsersToday,
      ordersLast24h,
      ordersByStatus,
      recentOrders,
      recentUsers,
      fetchedAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboardMetrics };
