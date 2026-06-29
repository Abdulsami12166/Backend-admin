const NotificationTemplate = require('../models/NotificationTemplate');
const NotificationEventMapping = require('../models/NotificationEventMapping');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const { sendPushNotification } = require('./pushNotificationService');

const defaultTemplates = [
  {
    name: 'order_placed_customer',
    displayName: 'Order Placed Confirmation (Customer)',
    description: 'Sent to customer when they place a new order',
    category: 'order',
    trigger: 'order.created',
    channels: { email: true, push: true, inApp: true },
    emailTemplate: {
      subject: 'Order Confirmed - {{orderNumber}}',
      body: 'Hi {{customerName}},\n\nYour order {{orderNumber}} has been placed successfully for a total of {{amount}}.\n\nThank you for shopping with us!'
    },
    pushTemplate: {
      title: '✅ Order Placed!',
      body: 'Your order {{orderNumber}} was successfully placed.'
    },
    inAppTemplate: {
      title: 'Order Confirmed',
      message: 'Your order {{orderNumber}} has been placed successfully.'
    },
    isSystem: true
  },
  {
    name: 'order_updated_customer',
    displayName: 'Order Status Update (Customer)',
    description: 'Sent to customer when their order status changes',
    category: 'order',
    trigger: 'order.updated',
    channels: { email: true, push: true, inApp: true },
    emailTemplate: {
      subject: 'Order Status Update - {{orderNumber}}',
      body: 'Hi {{customerName}},\n\nYour order {{orderNumber}} status has been updated to {{status}}.'
    },
    pushTemplate: {
      title: '📦 Order Status Update',
      body: 'Your order {{orderNumber}} status is now: {{status}}.'
    },
    inAppTemplate: {
      title: 'Order Update',
      message: 'Your order {{orderNumber}} status is now {{status}}.'
    },
    isSystem: true
  },
  {
    name: 'ticket_updated_customer',
    displayName: 'Support Ticket Status Update (Customer)',
    description: 'Sent to customer when their support ticket status changes',
    category: 'support',
    trigger: 'support.ticket.updated',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '🎫 Support Ticket Update',
      body: 'Your support ticket has been updated to: {{status}}.'
    },
    inAppTemplate: {
      title: 'Ticket Update',
      message: 'Your support ticket status has been updated to {{status}}.'
    },
    isSystem: true
  },
  {
    name: 'ticket_message_customer',
    displayName: 'New Support Reply (Customer)',
    description: 'Sent to customer when support team replies to a ticket',
    category: 'support',
    trigger: 'support.ticket.message_added',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '💬 New Support Message',
      body: 'You have a new reply from the support team on your ticket.'
    },
    inAppTemplate: {
      title: 'New Reply',
      message: 'Support team replied to your ticket.'
    },
    isSystem: true
  },
  {
    name: 'refund_updated_customer',
    displayName: 'Refund Status Update (Customer)',
    description: 'Sent to customer when their refund request is updated',
    category: 'return',
    trigger: 'support.refund.updated',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '💰 Refund Status Update',
      body: 'Your refund request status is now: {{status}}.'
    },
    inAppTemplate: {
      title: 'Refund Status Update',
      message: 'Your refund request is now {{status}}.'
    },
    isSystem: true
  },
  {
    name: 'return_updated_customer',
    displayName: 'Return Status Update (Customer)',
    description: 'Sent to customer when their return request is updated',
    category: 'return',
    trigger: 'support.return.updated',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '↩️ Return Status Update',
      body: 'Your return request status is now: {{status}}.'
    },
    inAppTemplate: {
      title: 'Return Status Update',
      message: 'Your return request status is now {{status}}.'
    },
    isSystem: true
  },
  {
    name: 'replacement_updated_customer',
    displayName: 'Replacement Status Update (Customer)',
    description: 'Sent to customer when their replacement request is updated',
    category: 'return',
    trigger: 'support.replacement.updated',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '🔄 Replacement Status Update',
      body: 'Your replacement request status is now: {{status}}.'
    },
    inAppTemplate: {
      title: 'Replacement Status Update',
      message: 'Your replacement request status is now {{status}}.'
    },
    isSystem: true
  },
  {
    name: 'low_stock_admin',
    displayName: 'Low Stock Alert (Admin)',
    description: 'Sent to admins/inventory managers when product stock is low',
    category: 'system',
    trigger: 'inventory.low_stock',
    channels: { email: true, push: true, inApp: true },
    pushTemplate: {
      title: '⚠️ Low Stock Alert',
      body: 'Product {{productName}} has low stock. Only {{status}} remaining.'
    },
    inAppTemplate: {
      title: 'Low Stock Alert',
      message: 'Product {{productName}} has low stock ({{status}} left).'
    },
    isSystem: true
  }
];

let isSeeded = false;

const seedDefaultTemplates = async () => {
  if (isSeeded) return;
  try {
    const count = await NotificationTemplate.countDocuments();
    if (count > 0) {
      isSeeded = true;
      return;
    }

    console.log('[NotificationTrigger] Seeding default templates and event mappings...');
    
    const admin = await User.findOne({ role: { $in: ['admin', 'super-admin'] } });
    const adminId = admin ? admin._id : null;

    const createdTemplates = [];
    for (const t of defaultTemplates) {
      const template = new NotificationTemplate({
        ...t,
        createdBy: adminId,
        updatedBy: adminId
      });
      await template.save();
      createdTemplates.push(template);
    }

    const events = [
      { event: 'order.created', templates: ['order_placed_customer'] },
      { event: 'order.updated', templates: ['order_updated_customer'] },
      { event: 'support.ticket.updated', templates: ['ticket_updated_customer'] },
      { event: 'support.ticket.message_added', templates: ['ticket_message_customer'] },
      { event: 'support.refund.updated', templates: ['refund_updated_customer'] },
      { event: 'support.return.updated', templates: ['return_updated_customer'] },
      { event: 'support.replacement.updated', templates: ['replacement_updated_customer'] },
      { event: 'inventory.low_stock', templates: ['low_stock_admin'] }
    ];

    for (const ev of events) {
      const templateIds = createdTemplates
        .filter(t => ev.templates.includes(t.name))
        .map(t => t._id);

      const mapping = new NotificationEventMapping({
        event: ev.event,
        name: `${ev.event} Default Mapping`,
        templates: templateIds,
        active: true,
        createdBy: adminId,
        updatedBy: adminId
      });
      await mapping.save();
    }

    isSeeded = true;
    console.log('[NotificationTrigger] Seeding completed successfully.');
  } catch (err) {
    console.error('[NotificationTrigger] Error seeding default templates:', err.message);
  }
};

const triggerEventNotifications = async (event, data = {}) => {
  try {
    // Ensure defaults are seeded
    await seedDefaultTemplates();

    // 1. Find event mapping populated with templates
    const mapping = await NotificationEventMapping.findOne({ event, active: true })
      .populate('templates');

    if (!mapping || !mapping.templates || mapping.templates.length === 0) {
      return;
    }

    // 2. Identify target users
    let targets = [];

    // Admin events go to all admins/support team
    const isAdminEvent = [
      'inventory.low_stock',
      'order.created',
      'support.ticket.created',
      'support.return.created',
      'support.refund.created',
      'product.created'
    ].includes(event);

    if (isAdminEvent) {
      targets = await User.find({ role: { $in: ['admin', 'super-admin', 'support', 'product-manager', 'inventory-manager', 'finance-manager', 'customer-service'] } });
    } else {
      // Find specific user associated with the event data
      let userId = data.userId || data.user?._id || data.user || data.customerId;
      
      // If we don't have a userId, check for ticket user, order user, etc.
      if (!userId && data.ticketId) {
        const Ticket = require('../models/SupportTicket');
        const ticket = await Ticket.findById(data.ticketId);
        if (ticket) userId = ticket.user;
      }
      
      if (!userId && data.orderId) {
        const Order = require('../models/Order');
        const order = await Order.findById(data.orderId);
        if (order) userId = order.user;
      }

      if (!userId && data.refundId) {
        const Refund = require('../models/RefundRequest');
        const refund = await Refund.findById(data.refundId);
        if (refund) userId = refund.user;
      }

      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          targets.push(user);
        }
      }
    }

    if (targets.length === 0) return;

    // 3. Process templates
    for (const template of mapping.templates) {
      if (!template.isActive) continue;

      for (const user of targets) {
        // Compile template messages with dynamic variables
        const compile = (text) => {
          if (!text) return '';
          let compiled = text;
          const variables = {
            customerName: user.name || 'Customer',
            orderNumber: data.orderNumber || data.razorpayOrderId || (data.order && (data.order.razorpayOrderId || data.order.orderNumber)) || '',
            status: data.status || data.orderStatus || '',
            productName: data.productName || data.name || '',
            ticketId: data.ticketId || data._id || '',
            invoiceNumber: data.invoiceNumber || '',
            amount: data.totalAmount || data.amount || '',
            reason: data.reason || data.rejectionReason || ''
          };
          for (const [key, val] of Object.entries(variables)) {
            compiled = compiled.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
          }
          return compiled;
        };

        const channels = ['email', 'sms', 'push', 'inApp'];
        for (const channel of channels) {
          if (template.channels?.[channel]) {
            let title = '';
            let body = '';

            if (channel === 'email') {
              title = compile(template.emailTemplate?.subject || 'Notification');
              body = compile(template.emailTemplate?.body || '');
            } else if (channel === 'sms') {
              body = compile(template.smsTemplate?.body || '');
            } else if (channel === 'push') {
              title = compile(template.pushTemplate?.title || 'System Notification');
              body = compile(template.pushTemplate?.body || '');
            } else if (channel === 'inApp') {
              title = compile(template.inAppTemplate?.title || 'System Alert');
              body = compile(template.inAppTemplate?.message || '');
            }

            // Create notification log in database
            const log = new NotificationLog({
              template: template._id,
              user: user._id,
              channel,
              subject: title,
              content: body,
              recipient: {
                userId: user._id,
                email: user.email,
                phone: user.phone
              },
              status: 'sent',
              sentAt: new Date()
            });
            await log.save();

            // Perform actual channel dispatch
            if (channel === 'push') {
              if (user.fcmToken) {
                const pushData = { event, type: event };
                if (data.orderId) pushData.orderId = String(data.orderId);
                if (data.ticketId) pushData.ticketId = String(data.ticketId);
                if (data._id) pushData.id = String(data._id);
                if (data.refundId) pushData.refundId = String(data.refundId);
                if (data.returnId) pushData.returnId = String(data.returnId);
                if (data.replacementId) pushData.replacementId = String(data.replacementId);
                if (data.productId) pushData.productId = String(data.productId);
                
                if (event.includes('order')) {
                  pushData.screen = 'TrackOrder';
                } else if (event.includes('ticket')) {
                  pushData.screen = 'TicketDetail';
                } else if (event.includes('refund')) {
                  pushData.screen = 'RefundTracking';
                } else if (event.includes('return')) {
                  pushData.screen = 'ReturnTracking';
                } else if (event.includes('replacement')) {
                  pushData.screen = 'ReplacementTracking';
                }

                await sendPushNotification(user.fcmToken, title, body, pushData, user._id, data.orderId || data.order?._id);
              } else {
                // Fallback to inApp if push device token is missing
                try {
                  log.channel = 'inApp';
                  await log.save();

                  const { emitToUser } = require('../utils/eventBus');
                  emitToUser(null, user._id, 'notification.inapp', {
                    id: String(log._id),
                    title,
                    message: body,
                    createdAt: log.createdAt
                  });
                } catch (fallbackErr) {
                  console.error('[NotificationTrigger] Fallback to inApp failed:', fallbackErr.message);
                }
              }
            }

            // Emit to admin dashboards in real time so logs reload
            const { emitToAdmins, emitToUser, socketEvents } = require('../utils/eventBus');
            emitToAdmins(null, socketEvents.DOMAIN.NOTIFICATION_SENT, {
              id: String(log._id),
              channel,
              status: 'sent',
              recipient: { userId: user._id },
              createdAt: log.createdAt,
            });

            // Emit in-app notification to the specific user's socket room in real-time
            if (channel === 'inApp') {
              emitToUser(null, user._id, 'notification.inapp', {
                id: String(log._id),
                title,
                message: body,
                createdAt: log.createdAt
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in triggerEventNotifications:', err);
  }
};

module.exports = { triggerEventNotifications };
