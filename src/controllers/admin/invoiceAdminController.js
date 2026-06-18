const Invoice = require('../../models/Invoice');
const Order = require('../../models/Order');
const AuditLog = require('../../models/AuditLog');

/**
 * Get all invoices
 */
exports.getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = '-invoiceDate' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'billingAddress.email': { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate('order', 'razorpayOrderId totalAmount')
      .populate('user', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get invoice details
 */
exports.getInvoiceDetails = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate('order', 'razorpayOrderId items totalAmount')
      .populate('user', 'name email phone');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create invoice from order
 */
exports.createInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { dueDate, notes, terms } = req.body;

    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('address');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ order: orderId });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'Invoice already exists for this order' });
    }

    const invoice = new Invoice({
      order: orderId,
      user: order.user._id,
      invoiceDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingAddress: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
        address: order.address?.address || '',
        city: order.address?.city || '',
        state: order.address?.state || '',
        postalCode: order.address?.postalCode || '',
        country: order.address?.country || ''
      },
      shippingAddress: {
        name: order.user.name,
        phone: order.user.phone,
        address: order.address?.address || '',
        city: order.address?.city || '',
        state: order.address?.state || '',
        postalCode: order.address?.postalCode || '',
        country: order.address?.country || ''
      },
      items: order.items.map(item => ({
        product: item.product,
        description: item.title,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity
      })),
      subtotal: order.subtotal,
      tax: { amount: order.taxAmount },
      shippingCost: order.shippingFee,
      total: order.totalAmount,
      amountDue: order.totalAmount,
      notes: notes || '',
      terms: terms || 'Due on receipt'
    });

    await invoice.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'create_invoice',
      entityType: 'invoice',
      entityId: invoice._id,
      ipAddress: req.ip
    });

    try {
      const { emitToAdmins, emitToUser } = require('../../utils/eventBus');
      emitToAdmins(req.app, 'invoice.created', { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.total, userId: invoice.user, invoiceId: invoice._id });
      emitToUser(req.app, invoice.user, 'invoice.created', { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.total, userId: invoice.user, invoiceId: invoice._id });
    } catch (err) {
      console.error('Failed to emit invoice creation event:', err.message);
    }

    res.status(201).json({ 
      success: true, 
      data: invoice,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send invoice to customer
 */
exports.sendInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate('user', 'email name');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Here you would send email to customer
    // Using nodemailer or email service

    invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();

    try {
      const { emitToUser } = require('../../utils/eventBus');
      emitToUser(req.app, invoice.user, 'invoice.updated', { invoiceNumber: invoice.invoiceNumber, status: invoice.status, totalAmount: invoice.total, userId: invoice.user, invoiceId: invoice._id });
    } catch (err) {
      console.error('Failed to emit invoice send event:', err.message);
    }

    res.json({ success: true, data: invoice, message: 'Invoice sent to customer' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record payment for invoice
 */
exports.recordPayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amount, method, reference, notes } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    invoice.payments.push({
      amount,
      date: new Date(),
      method: method || 'cash',
      reference: reference || '',
      notes: notes || ''
    });

    invoice.amountPaid += amount;
    invoice.amountDue = Math.max(0, invoice.total - invoice.amountPaid);

    if (invoice.amountDue === 0) {
      invoice.status = 'paid';
    } else if (invoice.amountPaid > 0) {
      invoice.status = 'partial';
    }

    await invoice.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'record_payment',
      entityType: 'invoice',
      entityId: invoice._id,
      changes: { after: { amountPaid: invoice.amountPaid, status: invoice.status } },
      ipAddress: req.ip
    });

    try {
      const { emitToAdmins, emitToUser } = require('../../utils/eventBus');
      emitToAdmins(req.app, 'invoice.updated', { invoiceNumber: invoice.invoiceNumber, status: invoice.status, totalAmount: invoice.total, userId: invoice.user, invoiceId: invoice._id });
      emitToUser(req.app, invoice.user, 'invoice.updated', { invoiceNumber: invoice.invoiceNumber, status: invoice.status, totalAmount: invoice.total, userId: invoice.user, invoiceId: invoice._id });
    } catch (err) {
      console.error('Failed to emit invoice payment event:', err.message);
    }

    res.json({ success: true, data: invoice, message: 'Payment recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Issue credit note
 */
exports.issueCreditNote = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amount, reason } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Generate credit note number
    const creditNoteCount = invoice.creditNotes.length;
    const creditNoteNumber = `CN-${invoice.invoiceNumber}-${creditNoteCount + 1}`;

    invoice.creditNotes.push({
      creditNoteNumber,
      amount,
      reason,
      issueDate: new Date()
    });

    invoice.amountDue = Math.max(0, invoice.amountDue - amount);
    if (invoice.amountDue === 0) {
      invoice.status = 'paid';
    }

    await invoice.save();

    res.json({ success: true, data: invoice, message: 'Credit note issued' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update invoice status
 */
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { status } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const validStatuses = ['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    invoice.status = status;
    if (status === 'cancelled') {
      invoice.amountDue = 0;
    }

    await invoice.save();

    res.json({ success: true, data: invoice, message: `Invoice status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get invoice statistics
 */
exports.getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
          ],
          totalRevenue: [
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          pendingPayments: [
            {
              $match: { status: { $in: ['sent', 'partial', 'overdue'] } }
            },
            {
              $group: { _id: null, total: { $sum: '$amountDue' } }
            }
          ],
          averageInvoiceValue: [
            { $group: { _id: null, average: { $avg: '$total' } } }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats[0].byStatus,
        totalRevenue: stats[0].totalRevenue[0]?.total || 0,
        pendingPayments: stats[0].pendingPayments[0]?.total || 0,
        averageInvoiceValue: stats[0].averageInvoiceValue[0]?.average || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
