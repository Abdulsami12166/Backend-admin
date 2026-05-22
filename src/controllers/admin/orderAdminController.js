const Order = require('../../../../backend/src/models/Order');

const { sendSuccess, sendError } = require('../../../../backend/src/utils/responseHandler');
const { logger } = require('../../utils/logger');

const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone role blocked')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Admin orders fetched successfully', { orders });
  } catch (e) {
    next(e);
  }
};

const adminUpdateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');

    if (req.body.orderStatus) order.orderStatus = req.body.orderStatus;
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

    await order.save();
    logger.info('Admin updated order status', { orderId: order._id });

    return sendSuccess(res, 200, 'Order status updated successfully', { order });
  } catch (e) {
    next(e);
  }
};

const adminDeleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');

    await order.deleteOne();
    return sendSuccess(res, 200, 'Order deleted successfully');
  } catch (e) {
    next(e);
  }
};

module.exports = { getAdminOrders, adminUpdateOrderStatus, adminDeleteOrder };

