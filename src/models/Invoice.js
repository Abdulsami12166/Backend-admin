const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, required: true }, // e.g., "INV-20240101-001"
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled'],
      default: 'draft',
    },
    billingAddress: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      gstin: { type: String, default: '' }, // For Indian invoices
    },
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: {
      type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
      value: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    },
    tax: {
      amount: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
    },
    shippingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    paymentTerms: { type: String, default: 'Due on receipt' },
    pdfUrl: { type: String, default: '' },
    sentAt: { type: Date },
    viewedAt: { type: Date },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true },
        method: { type: String },
        reference: { type: String },
        notes: { type: String },
      }
    ],
    creditNotes: [
      {
        creditNoteNumber: { type: String },
        amount: { type: Number },
        reason: { type: String },
        issueDate: { type: Date },
      }
    ],
    customFields: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

// Auto-generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments();
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    this.invoiceNumber = `INV-${date}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Calculate amounts due before save
invoiceSchema.pre('save', function(next) {
  if (this.isModified('total') || this.isModified('amountPaid')) {
    this.amountDue = Math.max(0, this.total - this.amountPaid);
  }
  next();
});

// Indexes
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ user: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
