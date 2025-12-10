const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  // Singleton pattern - only one settings document
  key: { 
    type: String, 
    default: 'global', 
    unique: true 
  },
  
  // Company Branding - using Mixed type for flexibility
  branding: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      companyName: 'Electronic Living',
      companyWebsite: 'www.electronicliving.com.au',
    }
  },
  
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ key: 'global' });
  if (!settings) {
    settings = await this.create({ key: 'global' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
