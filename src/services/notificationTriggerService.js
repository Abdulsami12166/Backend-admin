const NotificationTemplate = require('../models/NotificationTemplate');
const NotificationEventMapping = require('../models/NotificationEventMapping');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const { sendPushNotification } = require('./pushNotificationService');

const triggerEventNotifications = async (event, data = {}) => {
  try {
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
      targets = await User.find({ role: { $in: ['admin', 'super-admin', 'support', 'product-manager', 'inventory-manager'] } });
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
            if (channel === 'push' && user.fcmToken) {
              await sendPushNotification(user.fcmToken, title, body, { event }, user._id);
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
