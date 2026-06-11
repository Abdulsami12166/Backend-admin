const asyncHandler = require('../../middleware/asyncHandler');

// Mock data for order timelines
const orderTimelines = new Map();

exports.getOrderTimeline = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  const timeline = orderTimelines.get(orderId) || {
    orderId,
    events: [
      {
        id: 'evt_1',
        timestamp: new Date(Date.now() - 86400000),
        event: 'order_created',
        description: 'Order created',
        actor: 'customer',
        metadata: {},
      },
      {
        id: 'evt_2',
        timestamp: new Date(Date.now() - 43200000),
        event: 'payment_processed',
        description: 'Payment processed successfully',
        actor: 'system',
        metadata: { paymentMethod: 'card', amount: 0 },
      },
      {
        id: 'evt_3',
        timestamp: new Date(Date.now() - 21600000),
        event: 'order_confirmed',
        description: 'Order confirmed',
        actor: 'admin',
        metadata: { confirmedBy: 'admin_user' },
      },
      {
        id: 'evt_4',
        timestamp: new Date(Date.now() - 3600000),
        event: 'order_shipped',
        description: 'Order shipped',
        actor: 'admin',
        metadata: { trackingId: 'TRACK123', carrier: 'DHL' },
      },
    ],
  };
  
  res.status(200).json({
    success: true,
    data: timeline,
  });
});

exports.addTimelineEvent = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { event, description, actor, metadata } = req.body;
  
  let timeline = orderTimelines.get(orderId);
  if (!timeline) {
    timeline = { orderId, events: [] };
  }
  
  const newEvent = {
    id: `evt_${Date.now()}`,
    timestamp: new Date(),
    event,
    description,
    actor,
    metadata: metadata || {},
  };
  
  timeline.events.push(newEvent);
  orderTimelines.set(orderId, timeline);
  
  res.status(201).json({
    success: true,
    message: 'Timeline event added successfully',
    data: newEvent,
  });
});

exports.updateTimelineEvent = asyncHandler(async (req, res) => {
  const { orderId, eventId } = req.params;
  const { description, metadata } = req.body;
  
  const timeline = orderTimelines.get(orderId);
  if (!timeline) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }
  
  const event = timeline.events.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }
  
  if (description) event.description = description;
  if (metadata) event.metadata = { ...event.metadata, ...metadata };
  
  orderTimelines.set(orderId, timeline);
  
  res.status(200).json({
    success: true,
    message: 'Timeline event updated successfully',
    data: event,
  });
});

exports.getTimelineStats = asyncHandler(async (req, res) => {
  const allTimelines = Array.from(orderTimelines.values());
  
  const stats = {
    totalOrders: allTimelines.length,
    totalEvents: allTimelines.reduce((sum, tl) => sum + tl.events.length, 0),
    eventsByType: {},
  };
  
  allTimelines.forEach(timeline => {
    timeline.events.forEach(event => {
      stats.eventsByType[event.event] = (stats.eventsByType[event.event] || 0) + 1;
    });
  });
  
  res.status(200).json({
    success: true,
    data: stats,
  });
});

exports.getOrderLifecycleHistory = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  const timeline = orderTimelines.get(orderId);
  if (!timeline) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }
  
  // Group events by lifecycle stage
  const lifecycleStages = {
    creation: [],
    payment: [],
    processing: [],
    shipping: [],
    delivery: [],
    completion: [],
  };
  
  timeline.events.forEach(event => {
    if (event.event.includes('created')) lifecycleStages.creation.push(event);
    else if (event.event.includes('payment')) lifecycleStages.payment.push(event);
    else if (event.event.includes('confirmed') || event.event.includes('processing')) lifecycleStages.processing.push(event);
    else if (event.event.includes('shipped') || event.event.includes('shipping')) lifecycleStages.shipping.push(event);
    else if (event.event.includes('delivered')) lifecycleStages.delivery.push(event);
    else lifecycleStages.completion.push(event);
  });
  
  res.status(200).json({
    success: true,
    data: {
      orderId,
      lifecycleStages: Object.fromEntries(
        Object.entries(lifecycleStages).filter(([, events]) => events.length > 0)
      ),
    },
  });
});
