const Ticket = require('../../models/Ticket');
const Order = require('../../models/Order');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { emitToAdmins, socketEvents } = require('../../utils/eventBus');

/**
 * Get all tickets with filters
 */
exports.getAllTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, assignedTo, sortBy = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;

    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .populate('user', 'name email phone')
      .populate('order', 'razorpayOrderId')
      .populate('assignedTo', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: tickets,
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
 * Get ticket details
 */
exports.getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId)
      .populate('user', 'name email phone')
      .populate('order', 'razorpayOrderId totalAmount status')
      .populate('assignedTo', 'name email')
      .populate('messages.sender');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create new ticket (from customer or admin)
 */
exports.createTicket = async (req, res) => {
  try {
    const { userId, orderId, subject, description, category, priority, attachments } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const ticket = new Ticket({
      user: userId,
      order: orderId,
      subject,
      description,
      category,
      priority: priority || 'medium',
      messages: [
        {
          sender: userId,
          senderType: 'user',
          message: description,
          attachments: attachments || []
        }
      ]
    });

    await ticket.save();

    // Emit ticket event for admin realtime UI
    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_CREATED, {
      ticketId: String(ticket._id),
      userId: String(userId),
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedTo: ticket.assignedTo?.toString() || null,
    });

    // Log audit
    await AuditLog.create({
      actor: req.adminUser?._id || userId,
      action: 'create_ticket',
      entityType: 'ticket',
      entityId: ticket._id,
      ipAddress: req.ip
    });

    res.status(201).json({ 
      success: true, 
      data: ticket,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Assign ticket to admin
 */
exports.assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { adminUserId } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.assignedTo = adminUserId;
    ticket.status = 'in_progress';

    await ticket.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_UPDATED, {
      ticketId: String(ticket._id),
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo?.toString() || null,
    });

    res.json({ success: true, data: ticket, message: 'Ticket assigned' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add message to ticket
 */
exports.addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, attachments } = req.body;
    const senderId = req.adminUser?._id || req.userId;
    const senderType = req.adminUser ? 'admin' : 'user';

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.messages.push({
      sender: senderId,
      senderType,
      message,
      attachments: attachments || []
    });

    if (senderType === 'admin') {
      ticket.status = 'in_progress';
    } else {
      ticket.status = 'waiting_admin';
    }

    ticket.lastActivityAt = new Date();
    await ticket.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_UPDATED, {
      ticketId: String(ticket._id),
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo?.toString() || null,
      message: ticket.messages.at(-1)?.message || undefined,
    });

    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_MESSAGE_ADDED, {
      ticketId: String(ticket._id),
      message: ticket.messages.at(-1)?.message || undefined,
      senderType,
      updatedBy: String(senderId),
      status: ticket.status,
      assignedTo: ticket.assignedTo?.toString() || null,
    });

    res.json({ success: true, data: ticket, message: 'Message added' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update ticket status
 */
exports.updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, solution } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const previousStatus = ticket.status;
    ticket.status = status;

    if (status === 'resolved' || status === 'closed') {
      ticket.resolution = {
        solution: solution || '',
        resolvedAt: new Date(),
        resolvedBy: req.adminUser._id
      };
    }

    await ticket.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_UPDATED, {
      ticketId: String(ticket._id),
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo?.toString() || null,
    });

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'update_ticket_status',
      entityType: 'ticket',
      entityId: ticket._id,
      changes: { before: { status: previousStatus }, after: { status } },
      ipAddress: req.ip
    });

    res.json({ success: true, data: ticket, message: `Ticket ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Escalate ticket
 */
exports.escalateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { escalateTo, reason } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.status = 'escalated';
    ticket.priority = 'high';
    ticket.escalationHistory.push({
      escalatedFrom: ticket.assignedTo?.toString() || 'unassigned',
      escalatedTo: escalateTo,
      reason,
      escalatedBy: req.adminUser._id
    });
    ticket.assignedTo = escalateTo;

    await ticket.save();

    emitToAdmins(req.app, socketEvents.DOMAIN.TICKET_UPDATED, {
      ticketId: String(ticket._id),
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo?.toString() || null,
    });

    res.json({ success: true, data: ticket, message: 'Ticket escalated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add rating to ticket (customer satisfaction)
 */
exports.addTicketRating = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { rating, feedback } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.satisfaction = {
      rating,
      feedback: feedback || '',
      ratedAt: new Date()
    };

    await ticket.save();

    res.json({ success: true, data: ticket, message: 'Rating added' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get ticket statistics
 */
exports.getTicketStats = async (req, res) => {
  try {
    const stats = await Ticket.aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          avgResolutionTime: [
            {
              $match: { resolution: { $exists: true } }
            },
            {
              $group: {
                _id: null,
                avgHours: {
                  $avg: {
                    $divide: [
                      { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                      1000 * 60 * 60
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    const total = await Ticket.countDocuments();
    const avgRating = await Ticket.aggregate([
      {
        $match: { 'satisfaction.rating': { $exists: true } }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$satisfaction.rating' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...stats[0],
        total,
        avgRating: avgRating[0]?.avgRating?.toFixed(2) || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
