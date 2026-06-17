const Order = require('../../models/Order');
const asyncHandler = require('../../middleware/asyncHandler');

/**
 * Map an Order statusHistory entry to a timeline event shape expected by the admin web frontend.
 */
function toEvent(item, index) {
  return {
    id: `evt_${index}`,
    timestamp: item.timestamp || new Date(),
    event: item.status,
    description: item.label || item.status,
    actor: item.actor || 'system',
    metadata: item.metadata || {},
  };
}

// GET /admin/orders/:orderId/timeline
exports.getOrderTimeline = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .select('statusHistory orderStatus createdAt')
    .lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const events = (order.statusHistory || []).map(toEvent);

  res.status(200).json({
    success: true,
    data: {
      orderId,
      orderStatus: order.orderStatus,
      events,
    },
  });
});

// POST /admin/orders/:orderId/timeline/event
exports.addTimelineEvent = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { event, description, actor, metadata } = req.body;

  if (!event || !description) {
    return res.status(400).json({ success: false, message: 'event and description are required' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const newEntry = {
    status: event,
    label: description,
    timestamp: new Date(),
  };

  order.statusHistory.push(newEntry);
  await order.save();

  const savedIndex = order.statusHistory.length - 1;
  const savedEntry = order.statusHistory[savedIndex];

  res.status(201).json({
    success: true,
    message: 'Timeline event added successfully',
    data: {
      id: `evt_${savedIndex}`,
      timestamp: savedEntry.timestamp,
      event: savedEntry.status,
      description: savedEntry.label,
      actor: actor || 'admin',
      metadata: metadata || {},
    },
  });
});

// PATCH /admin/orders/:orderId/timeline/:eventId
exports.updateTimelineEvent = asyncHandler(async (req, res) => {
  const { orderId, eventId } = req.params;
  const { description, metadata } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const index = parseInt(String(eventId).replace('evt_', ''), 10);
  if (isNaN(index) || index < 0 || index >= order.statusHistory.length) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  if (description) order.statusHistory[index].label = description;
  order.markModified('statusHistory');
  await order.save();

  const updated = order.statusHistory[index];

  res.status(200).json({
    success: true,
    message: 'Timeline event updated successfully',
    data: {
      id: eventId,
      timestamp: updated.timestamp,
      event: updated.status,
      description: updated.label,
      actor: 'admin',
      metadata: metadata || {},
    },
  });
});

// GET /admin/timeline/stats
exports.getTimelineStats = asyncHandler(async (req, res) => {
  const [totalOrders, withHistory, eventAgg] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ 'statusHistory.0': { $exists: true } }),
    Order.aggregate([
      { $unwind: { path: '$statusHistory', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$statusHistory.status', count: { $sum: 1 } } },
    ]),
  ]);

  const eventsByType = eventAgg.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const totalEvents = eventAgg.reduce((sum, item) => sum + item.count, 0);

  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      ordersWithTimeline: withHistory,
      totalEvents,
      eventsByType,
    },
  });
});

// GET /admin/orders/:orderId/timeline/lifecycle
exports.getOrderLifecycleHistory = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .select('statusHistory orderStatus')
    .lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const lifecycleStages = {
    creation: [],
    payment: [],
    processing: [],
    shipping: [],
    delivery: [],
    completion: [],
  };

  (order.statusHistory || []).forEach((item, index) => {
    const ev = toEvent(item, index);
    const s = item.status;
    if (s === 'pending' || s.includes('creat')) lifecycleStages.creation.push(ev);
    else if (s === 'paid' || s.includes('payment')) lifecycleStages.payment.push(ev);
    else if (['processing', 'order-confirmed', 'packed'].includes(s)) lifecycleStages.processing.push(ev);
    else if (['shipping', 'shipped', 'near-delivery'].includes(s)) lifecycleStages.shipping.push(ev);
    else if (['out-for-delivery', 'delivered'].includes(s)) lifecycleStages.delivery.push(ev);
    else lifecycleStages.completion.push(ev);
  });

  res.status(200).json({
    success: true,
    data: {
      orderId,
      orderStatus: order.orderStatus,
      lifecycleStages: Object.fromEntries(
        Object.entries(lifecycleStages).filter(([, events]) => events.length > 0),
      ),
    },
  });
});
