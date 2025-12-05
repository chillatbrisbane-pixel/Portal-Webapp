/**
 * Migration script to update user roles from old names to new names
 * 
 * Old roles -> New roles:
 * - technician -> viewer
 * - manager -> tech
 * - admin -> admin (unchanged)
 * 
 * Run with: node migrate-roles.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal';

async function migrateRoles() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update technician -> viewer
    const technicianResult = await User.updateMany(
      { role: 'technician' },
      { $set: { role: 'viewer' } }
    );
    console.log(`Updated ${technicianResult.modifiedCount} users from 'technician' to 'viewer'`);

    // Update manager -> tech
    const managerResult = await User.updateMany(
      { role: 'manager' },
      { $set: { role: 'tech' } }
    );
    console.log(`Updated ${managerResult.modifiedCount} users from 'manager' to 'tech'`);

    // Summary
    const users = await User.find({}).select('email role');
    console.log('\nCurrent user roles:');
    users.forEach(u => console.log(`  ${u.email}: ${u.role}`));

    console.log('\nMigration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateRoles();
