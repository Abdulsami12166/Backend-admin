const Invoice = require('../models/Invoice');
const Order = require('../models/Order');

/**
 * Automatically generate or update an invoice for a given order ID.
 */
const generateInvoiceForOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('address');

    if (!order) {
      console.warn(`[InvoiceService] Order not found for ID: ${orderId}`);
      return null;
    }

    // Check if invoice already exists
    let invoice = await Invoice.findOne({ order: orderId });
    if (invoice) {
      // Update payment status on existing invoice
      invoice.status = order.paymentStatus === 'paid' ? 'paid' : 'sent';
      if (order.paymentStatus === 'paid') {
        invoice.amountPaid = order.totalAmount;
        invoice.amountDue = 0;
      }
      await invoice.save();
      return invoice;
    }

    const isPaid = order.paymentStatus === 'paid';
    const status = isPaid ? 'paid' : 'sent';

    invoice = new Invoice({
      order: orderId,
      user: order.user._id,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day term default
      billingAddress: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
        address: order.address?.address || 'Billing Address',
        city: order.address?.city || 'City',
        state: order.address?.state || 'State',
        postalCode: order.address?.postalCode || '000000',
        country: order.address?.country || 'India'
      },
      shippingAddress: {
        name: order.user.name,
        phone: order.user.phone,
        address: order.address?.address || 'Shipping Address',
        city: order.address?.city || 'City',
        state: order.address?.state || 'State',
        postalCode: order.address?.postalCode || '000000',
        country: order.address?.country || 'India'
      },
      items: order.items.map(item => ({
        product: item.product,
        description: item.title,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity
      })),
      subtotal: order.subtotal,
      tax: { amount: order.taxAmount || 0 },
      shippingCost: order.shippingFee || 0,
      total: order.totalAmount,
      amountPaid: isPaid ? order.totalAmount : 0,
      amountDue: isPaid ? 0 : order.totalAmount,
      status,
      terms: 'Due on receipt'
    });

    await invoice.save();
    console.log(`[InvoiceService] Invoice auto-generated: ${invoice.invoiceNumber}`);
    return invoice;
  } catch (err) {
    console.error('[InvoiceService] Failed to auto-generate invoice:', err.message);
    return null;
  }
};

/**
 * Record payment on the invoice corresponding to an order.
 */
const handleInvoicePayment = async (orderId, paymentDetails = {}) => {
  try {
    const invoice = await Invoice.findOne({ order: orderId });
    if (!invoice) {
      // Try generating first
      return await generateInvoiceForOrder(orderId);
    }

    const amount = paymentDetails.amount || invoice.total;
    invoice.payments.push({
      amount,
      date: new Date(),
      method: paymentDetails.method || 'online',
      reference: paymentDetails.reference || '',
      notes: paymentDetails.notes || 'Payment captured'
    });

    invoice.amountPaid = Math.min(invoice.total, invoice.amountPaid + amount);
    invoice.amountDue = Math.max(0, invoice.total - invoice.amountPaid);

    if (invoice.amountDue === 0) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partial';
    }

    await invoice.save();
    console.log(`[InvoiceService] Recorded payment for invoice: ${invoice.invoiceNumber}`);
    return invoice;
  } catch (err) {
    console.error('[InvoiceService] Failed to record payment on invoice:', err.message);
    return null;
  }
};

/**
 * Handle a refund/return by issuing a credit note on the invoice.
 */
const handleInvoiceRefund = async (orderId, refundAmount, reason) => {
  try {
    const invoice = await Invoice.findOne({ order: orderId });
    if (!invoice) return null;

    const cnCount = invoice.creditNotes.length;
    const creditNoteNumber = `CN-${invoice.invoiceNumber}-${cnCount + 1}`;

    invoice.creditNotes.push({
      creditNoteNumber,
      amount: refundAmount,
      reason: reason || 'Return refund',
      issueDate: new Date()
    });

    // Reduce amount paid (since it's returned to customer) or reduce due
    invoice.amountDue = Math.max(0, invoice.amountDue - refundAmount);
    
    // If it's a full refund, update invoice status
    if (invoice.total <= invoice.creditNotes.reduce((sum, cn) => sum + cn.amount, 0)) {
      invoice.status = 'cancelled';
    }

    await invoice.save();
    console.log(`[InvoiceService] Issued credit note ${creditNoteNumber} for invoice: ${invoice.invoiceNumber}`);
    return invoice;
  } catch (err) {
    console.error('[InvoiceService] Failed to issue credit note on invoice:', err.message);
    return null;
  }
};

module.exports = {
  generateInvoiceForOrder,
  handleInvoicePayment,
  handleInvoiceRefund
};
