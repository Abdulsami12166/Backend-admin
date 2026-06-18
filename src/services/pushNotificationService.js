/**
 * Push Notification Service (Firebase Admin SDK) — Backend-admin
 * Sends FCM push notifications to user devices when order/shipment status changes.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON env variable (base64-encoded service account JSON)
 * OR individual FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.
 */

let admin = null;

const initFirebase = () => {
  if (admin) return admin;
  try {
    admin = require('firebase-admin');

    if (admin.apps.length > 0) {
      return admin;
    }

    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'),
      );
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_PROJECT_ID) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
    } else {
      console.warn('[PushNotification] No Firebase credentials configured. Push notifications disabled.');
      return null;
    }

    admin.initializeApp({ credential });
    console.log('[PushNotification] Firebase Admin initialized successfully.');
    return admin;
  } catch (err) {
    console.error('[PushNotification] Failed to initialize Firebase Admin:', err.message);
    return null;
  }
};

/**
 * Send a push notification to a single FCM token.
 */
const sendPushNotification = async (fcmToken, title, body, data = {}, userId = null, orderId = null) => {
  if (!fcmToken) return;

  const firebaseAdmin = initFirebase();
  let status = 'sent';
  let failureReason = '';

  if (!firebaseAdmin) {
    status = 'failed';
    failureReason = 'Firebase Admin not initialized (missing credentials)';
  }

  try {
    if (firebaseAdmin) {
      const stringData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      );

      await firebaseAdmin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: stringData,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'orders' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });

      console.log('[PushNotification] Sent to token:', fcmToken.slice(0, 20) + '...');
    }
  } catch (err) {
    status = 'failed';
    failureReason = err.message;
    console.error('[PushNotification] Failed to send notification:', err.message);
  }

  // Log in database if userId is provided
  if (userId) {
    try {
      const NotificationLog = require('../models/NotificationLog');
      const log = new NotificationLog({
        user: userId,
        order: orderId,
        channel: 'push',
        subject: title,
        content: body,
        recipient: {
          userId,
        },
        status,
        failureReason,
        sentAt: status === 'sent' ? new Date() : undefined,
        metadata: { data }
      });
      await log.save();

      // Emit real-time socket notification update
      try {
        const { emitToAdmins, socketEvents } = require('../utils/eventBus');
        emitToAdmins(null, socketEvents.DOMAIN.NOTIFICATION_SENT, {
          id: String(log._id),
          channel: 'push',
          status,
          recipient: { userId },
          createdAt: log.createdAt,
        });
      } catch (socketErr) {
        console.error('[PushNotification] Socket emission failed:', socketErr.message);
      }
    } catch (dbErr) {
      console.error('[PushNotification] Database log saving failed:', dbErr.message);
    }
  }
};

/**
 * Send order status update notification to a user.
 */
const sendOrderStatusNotification = async (user, orderStatus, orderId) => {
  if (!user?.fcmToken) return;

  const STATUS_MESSAGES = {
    'order-confirmed': { title: '✅ Order Confirmed', body: 'Your order has been confirmed and is being prepared.' },
    packed: { title: '📦 Order Packed', body: 'Your order has been packed and is ready to ship.' },
    shipped: { title: '🚚 Order Shipped', body: 'Your order is on its way!' },
    'near-delivery': { title: '📍 Almost There', body: 'Your order is nearby and will be delivered soon.' },
    'out-for-delivery': { title: '🛵 Out for Delivery', body: 'Your order is out for delivery. Be ready to receive it!' },
    delivered: { title: '🎉 Order Delivered', body: 'Your order has been delivered. Enjoy your purchase!' },
    cancelled: { title: '❌ Order Cancelled', body: 'Your order has been cancelled.' },
    failed: { title: '⚠️ Delivery Failed', body: 'We could not deliver your order. We will attempt again shortly.' },
    returned: { title: '↩️ Order Returned', body: 'Your order has been returned successfully.' },
  };

  const msg = STATUS_MESSAGES[orderStatus] || {
    title: 'Order Update',
    body: `Your order status has been updated to: ${orderStatus.replace(/-/g, ' ')}.`,
  };

  await sendPushNotification(
    user.fcmToken,
    msg.title,
    msg.body,
    {
      screen: 'TrackOrder',
      orderId: String(orderId),
      orderStatus,
    },
    user._id,
    orderId
  );
};

module.exports = { sendPushNotification, sendOrderStatusNotification };
