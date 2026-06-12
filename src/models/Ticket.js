const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, required: true }, // User or AdminUser
    senderType: { type: String, enum: ['user', 'admin'], required: true },
    message: { type: String, required: true },
    attachments: [{ type: String }], // URLs
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, required: true }, // e.g., "TKT-20240101-001"
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', sparse: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['order_issue', 'product_quality', 'delivery_issue', 'payment_issue', 'return_refund', 'account', 'other'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_customer', 'waiting_admin', 'escalated', 'resolved', 'closed'],
      default: 'open',
    },
    severity: {
      type: String,
      enum: ['minor', 'major', 'critical'],
      default: 'minor',
    },
    messages: [ticketMessageSchema],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', sparse: true, index: true },
    tags: [{ type: String }],
    resolution: {
      solution: { type: String, default: '' },
      resolvedAt: { type: Date },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    },
    escalationHistory: [
      {
        escalatedFrom: { type: String },
        escalatedTo: { type: String },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now },
        escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      }
    ],
    sla: {
      responseDeadline: { type: Date },
      resolutionDeadline: { type: Date },
      firstResponseAt: { type: Date },
      breached: { type: Boolean, default: false },
    },
    satisfaction: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: { type: String },
      ratedAt: { type: Date },
    },
    customFields: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

// Auto-generate ticket number
ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    this.ticketNumber = `TKT-${date}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Indexes
// ticketNumber is already unique and indexed via field-level unique: true
ticketSchema.index({ user: 1 });
ticketSchema.index({ order: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ category: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
