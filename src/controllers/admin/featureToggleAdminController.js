const FeatureToggle = require('../../models/FeatureToggle');
const AuditLog = require('../../models/AuditLog');

/**
 * Get all feature toggles
 */
exports.getAllFeatureToggles = async (req, res) => {
  try {
    const { category, isEnabled, visibility, sortBy = '-createdAt' } = req.query;

    let query = {};
    if (category) query.category = category;
    if (isEnabled !== undefined) query.isEnabled = isEnabled === 'true';
    if (visibility) query.visibility = visibility;

    const toggles = await FeatureToggle.find(query)
      .populate('enabledBy', 'name email')
      .populate('disabledBy', 'name email')
      .sort(sortBy);

    res.json({
      success: true,
      data: toggles,
      count: toggles.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get feature toggle details
 */
exports.getFeatureToggleDetails = async (req, res) => {
  try {
    const { name } = req.params;

    const toggle = await FeatureToggle.findOne({ name })
      .populate('enabledBy', 'name email')
      .populate('disabledBy', 'name email');

    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    res.json({ success: true, data: toggle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Enable feature
 */
exports.enableFeature = async (req, res) => {
  try {
    const { name } = req.params;
    const { rolloutPercentage = 100, configuration } = req.body;

    let toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      // Create if doesn't exist
      toggle = new FeatureToggle({
        name,
        displayName: name,
        category: 'experimental',
        isEnabled: true,
        rolloutPercentage
      });
    } else {
      toggle.isEnabled = true;
      toggle.rolloutPercentage = rolloutPercentage;
    }

    if (configuration) {
      toggle.configuration = configuration;
    }

    toggle.enabledAt = new Date();
    toggle.enabledBy = req.adminUser._id;
    await toggle.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'enable_feature',
      entityType: 'feature_toggle',
      entityId: toggle._id,
      changes: { after: { isEnabled: true, rolloutPercentage } },
      ipAddress: req.ip,
      severity: rolloutPercentage < 100 ? 'info' : 'warning'
    });

    res.json({ success: true, data: toggle, message: `Feature '${name}' enabled` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Disable feature
 */
exports.disableFeature = async (req, res) => {
  try {
    const { name } = req.params;

    const toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    toggle.isEnabled = false;
    toggle.disabledAt = new Date();
    toggle.disabledBy = req.adminUser._id;
    await toggle.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'disable_feature',
      entityType: 'feature_toggle',
      entityId: toggle._id,
      changes: { after: { isEnabled: false } },
      ipAddress: req.ip,
      severity: 'warning'
    });

    res.json({ success: true, data: toggle, message: `Feature '${name}' disabled` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update rollout percentage (gradual rollout)
 */
exports.updateRollout = async (req, res) => {
  try {
    const { name } = req.params;
    const { rolloutPercentage } = req.body;

    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      return res.status(400).json({ success: false, message: 'Rollout percentage must be between 0 and 100' });
    }

    const toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    const oldPercentage = toggle.rolloutPercentage;
    toggle.rolloutPercentage = rolloutPercentage;
    await toggle.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'update_rollout',
      entityType: 'feature_toggle',
      entityId: toggle._id,
      changes: { before: { rollout: oldPercentage }, after: { rollout: rolloutPercentage } },
      ipAddress: req.ip
    });

    res.json({ success: true, data: toggle, message: `Rollout percentage updated to ${rolloutPercentage}%` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update feature configuration
 */
exports.updateConfiguration = async (req, res) => {
  try {
    const { name } = req.params;
    const { configuration } = req.body;

    const toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    toggle.configuration = configuration;
    await toggle.save();

    // Log audit
    await AuditLog.create({
      actor: req.adminUser._id,
      action: 'update_feature_config',
      entityType: 'feature_toggle',
      entityId: toggle._id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: toggle, message: 'Configuration updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check if feature is enabled
 */
exports.isFeatureEnabled = async (req, res) => {
  try {
    const { name } = req.params;
    const { userId, userType } = req.query;

    const toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      return res.json({ success: true, data: { enabled: false, reason: 'Feature not found' } });
    }

    // Check if globally disabled
    if (!toggle.isEnabled) {
      return res.json({ success: true, data: { enabled: false, reason: 'Feature disabled' } });
    }

    // Check target audience
    if (userType && toggle.targetAudience.userTypes.length > 0) {
      if (!toggle.targetAudience.userTypes.includes(userType)) {
        return res.json({ success: true, data: { enabled: false, reason: 'Not in target audience' } });
      }
    }

    // Check rollout percentage
    if (toggle.rolloutPercentage < 100) {
      const hash = Math.abs(((userId || '').toString()).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)) % 100;
      if (hash >= toggle.rolloutPercentage) {
        return res.json({ success: true, data: { enabled: false, reason: 'Not in rollout percentage' } });
      }
    }

    res.json({
      success: true,
      data: {
        enabled: true,
        configuration: toggle.configuration
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create new feature toggle
 */
exports.createFeatureToggle = async (req, res) => {
  try {
    const { name, displayName, category, description } = req.body;

    const existing = await FeatureToggle.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Feature toggle already exists' });
    }

    const toggle = new FeatureToggle({
      name,
      displayName,
      category: category || 'experimental',
      description,
      isEnabled: false
    });

    await toggle.save();

    res.status(201).json({ success: true, data: toggle, message: 'Feature toggle created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get feature toggle statistics
 */
exports.getFeatureStats = async (req, res) => {
  try {
    const stats = await FeatureToggle.aggregate([
      {
        $facet: {
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } }
          ],
          byVisibility: [
            { $group: { _id: '$visibility', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } }
          ],
          totalStats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } },
                avgRollout: { $avg: '$rolloutPercentage' }
              }
            }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byCategory: stats[0].byCategory,
        byVisibility: stats[0].byVisibility,
        summary: stats[0].totalStats[0]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get feature dependencies
 */
exports.getFeatureDependencies = async (req, res) => {
  try {
    const { name } = req.params;

    const toggle = await FeatureToggle.findOne({ name });
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    const dependencies = await FeatureToggle.find({
      name: { $in: toggle.dependencies.map(d => d.featureName) }
    });

    res.json({
      success: true,
      data: {
        feature: toggle,
        dependencies,
        allMet: dependencies.every(d => d.isEnabled === true)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
