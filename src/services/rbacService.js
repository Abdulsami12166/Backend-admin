const RolePermission = require('../models/RolePermission');
const {
  ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  normalizePermissions,
  normalizeRole,
} = require('../config/rbac');

const SUPER_ADMIN_ROLE = 'super-admin';

const getRolePermissions = async role => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === SUPER_ADMIN_ROLE) {
    return DEFAULT_ROLE_PERMISSIONS[SUPER_ADMIN_ROLE];
  }

  const stored = await RolePermission.findOne({ role: normalizedRole }).lean();
  return stored?.permissions?.length
    ? normalizePermissions(stored.permissions)
    : DEFAULT_ROLE_PERMISSIONS[normalizedRole] || [];
};

const getPermissionMatrix = async () => {
  const storedPermissions = await RolePermission.find({ role: { $in: ADMIN_ROLES } }).lean();
  const storedByRole = new Map(storedPermissions.map(item => [item.role, item.permissions]));

  return ADMIN_ROLES.reduce((matrix, role) => {
    matrix[role] = role === SUPER_ADMIN_ROLE
      ? DEFAULT_ROLE_PERMISSIONS[SUPER_ADMIN_ROLE]
      : normalizePermissions(storedByRole.get(role) || DEFAULT_ROLE_PERMISSIONS[role]);
    return matrix;
  }, {});
};

const updateRolePermissions = async ({ role, permissions, updatedBy }) => {
  const normalizedRole = normalizeRole(role);

  if (!ADMIN_ROLES.includes(normalizedRole)) {
    const error = new Error('Invalid admin role');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedRole === SUPER_ADMIN_ROLE) {
    const error = new Error('Super Admin permissions cannot be restricted');
    error.statusCode = 400;
    throw error;
  }

  const normalizedPermissions = normalizePermissions(permissions);
  await RolePermission.findOneAndUpdate(
    { role: normalizedRole },
    { role: normalizedRole, permissions: normalizedPermissions, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return getPermissionMatrix();
};

const hasPermission = async (role, permission) => {
  if (!PERMISSIONS.includes(permission)) {
    return false;
  }

  const permissions = await getRolePermissions(role);
  return permissions.includes(permission);
};

module.exports = {
  getPermissionMatrix,
  getRolePermissions,
  hasPermission,
  updateRolePermissions,
};
