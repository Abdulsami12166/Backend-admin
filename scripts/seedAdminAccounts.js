require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../src/models/User');

const accounts = [
  {
    name: 'Super Admin',
    email: 'superadmin@company.com',
    role: 'super-admin',
    passwordEnv: 'SUPER_ADMIN_PASSWORD',
    defaultPassword: 'SuperAdmin@123',
  },
  {
    name: 'Product Manager',
    email: 'products@company.com',
    role: 'product-manager',
    passwordEnv: 'PRODUCT_MANAGER_PASSWORD',
    defaultPassword: 'ProductManager@123',
  },
  {
    name: 'Support Admin',
    email: 'support@company.com',
    role: 'support',
    passwordEnv: 'SUPPORT_ADMIN_PASSWORD',
    defaultPassword: 'SupportAdmin@123',
  },
];

async function seedAdminAccounts() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(mongoUri);

  const results = [];
  for (const account of accounts) {
    const user = await User.findOne({email: account.email}).select('+password +tokenVersion');
    const password = process.env[account.passwordEnv] || account.defaultPassword;

    if (user) {
      user.name = account.name;
      user.role = account.role;
      user.password = password;
      user.isVerified = true;
      user.blocked = false;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();
      results.push({email: account.email, role: account.role, status: 'updated'});
      continue;
    }

    await User.create({
      name: account.name,
      email: account.email,
      password,
      role: account.role,
      isVerified: true,
      blocked: false,
    });
    results.push({email: account.email, role: account.role, status: 'created'});
  }

  return results;
}

seedAdminAccounts()
  .then(results => {
    console.table(results);
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
