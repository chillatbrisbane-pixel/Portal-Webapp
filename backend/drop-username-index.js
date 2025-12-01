/**
 * Migration Script: Drop old username index
 * 
 * Run this ONCE after deploying the new auth system to remove
 * the unique constraint on the username field.
 * 
 * Usage: node drop-username-index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const dropUsernameIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/av-project-manager', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // List current indexes
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop username index if it exists
    const usernameIndex = indexes.find(i => i.name === 'username_1');
    if (usernameIndex) {
      await usersCollection.dropIndex('username_1');
      console.log('✅ Dropped username_1 index successfully!');
    } else {
      console.log('ℹ️  username_1 index does not exist, nothing to drop.');
    }

    // List indexes after
    const indexesAfter = await usersCollection.indexes();
    console.log('Indexes after:', indexesAfter.map(i => i.name));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

dropUsernameIndex();
