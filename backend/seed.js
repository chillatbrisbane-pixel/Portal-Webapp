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

    // Create default users
    const defaultUsers = [
      {
        username: 'admin',
        password: 'admin123',
        name: 'Administrator',
        email: 'admin@company.com',
        role: 'admin',
        isActive: true,
      },
      {
        username: 'manager',
        password: 'manager123',
        name: 'Project Manager',
        email: 'manager@company.com',
        role: 'manager',
        isActive: true,
      },
      {
        username: 'tech',
        password: 'tech123',
        name: 'Field Technician',
        email: 'tech@company.com',
        role: 'technician',
        isActive: true,
      },
    ];

    for (const userData of defaultUsers) {
  await User.create(userData);
}

    console.log('✅ Default users created successfully!');
    console.log('\n📋 Default Credentials:');
    console.log('─────────────────────────────────────');
    console.log('Admin:       admin / admin123');
    console.log('Manager:     manager / manager123');
    console.log('Technician:  tech / tech123');
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();