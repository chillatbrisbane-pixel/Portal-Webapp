require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/av-project-manager', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if users exist
    const userCount = await User.countDocuments();

    if (userCount > 0) {
      console.log('✅ Users already exist, skipping seed');
      process.exit(0);
    }

    // Create default admin user only
    // This user MUST change their password and set email on first login
    const defaultAdmin = {
      username: 'admin', // Legacy username for initial login
      email: 'admin@setup.local', // Temporary email - will be changed on first login
      password: 'admin123',
      name: 'Administrator',
      role: 'admin',
      isActive: true,
      mustChangePassword: true, // Force password change on first login
    };

    await User.create(defaultAdmin);

    console.log('✅ Default admin user created successfully!');
    console.log('\n📋 Default Admin Credentials:');
    console.log('─────────────────────────────────────');
    console.log('Login:     admin');
    console.log('Password:  admin123');
    console.log('─────────────────────────────────────');
    console.log('\n⚠️  You will be required to set your email and');
    console.log('   change your password on first login.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();