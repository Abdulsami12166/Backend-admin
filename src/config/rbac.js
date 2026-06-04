const ADMIN_ROLES = ['super-admin', 'product-manager', 'inventory-manager', 'support'];

const PERMISSIONS = [
  'dashboard:view',
  'admins:manage',
  'roles:assign',
  'system:configure',
  'users:view',
  'users:control',
  'products:view',
  'products:create',
  'products:publish',
  'products:delete',
  'categories:manage',
  'inventory:manage',
  'images:upload',
  'orders:view',
  'orders:update',
  'transactions:view',
  'analytics:view',
  'activity:view',
];

const DEFAULT_ROLE_PERMISSIONS = {
  'super-admin': PERMISSIONS,
  'product-manager': [
    'dashboard:view',
    'products:view',
    'products:create',
    'products:publish',
    'products:delete',
    'categories:manage',
    'inventory:manage',
    'images:upload',
    'orders:view',
    'transactions:view',
    'analytics:view',
  ],
  'inventory-manager': [
    'dashboard:view',
    'products:view',
    'inventory:manage',
    'orders:view',
    'orders:update',
  ],
  support: ['dashboard:view', 'users:view', 'orders:view', 'activity:view'],
};

const normalizeRole = role =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/^support-admin$/, 'support');

const normalizePermissions = permissions =>
  Array.from(new Set((permissions || []).filter(permission => PERMISSIONS.includes(permission))));

module.exports = {
  ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  normalizePermissions,
  normalizeRole,
};
