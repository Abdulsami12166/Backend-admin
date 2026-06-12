const Order = require('../../models/Order');
const UserActivity = require('../../models/UserActivity');
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendServerError,
} = require('../../utils/feedback');
const { logger } = require('../../utils/logger');
const { emitToAdmins, emitToUser, socketEvents } = require('../../utils/eventBus');
const { auditAction, auditError } = require('../../utils/workflow');

const ORDER_STATUS_LABELS = {
  'order-confirmed': 'Order Confirmed',
  packed: 'Packed',
  shipping: 'Shipped',
  shipped: 'Shipped',
  'near-delivery': 'Out For Delivery',
  'out-for-delivery': 'Out For Delivery',
  delivered: 'Delivered',
};

const ALLOWED_ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'order-confirmed',
  'packed',
  'shipping',
  'near-delivery',
  'out-for-delivery',
  'shipped',
  'delivered',
  'cancelled',
];

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

const getAdminTransactions = async (req, res, next) => {
  try {
    const transactions = await Order.find({
      $or: [
        { razorpayOrderId: { $ne: '' } },
        { razorpayPaymentId: { $ne: '' } },
        { paymentStatus: { $in: ['paid', 'failed', 'refunded'] } },
      ],
    })
      .populate('user', 'name email phone role blocked')
      .sort({ createdAt: -1 })
      .select('user totalAmount paymentStatus paymentMethod paymentReference razorpayOrderId razorpayPaymentId transactionStatus transactionVerifiedAt orderStatus createdAt');

    return sendSuccess(res, 200, 'Admin transactions fetched successfully', { transactions });
  } catch (e) {
    next(e);
  }
};

const adminUpdateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');

    const beforeOrder = order.toObject();

    if (req.body.orderStatus) {
      if (!ALLOWED_ORDER_STATUSES.includes(req.body.orderStatus)) {
        return sendError(res, 400, 'Unsupported order status');
      }

      order.orderStatus = req.body.orderStatus;
      order.statusHistory = [
        ...(Array.isArray(order.statusHistory) ? order.statusHistory : []).filter(
          item => item.status !== req.body.orderStatus,
        ),
        {
          status: req.body.orderStatus,
          label: ORDER_STATUS_LABELS[req.body.orderStatus] || req.body.orderStatus,
          timestamp: new Date(),
        },
      ];
    }
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

    await order.save();
    logger.info('Admin updated order status', { orderId: order._id });

    await UserActivity.create({
      user: order.user,
      action: 'order',
      details: `Order ${String(order._id).slice(-6).toUpperCase()} updated to ${order.orderStatus}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const afterOrder = order.toObject();
    await auditAction(req, 'update_order_status', 'order', order._id, beforeOrder, afterOrder, {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });

    const payload = {
      orderId: String(order._id),
      userId: String(order.user),
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      statusHistory: order.statusHistory || [],
      updatedAt: order.updatedAt,
    };

    emitToAdmins(req.app, socketEvents.LEGACY.ORDER_STATUS_CHANGED, payload);
    emitToAdmins(req.app, socketEvents.DOMAIN.ORDER_UPDATED, payload);
    emitToUser(req.app, order.user, socketEvents.DOMAIN.ORDER_UPDATED, payload);

    return sendSuccess(res, 200, 'Order status updated successfully', { order });
  } catch (e) {
    await auditError(req, 'update_order_status', 'order', req.params.id, e);
    next(e);
  }
};

const adminDeleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');

    const beforeOrder = order.toObject();
    await order.deleteOne();

    await UserActivity.create({
      user: order.user,
      action: 'order',
      details: 'Order deleted by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    await auditAction(req, 'delete_order', 'order', req.params.id, beforeOrder, null, {
      note: 'Deleted by admin',
    });

    return sendSuccess(res, 200, 'Order deleted successfully');
  } catch (e) {
    await auditError(req, 'delete_order', 'order', req.params.id, e);
    next(e);
  }
};

const adminCreateOrder = async (req, res, next) => {
  try {
    const order = await Order.create(req.body);
    
    await UserActivity.create({
      user: order.user,
      action: 'order',
      details: `Order ${String(order._id).slice(-6).toUpperCase()} created by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    await auditAction(req, 'create_order', 'order', order._id, null, order.toObject(), {
      note: 'Created by admin',
    });

    const payload = {
      orderId: String(order._id),
      ...order.toObject(),
    };

    emitToAdmins(req.app, socketEvents.LEGACY.NEW_ORDER, payload);
    emitToAdmins(req.app, socketEvents.DOMAIN.ORDER_CREATED, payload);

    return sendSuccess(res, 201, 'Order created successfully', { order });
  } catch (e) {
    await auditError(req, 'create_order', 'order', null, e);
    next(e);
  }
};

module.exports = { getAdminOrders, getAdminTransactions, adminUpdateOrderStatus, adminDeleteOrder, adminCreateOrder };

