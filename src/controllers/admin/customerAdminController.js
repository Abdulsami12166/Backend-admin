const User = require('../../models/User');
const UserActivity = require('../../models/UserActivity');
const NotificationPreference = require('../../models/NotificationPreference');

/**
 * Get all customers with pagination and filters
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    // Only return customers (role: 'user'), not admins
    let query = { role: 'user' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    // Build sort object respecting sortOrder param
    const sortField = sortOrder === 'asc' ? sortBy : `-${sortBy}`;

    const total = await User.countDocuments(query);
    const customers = await User.find(query)
      .sort(sortField)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password');

    res.json({
      success: true,
      data: customers,
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
 * Get customer details
 */
exports.getCustomerDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const customer = await User.findById(userId).select('-password');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const activityLogs = await UserActivity.find({ user: userId })
      .sort('-createdAt')
      .limit(50);

    const preferences = await NotificationPreference.findOne({ user: userId });

    res.json({
      success: true,
      data: {
        customer,
        activityLogs,
        preferences: preferences || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get customer activity logs
 */
exports.getCustomerActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    let query = { user: userId };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await UserActivity.countDocuments(query);
    const logs = await UserActivity.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
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
 * Get customer notification preferences
 */
exports.getNotificationPreferences = async (req, res) => {
  try {
    const { userId } = req.params;

    let preferences = await NotificationPreference.findOne({ user: userId });
    
    if (!preferences) {
      // Create default preferences if not exist
      preferences = new NotificationPreference({ user: userId });
      await preferences.save();
    }

    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update notification preferences
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    let preferences = await NotificationPreference.findOne({ user: userId });
    
    if (!preferences) {
      preferences = new NotificationPreference({ user: userId });
    }

    Object.assign(preferences, updates);
    preferences.updatedBy = 'admin';
    await preferences.save();

    res.json({ success: true, data: preferences, message: 'Preferences updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Block/Unblock customer
 */
exports.toggleCustomerStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    // Infer action from URL path if not provided in body
    const action = req.body.action || (req.path.endsWith('/block') ? 'block' : 'unblock');

    const customer = await User.findById(userId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (action === 'block') {
      customer.status = 'blocked';
      customer.blockedAt = new Date();
      customer.blockedBy = req.adminUser._id;
    } else if (action === 'unblock') {
      customer.status = 'active';
      customer.blockedAt = null;
      customer.blockedBy = null;
    }

    await customer.save();

    // Log activity
    await UserActivity.create({
      user: userId,
      type: action === 'block' ? 'account_blocked' : 'account_unblocked',
      description: `Account ${action === 'block' ? 'blocked' : 'unblocked'} by admin`,
      adminId: req.adminUser._id,
      metadata: { action, reason: req.body.reason || '' }
    });

    res.json({ success: true, data: customer, message: `Customer ${action === 'block' ? 'blocked' : 'unblocked'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get customer statistics
 */
exports.getCustomerStats = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const activeCustomers = await User.countDocuments({ role: 'user', status: 'active' });
    const blockedCustomers = await User.countDocuments({ role: 'user', status: 'blocked' });

    res.json({
      success: true,
      data: {
        total: totalCustomers,
        active: activeCustomers,
        blocked: blockedCustomers,
        ratio: {
          active: ((activeCustomers / totalCustomers) * 100).toFixed(2),
          blocked: ((blockedCustomers / totalCustomers) * 100).toFixed(2)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
