const socketEvents = {
  ADMIN_SUBSCRIBE: 'subscribe-admin',
  ROOMS: {
    ADMINS: 'admin-room',
    user: userId => `user:${userId}`,
  },
  DOMAIN: {
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    ADMIN_ACTIVITY_CREATED: 'admin.activity.created',
    ADMIN_FORCE_LOGOUT: 'admin.user.force_logout',
    REFUND_CREATED: 'refund.created',
    REFUND_UPDATED: 'refund.updated',
    REFUND_LEDGER_UPDATED: 'refund.ledger.updated',
    TICKET_CREATED: 'ticket.created',
    TICKET_UPDATED: 'ticket.updated',
    TICKET_MESSAGE_ADDED: 'ticket.message.added',
    SHIPMENT_CREATED: 'shipment.created',
    SHIPMENT_UPDATED: 'shipment.updated',
  },
  LEGACY: {
    NEW_ORDER: 'new-order',
    ORDER_STATUS_CHANGED: 'order-status-changed',
    USER_FORCE_LOGOUT: 'user-force-logout',
  },
};

module.exports = { socketEvents };
