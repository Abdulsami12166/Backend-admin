const crypto = require('crypto');
const { sendSuccess, sendError, sendServerError } = require('../utils/feedback');
const Refund = require('../models/Refund');
const RefundLedger = require('../models/RefundLedger');

/**
 * Razorpay webhook handler
 * Verifies signature and processes refund events to update Refund and RefundLedger records.
 */
exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body; // body-parser.raw supplies Buffer

    if (!secret || !signature) {
      return res.status(400).json({ success: false, message: 'Webhook secret not configured or signature missing' });
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected !== signature) {
      return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const evt = String(payload.event || '');

    // Handle refund events
    if (evt.startsWith('refund') || evt.includes('refund')) {
      const refundEntity = payload.payload && (payload.payload.refund || payload.payload.payment?.refunds?.items?.[0]);
      // Some webhook payloads attach refund under payload.refund.entity or payload.payment.entity
      const refundData = refundEntity && (refundEntity.entity || refundEntity);
      if (refundData) {
        const paymentId = refundData.payment_id || refundData.paymentId || refundData.payment?.id;
        const refundId = refundData.id || refundData.refund_id;
        const amount = refundData.amount || refundData.amount_refunded || 0;

        // Update ledger and refund records if we can match by paymentId or refundId
        let ledger = null;
        if (paymentId) ledger = await RefundLedger.findOne({ transactionId: paymentId });
        if (!ledger && refundId) ledger = await RefundLedger.findOne({ refundId });

        if (ledger) {
          ledger.status = 'settled';
          ledger.refundId = refundId || ledger.refundId;
          ledger.settledAt = new Date();
          await ledger.save();

          // Update refund record
          if (ledger.refund) {
            const refund = await Refund.findById(ledger.refund);
            if (refund) {
              refund.status = 'completed';
              refund.refundStatus = 'processed';
              refund.paymentDetails.refundId = refundId || refund.paymentDetails.refundId;
              refund.completionDate = new Date();
              refund.timeline.push({ event: 'webhook_settled', description: `Refund settled via webhook ${refundId}`, timestamp: new Date() });
              await refund.save();
            }
          }
        }
      }
    }

    // Respond quickly with 200
    return sendSuccess(res, 200, 'Webhook processed');
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};
