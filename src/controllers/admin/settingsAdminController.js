const StoreSetting = require('../../models/StoreSetting');
const AuditLog = require('../../models/AuditLog');

/**
 * Get all store settings grouped by category
 */
exports.getAllSettings = async (req, res) => {
  try {
    const { category, section } = req.query;

    let query = {};
    if (category) query.category = category;
    if (section) query.section = section;

    const settings = await StoreSetting.find(query).sort('category section key');

    // Group by category and section
    const grouped = {};
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {};
      }
      if (!grouped[setting.category][setting.section]) {
        grouped[setting.category][setting.section] = [];
      }
      grouped[setting.category][setting.section].push(setting);
    });

    res.json({
      success: true,
      data: grouped,
      ungrouped: settings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific setting
 */
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await StoreSetting.findOne({ key });
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update a setting
 */
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    let setting = await StoreSetting.findOne({ key });
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    if (!setting.isEditable) {
      return res.status(403).json({ success: false, message: 'This setting cannot be edited' });
    }

    const oldValue = setting.value;
    setting.value = value;
    setting.updatedBy = req.adminUser._id;
    await setting.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'update_setting',
      entityType: 'setting',
      entityId: setting._id,
      changes: {
        before: { value: oldValue },
        after: { value }
      },
      ipAddress: req.ip,
      resourcePath: `/api/admin/settings/${key}`
    });

    res.json({ success: true, data: setting, message: 'Setting updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update multiple settings
 */
exports.updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body; // Array of { key, value }

    const updated = [];
    const errors = [];

    for (const item of settings) {
      try {
        let setting = await StoreSetting.findOne({ key: item.key });
        if (!setting) {
          errors.push({ key: item.key, error: 'Not found' });
          continue;
        }

        if (!setting.isEditable) {
          errors.push({ key: item.key, error: 'Not editable' });
          continue;
        }

        setting.value = item.value;
        setting.updatedBy = req.adminUser._id;
        await setting.save();
        updated.push(setting);
      } catch (err) {
        errors.push({ key: item.key, error: err.message });
      }
    }

    res.json({
      success: errors.length === 0,
      data: { updated, errors },
      message: `Updated ${updated.length} settings`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new setting
 */
exports.createSetting = async (req, res) => {
  try {
    const { key, value, label, category, type, section, isEditable, validation } = req.body;

    const existingSetting = await StoreSetting.findOne({ key });
    if (existingSetting) {
      return res.status(400).json({ success: false, message: 'Setting already exists' });
    }

    const setting = new StoreSetting({
      key,
      value,
      label,
      category,
      type: type || 'string',
      section: section || '',
      isEditable: isEditable !== false,
      validation: validation || {},
      defaultValue: value
    });

    await setting.save();

    res.status(201).json({ success: true, data: setting, message: 'Setting created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get settings by category
 */
exports.getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const settings = await StoreSetting.find({ category }).sort('section key');

    // Group by section
    const grouped = {};
    settings.forEach(setting => {
      const section = setting.section || 'General';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(setting);
    });

    res.json({
      success: true,
      category,
      data: grouped,
      count: settings.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reset setting to default
 */
exports.resetSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await StoreSetting.findOne({ key });
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    const oldValue = setting.value;
    setting.value = setting.defaultValue;
    setting.updatedBy = req.adminUser._id;
    await setting.save();

    res.json({ success: true, data: setting, message: 'Setting reset to default' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export settings
 */
exports.exportSettings = async (req, res) => {
  try {
    const settings = await StoreSetting.find({ isPublic: false });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=store-settings.json');
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Import settings
 */
exports.importSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    const imported = [];
    const errors = [];

    for (const settingData of settings) {
      try {
        let setting = await StoreSetting.findOne({ key: settingData.key });
        if (setting) {
          setting.value = settingData.value;
          setting.label = settingData.label || setting.label;
        } else {
          setting = new StoreSetting(settingData);
        }
        setting.updatedBy = req.adminUser._id;
        await setting.save();
        imported.push(setting);
      } catch (err) {
        errors.push({ key: settingData.key, error: err.message });
      }
    }

    res.json({
      success: errors.length === 0,
      data: { imported, errors },
      message: `Imported ${imported.length} settings`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
