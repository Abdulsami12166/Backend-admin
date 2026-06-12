const Return = require('../../models/Return');
const Refund = require('../../models/Refund');
const Order = require('../../models/Order');
const AuditLog = require('../../models/AuditLog');

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

    res.json({
      success: true,
      data: returns,
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
      return res.status(404).json({ success: false, message: 'Return not found' });
    }

    res.json({ success: true, data: returnData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'approve_return',
      entityType: 'return',
      entityId: returnData._id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: returnData, message: 'Return approved' });
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

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'reject_return',
      entityType: 'return',
      entityId: returnData._id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: returnData, message: 'Return rejected' });
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

    res.json({ success: true, data: returnData, message: `Return status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    res.json({
      success: true,
      data: refunds,
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
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    res.json({ success: true, data: refund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'approve_refund',
      entityType: 'refund',
      entityId: refund._id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: refund, message: 'Refund approved' });
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

    res.json({ success: true, data: refund, message: 'Refund rejected' });
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

    // Here you would integrate with payment gateway API
    // For now, just updating the status
    refund.status = 'processing';
    refund.paymentDetails.gateway = paymentGateway;
    refund.paymentDetails.transactionId = transactionId;
    refund.processingDate = new Date();
    refund.processedBy = req.adminUser._id;

    refund.timeline.push({
      event: 'processing',
      description: `Refund processing initiated via ${paymentGateway}`,
      timestamp: new Date(),
      updatedBy: req.adminUser._id
    });

    await refund.save();

    res.json({ success: true, data: refund, message: 'Refund processing initiated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      updatedBy: req.adminUser._id
    });

    await refund.save();

    res.json({ success: true, data: refund, message: 'Refund completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        pendingAmount: pendingAmount[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
