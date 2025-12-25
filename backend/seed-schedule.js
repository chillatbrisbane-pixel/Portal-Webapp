/**
 * Seed script for Schedule feature
 * Run with: node seed-schedule.js
 * 
 * This creates:
 * - Initial technician groups
 * - Public holidays for 2025
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TechnicianGroup = require('./models/TechnicianGroup');
const PublicHoliday = require('./models/PublicHoliday');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/av-project-manager';

async function seedSchedule() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Create technician groups
    console.log('\n📋 Creating technician groups...');
    
    const existingGroups = await TechnicianGroup.countDocuments();
    if (existingGroups > 0) {
      console.log('   Groups already exist, skipping...');
    } else {
      // Get all users with tech-related roles
      const techUsers = await User.find({
        isActive: true,
        suspended: { $ne: true },
        role: { $in: ['admin', 'project-manager', 'project-coordinator', 'tech'] }
      }).select('_id name role');
      
      // Create Install Technicians group
      const installGroup = new TechnicianGroup({
        name: 'Install Technicians',
        description: 'Field installation technicians',
        displayOrder: 0,
        members: techUsers
          .filter(u => u.role === 'tech')
          .map((user, index) => ({
            memberType: 'user',
            user: user._id,
            displayOrder: index
          }))
      });
      await installGroup.save();
      console.log(`   ✅ Created "Install Technicians" with ${installGroup.members.length} members`);
      
      // Create Programmers group
      const programmersGroup = new TechnicianGroup({
        name: 'Programmers',
        description: 'System programmers and integrators',
        displayOrder: 1,
        members: techUsers
          .filter(u => u.role === 'admin' || u.role === 'project-manager')
          .slice(0, 3) // Take first 3
          .map((user, index) => ({
            memberType: 'user',
            user: user._id,
            displayOrder: index
          }))
      });
      await programmersGroup.save();
      console.log(`   ✅ Created "Programmers" with ${programmersGroup.members.length} members`);
      
      // Create Contractors group (empty - will add contractors later)
      const contractorsGroup = new TechnicianGroup({
        name: 'Contractors',
        description: 'External contractors and subcontractors',
        displayOrder: 2,
        members: []
      });
      await contractorsGroup.save();
      console.log(`   ✅ Created "Contractors" group (empty)`);
    }
    
    // Seed public holidays
    console.log('\n🎉 Seeding public holidays...');
    
    const existingHolidays = await PublicHoliday.countDocuments();
    if (existingHolidays > 0) {
      console.log('   Holidays already exist, skipping...');
    } else {
      await PublicHoliday.seedYear(2025);
      await PublicHoliday.seedYear(2026);
      
      const count = await PublicHoliday.countDocuments();
      console.log(`   ✅ Seeded ${count} holidays for 2025-2026`);
    }
    
    console.log('\n✅ Schedule seed complete!');
    console.log('\nNext steps:');
    console.log('1. Go to Schedule page to manage technician groups');
    console.log('2. Add contractors via the Contractors management');
    console.log('3. Start scheduling technicians to projects');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

seedSchedule();
