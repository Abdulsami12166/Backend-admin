const Razorpay = require('razorpay');
const { AppError } = require('../utils/appError');

function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay is not configured on the server', 500);
  }

  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

async function refundPayment(paymentId, amountInPaise, notes = {}) {
  if (!paymentId) throw new AppError('paymentId is required to issue a refund', 400);
  const client = getRazorpayClient();
  // amount is optional; if provided, pass as paise
  const payload = {};
  if (amountInPaise && Number(amountInPaise) > 0) payload.amount = Number(amountInPaise);
  if (notes && typeof notes === 'object') payload.notes = notes;

  // Returns the refund object from Razorpay
  return client.payments.refund(paymentId, payload);
}

module.exports = {
  refundPayment,
  getRazorpayClient,
};
