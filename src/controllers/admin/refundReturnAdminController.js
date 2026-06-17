const Return = require('../../models/Return');
const Refund = require('../../models/Refund');
const RefundLedger = require('../../models/RefundLedger');
const Order = require('../../models/Order');
const {
  sendSuccess,
  sendError,
  sendServerError,
} = require('../../utils/feedback');
const { emitToAdmins, socketEvents } = require('../../utils/eventBus');
const { auditAction, auditError } = require('../../utils/workflow');

// ============ RETURNS ============

/**
 * Get all returns
 */
exports.getAllReturns = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, refundStatus, sortBy = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (refundStatus) query.refundStatus = refundStatus;

    const total = await Return.countDocuments(query);
    const returns = await Return.find(query)
      .populate('order', 'razorpayOrderId totalAmount')
      .populate('user', 'name email phone')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    return sendSuccess(res, 200, 'Returns fetched successfully', {
      returns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Get return details
 */
exports.getReturnDetails = async (req, res) => {
  try {
    const { returnId } = req.params;

    const returnData = await Return.findById(returnId)
      .populate('order', 'razorpayOrderId totalAmount items')
      .populate('user', 'name email phone address')
      .populate('timeline.updatedBy', 'name');

    if (!returnData) {
      return sendError(res, 404, 'Return not found');
    }

    return sendSuccess(res, 200, 'Return details fetched successfully', { return: returnData });
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Approve return request
 */
exports.approveReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { notes } = req.body;

    const returnData = await Return.findById(returnId);
    if (!returnData) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }

    returnData.status = 'approved';
    returnData.approvalDate = new Date();
    returnData.adminNotes = notes || '';
    
    returnData.timeline.push({
      event: 'approved',
      updatedBy: req.adminUser._id
    });

    await returnData.save();

    await auditAction(req, 'approve_return', 'return', returnData._id, null, returnData.toObject());

    return sendSuccess(res, 200, 'Return approved successfully', { return: returnData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject return request
 */
exports.rejectReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { reason } = req.body;

    const returnData = await Return.findById(returnId);
    if (!returnData) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }

    returnData.status = 'rejected';
    returnData.rejectionDate = new Date();
    returnData.rejectionReason = reason || '';
    returnData.refundStatus = 'rejected';
    
    returnData.timeline.push({
      event: 'rejected',
      updatedBy: req.adminUser._id
    });

    await returnData.save();

    await auditAction(req, 'reject_return', 'return', returnData._id, null, returnData.toObject());

    return sendSuccess(res, 200, 'Return rejected successfully', { return: returnData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update return status
 */
exports.updateReturnStatus = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status, trackingNumber } = req.body;

    const returnData = await Return.findById(returnId);
    if (!returnData) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }

    const previousStatus = returnData.status;
    returnData.status = status;
    if (trackingNumber) returnData.trackingNumber = trackingNumber;

    if (status === 'completed') {
      returnData.completionDate = new Date();
    }

    returnData.timeline.push({
      event: `status_changed_to_${status}`,
      updatedBy: req.adminUser._id
    });

    await returnData.save();

    await auditAction(req, 'update_return_status', 'return', returnData._id, null, returnData.toObject(), {
      status,
      trackingNumber,
    });

    return sendSuccess(res, 200, `Return status updated to ${status}`, { return: returnData });
  } catch (error) {
    await auditError(req, 'update_return_status', 'return', req.params.returnId, error);
    return sendServerError(res, error.message, error.stack);
  }
};

// ============ REFUNDS ============

/**
 * Get all refunds
 */
exports.getAllRefunds = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sortBy = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    const total = await Refund.countDocuments(query);
    const refunds = await Refund.find(query)
      .populate('order', 'razorpayOrderId totalAmount')
      .populate('user', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    return sendSuccess(res, 200, 'Refunds fetched successfully', {
      refunds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Get refund details
 */
exports.getRefundDetails = async (req, res) => {
  try {
    const { refundId } = req.params;

    const refund = await Refund.findById(refundId)
      .populate('order')
      .populate('return')
      .populate('user', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    if (!refund) {
      return sendError(res, 404, 'Refund not found');
    }

    return sendSuccess(res, 200, 'Refund details fetched successfully', { refund });
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Approve refund request
 */
exports.approveRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { actualRefundAmount, notes } = req.body;

    const refund = await Refund.findById(refundId);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    refund.status = 'approved';
    refund.refundStatus = 'approved';
    refund.approvalDate = new Date();
    refund.approvedBy = req.adminUser._id;
    if (actualRefundAmount) {
      refund.actualRefundAmount = actualRefundAmount;
    }
    if (notes) {
      refund.processingNotes = notes;
    }

    refund.timeline.push({
      event: 'approved',
      timestamp: new Date(),
      updatedBy: req.adminUser._id
    });

    await refund.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_UPDATED, {
      refundId: String(refund._id),
      status: refund.status,
      refundStatus: refund.refundStatus,
      approvedBy: refund.approvedBy?.toString() || null,
    });

    await auditAction(req, 'approve_refund', 'refund', refund._id, null, refund.toObject());

    return sendSuccess(res, 200, 'Refund approved successfully', { refund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject refund request
 */
exports.rejectRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { reason } = req.body;

    const refund = await Refund.findById(refundId);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    refund.status = 'rejected';
    refund.refundStatus = 'rejected';
    refund.rejectionReason = reason || '';

    refund.timeline.push({
      event: 'rejected',
      timestamp: new Date(),
      updatedBy: req.adminUser._id
    });

    await refund.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_UPDATED, {
      refundId: String(refund._id),
      status: refund.status,
      refundStatus: refund.refundStatus,
      rejectionReason: refund.rejectionReason,
    });

    await auditAction(req, 'reject_refund', 'refund', refund._id, null, refund.toObject());

    return sendSuccess(res, 200, 'Refund rejected successfully', { refund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Process refund payment
 */
exports.processRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { paymentGateway, transactionId } = req.body;

    const refund = await Refund.findById(refundId);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    // Integrate with payment gateway as an async step; update status and create ledger entry (idempotent)
    refund.status = 'processing';
    refund.paymentDetails.gateway = paymentGateway;
    refund.paymentDetails.transactionId = transactionId;
    refund.processingDate = new Date();
    refund.processedBy = req.adminUser._id;

    refund.timeline.push({
      event: 'processing',
      description: `Refund processing initiated via ${paymentGateway}`,
      timestamp: new Date(),
      updatedBy: req.adminUser._id,
    });

    // Save refund update first
    await refund.save();

    // Create an atomic ledger entry for this refund if one doesn't already exist for the same refund+transaction
    try {
      const amount = refund.actualRefundAmount || refund.refundAmount || 0;
      const existing = await RefundLedger.findOne({ refund: refund._id, transactionId });

      if (!existing) {
        const ledger = await RefundLedger.create({
          refund: refund._id,
          order: refund.order,
          user: refund.user,
          amount,
          type: 'refund',
          status: 'processing',
          gateway: paymentGateway,
          transactionId,
          metadata: { initiatedBy: req.adminUser._id },
          createdBy: req.adminUser._id,
        });

        refund.timeline.push({
          event: 'ledger_created',
          description: `Ledger ${ledger._id} created`,
          timestamp: new Date(),
          updatedBy: req.adminUser._id,
        });

        await refund.save();

        emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_LEDGER_UPDATED, {
          refundId: String(refund._id),
          ledgerId: String(ledger._id),
          transactionId,
          status: ledger.status,
          gateway: ledger.gateway,
          amount,
        });
      }
      // If a gateway and transactionId were provided and gateway supports immediate refund, attempt to call it
      if (paymentGateway && transactionId && paymentGateway.toLowerCase() === 'razorpay') {
        try {
          const { refundPayment } = require('../../services/paymentGateway');
          // amount to paise
          const amountPaise = Math.round((refund.actualRefundAmount || refund.refundAmount || 0) * 100);
          const razorRefund = await refundPayment(transactionId, amountPaise, { refundId: String(refund._id) });
          // Save gateway refund id
          refund.paymentDetails.refundId = razorRefund.id || refund.paymentDetails.refundId;
          refund.paymentDetails.gateway = 'razorpay';
          refund.timeline.push({
            event: 'gateway_refund_initiated',
            description: `Refund requested from Razorpay: ${razorRefund.id}`,
            timestamp: new Date(),
            updatedBy: req.adminUser._id,
          });
          await refund.save();
        } catch (gwErr) {
          // Do not fail whole request if gateway call fails; log audit
          await auditError(req, 'gateway_refund_failed', 'refund', refund._id, gwErr);
        }
      }
    } catch (ledgerErr) {
      // Log audit error but do not block processing; allow manual reconciliation
      await auditError(req, 'create_refund_ledger', 'refund', refund._id, ledgerErr);
    }

    await auditAction(req, 'process_refund', 'refund', refund._id, null, refund.toObject(), {
      paymentGateway,
      transactionId,
    });

    emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_UPDATED, {
      refundId: String(refund._id),
      status: refund.status,
      refundStatus: refund.refundStatus,
      paymentDetails: refund.paymentDetails,
    });

    return sendSuccess(res, 200, 'Refund processing initiated', { refund });
  } catch (error) {
    await auditError(req, 'process_refund', 'refund', req.params.refundId, error);
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Complete refund
 */
exports.completeRefund = async (req, res) => {
  try {
    const { refundId } = req.params;

    const refund = await Refund.findById(refundId);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    refund.status = 'completed';
    refund.refundStatus = 'processed';
    refund.completionDate = new Date();

    refund.timeline.push({
      event: 'completed',
      timestamp: new Date(),
      updatedBy: req.adminUser._id,
    });

    // Update refund and mark ledger settled (if present)
    await refund.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_UPDATED, {
      refundId: String(refund._id),
      status: refund.status,
      refundStatus: refund.refundStatus,
      completionDate: refund.completionDate,
    });

    try {
      const ledger = await RefundLedger.findOne({ refund: refund._id });
      if (ledger) {
        ledger.status = 'settled';
        ledger.settledAt = new Date();
        await ledger.save();
        refund.timeline.push({
          event: 'ledger_settled',
          description: `Ledger ${ledger._id} marked settled`,
          timestamp: new Date(),
          updatedBy: req.adminUser._id,
        });
        await refund.save();

        emitToAdmins(req.app, socketEvents.DOMAIN.REFUND_LEDGER_UPDATED, {
          refundId: String(refund._id),
          ledgerId: String(ledger._id),
          status: ledger.status,
          settledAt: ledger.settledAt,
        });
      }
    } catch (ledgerErr) {
      await auditError(req, 'settle_refund_ledger', 'refund', refund._id, ledgerErr);
    }

    await auditAction(req, 'complete_refund', 'refund', refund._id, null, refund.toObject());

    return sendSuccess(res, 200, 'Refund completed successfully', { refund });
  } catch (error) {
    await auditError(req, 'complete_refund', 'refund', req.params.refundId, error);
    return sendServerError(res, error.message, error.stack);
  }
};

/**
 * Get refund statistics
 */
exports.getRefundStats = async (req, res) => {
  try {
    const stats = await Refund.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      }
    ]);

    const total = await Refund.countDocuments();
    const pendingAmount = await Refund.aggregate([
      { $match: { status: { $in: ['initiated', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } }
    ]);

    return sendSuccess(res, 200, 'Refund statistics fetched successfully', {
      byStatus: stats,
      total,
      pendingAmount: pendingAmount[0]?.total || 0,
    });
  } catch (error) {
    return sendServerError(res, error.message, error.stack);
  }
};
