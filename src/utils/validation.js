/**
 * Comprehensive validation rules for admin actions
 * Provides reusable validation logic for all admin modules
 */

const { sendValidationError } = require('./feedback');

class ValidationError {
  constructor(field, message, code = 'INVALID_VALUE') {
    this.field = field;
    this.message = message;
    this.code = code;
  }
}

class Validator {
  constructor() {
    this.errors = [];
  }

  /**
   * Add a validation error
   */
  addError(field, message, code = 'INVALID_VALUE') {
    this.errors.push(new ValidationError(field, message, code));
    return this;
  }

  /**
   * Check if validation passed
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Get all errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Validate required field
   */
  required(value, fieldName) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      this.addError(fieldName, `${fieldName} is required`, 'REQUIRED');
    }
    return this;
  }

  /**
   * Validate email
   */
  email(value, fieldName = 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      this.addError(fieldName, `${fieldName} must be a valid email`, 'INVALID_EMAIL');
    }
    return this;
  }

  /**
   * Validate minimum length
   */
  minLength(value, min, fieldName) {
    if (value && String(value).length < min) {
      this.addError(fieldName, `${fieldName} must be at least ${min} characters`, 'TOO_SHORT');
    }
    return this;
  }

  /**
   * Validate maximum length
   */
  maxLength(value, max, fieldName) {
    if (value && String(value).length > max) {
      this.addError(fieldName, `${fieldName} must not exceed ${max} characters`, 'TOO_LONG');
    }
    return this;
  }

  /**
   * Validate minimum value
   */
  min(value, min, fieldName) {
    if (value !== undefined && Number(value) < min) {
      this.addError(fieldName, `${fieldName} must be at least ${min}`, 'TOO_SMALL');
    }
    return this;
  }

  /**
   * Validate maximum value
   */
  max(value, max, fieldName) {
    if (value !== undefined && Number(value) > max) {
      this.addError(fieldName, `${fieldName} must not exceed ${max}`, 'TOO_LARGE');
    }
    return this;
  }

  /**
   * Validate is in enum
   */
  enum(value, allowedValues, fieldName) {
    if (value && !allowedValues.includes(value)) {
      this.addError(fieldName, `${fieldName} must be one of: ${allowedValues.join(', ')}`, 'INVALID_VALUE');
    }
    return this;
  }

  /**
   * Validate number
   */
  number(value, fieldName) {
    if (value !== undefined && value !== null && value !== '' && isNaN(Number(value))) {
      this.addError(fieldName, `${fieldName} must be a number`, 'NOT_A_NUMBER');
    }
    return this;
  }

  /**
   * Validate is positive number
   */
  positiveNumber(value, fieldName) {
    this.number(value, fieldName);
    if (value !== undefined && value !== null && value !== '' && Number(value) < 0) {
      this.addError(fieldName, `${fieldName} must be a positive number`, 'NOT_POSITIVE');
    }
    return this;
  }

  /**
   * Validate array
   */
  array(value, fieldName) {
    if (value !== undefined && !Array.isArray(value)) {
      this.addError(fieldName, `${fieldName} must be an array`, 'NOT_AN_ARRAY');
    }
    return this;
  }

  /**
   * Validate array min length
   */
  arrayMinLength(value, min, fieldName) {
    if (Array.isArray(value) && value.length < min) {
      this.addError(fieldName, `${fieldName} must contain at least ${min} items`, 'ARRAY_TOO_SHORT');
    }
    return this;
  }

  /**
   * Validate custom condition
   */
  custom(condition, message, fieldName, code = 'CUSTOM_ERROR') {
    if (!condition) {
      this.addError(fieldName, message, code);
    }
    return this;
  }

  /**
   * Throw validation error as middleware response
   */
  throwIfInvalid(res) {
    if (!this.isValid()) {
      return sendValidationError(res, this.getErrors(), 'Validation failed');
    }
    return null;
  }
}

/**
 * Product validation rules
 */
const ProductValidation = {
  create(body) {
    const v = new Validator();
    v.required(body.title, 'Product title');
    v.required(body.description, 'Product description');
    v.required(body.category, 'Product category');
    v.required(body.price, 'Product price');
    v.positiveNumber(body.price, 'Price');
    if (body.discountedPrice) v.positiveNumber(body.discountedPrice, 'Discounted price');
    if (body.stock !== undefined) v.positiveNumber(body.stock, 'Stock');
    return v;
  },

  update(body) {
    const v = new Validator();
    if (body.title) v.required(body.title, 'Product title');
    if (body.price) v.positiveNumber(body.price, 'Price');
    if (body.discountedPrice) v.positiveNumber(body.discountedPrice, 'Discounted price');
    if (body.stock !== undefined) v.positiveNumber(body.stock, 'Stock');
    return v;
  },

  updateInventory(body) {
    const v = new Validator();
    v.required(body.stock, 'Stock quantity');
    v.positiveNumber(body.stock, 'Stock');
    return v;
  },
};

/**
 * Order validation rules
 */
const OrderValidation = {
  updateStatus(body) {
    const v = new Validator();
    const allowedStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
    v.required(body.orderStatus, 'Order status');
    v.enum(body.orderStatus, allowedStatuses, 'Order status');
    return v;
  },

  create(body) {
    const v = new Validator();
    v.required(body.user, 'User ID');
    v.required(body.items, 'Order items');
    v.array(body.items, 'Order items');
    v.arrayMinLength(body.items, 1, 'Order items');
    v.required(body.totalAmount, 'Total amount');
    v.positiveNumber(body.totalAmount, 'Total amount');
    return v;
  },
};

/**
 * Shipment validation rules
 */
const ShipmentValidation = {
  create(body) {
    const v = new Validator();
    v.required(body.carrier, 'Carrier');
    v.required(body.trackingNumber, 'Tracking number');
    v.required(body.estimatedDeliveryDate, 'Estimated delivery date');
    if (body.weight) v.positiveNumber(body.weight, 'Weight');
    if (body.cost) v.positiveNumber(body.cost, 'Shipping cost');
    return v;
  },

  updateTracking(body) {
    const v = new Validator();
    v.required(body.status, 'Status');
    v.required(body.location, 'Location');
    return v;
  },
};

/**
 * Refund validation rules
 */
const RefundValidation = {
  process(body) {
    const v = new Validator();
    v.required(body.amount, 'Refund amount');
    v.positiveNumber(body.amount, 'Refund amount');
    v.required(body.reason, 'Refund reason');
    return v;
  },

  approve(body) {
    const v = new Validator();
    // Approval can have optional notes
    return v;
  },

  reject(body) {
    const v = new Validator();
    v.required(body.reason, 'Rejection reason');
    return v;
  },
};

/**
 * User validation rules
 */
const UserValidation = {
  block(body) {
    const v = new Validator();
    v.required(body.reason, 'Block reason is required');
    v.minLength(body.reason, 10, 'Block reason');
    return v;
  },

  create(body) {
    const v = new Validator();
    v.required(body.name, 'Admin name');
    v.required(body.email, 'Admin email');
    v.email(body.email, 'Email');
    v.required(body.password, 'Password');
    v.minLength(body.password, 10, 'Password');
    v.required(body.role, 'Admin role');
    return v;
  },
};

/**
 * Return validation rules
 */
const ReturnValidation = {
  approve(body) {
    const v = new Validator();
    // Notes are optional
    return v;
  },

  reject(body) {
    const v = new Validator();
    v.required(body.reason, 'Rejection reason');
    return v;
  },
};

module.exports = {
  Validator,
  ValidationError,
  ProductValidation,
  OrderValidation,
  ShipmentValidation,
  RefundValidation,
  UserValidation,
  ReturnValidation,
};
