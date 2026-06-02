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
    ADMIN_FORCE_LOGOUT: 'admin.user.force_logout',
  },
  LEGACY: {
    NEW_ORDER: 'new-order',
    ORDER_STATUS_CHANGED: 'order-status-changed',
    USER_FORCE_LOGOUT: 'user-force-logout',
  },
};

module.exports = { socketEvents };
