/**
 * Migration Script: Mark existing admin user for password change
 * 
 * Run this ONCE after deploying the new auth system to force the
 * existing admin user to set their email and change password.
 * 
 * Usage: node migrate-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const migrateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/av-project-manager', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find admin user with legacy username
    const adminUser = await User.findOne({ username: 'admin' });
    
    if (!adminUser) {
      console.log('No admin user with username "admin" found.');
      console.log('Checking for any admin users...');
      
      const anyAdmin = await User.findOne({ role: 'admin' });
      if (anyAdmin) {
        console.log(`Found admin: ${anyAdmin.email}`);
        console.log('No migration needed - admin already has email login.');
      } else {
        console.log('No admin users found. Run seed.js to create one.');
      }
      process.exit(0);
    }

    // Update admin to require password change
    adminUser.mustChangePassword = true;
    
    // If email is placeholder, keep it - they'll set it on first login
    if (!adminUser.email || adminUser.email === 'admin@company.com' || adminUser.email === 'admin@setup.local') {
      adminUser.email = 'admin@setup.local';
    }

    await adminUser.save();

    console.log('✅ Admin user migrated successfully!');
    console.log('');
    console.log('The admin user will be prompted to:');
    console.log('  1. Set their email address');
    console.log('  2. Create a new password');
    console.log('');
    console.log('They can still log in with "admin" / "admin123" for now.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateAdmin();
