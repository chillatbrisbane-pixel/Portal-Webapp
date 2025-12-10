const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  // Singleton pattern - only one settings document
  key: { 
    type: String, 
    default: 'global', 
    unique: true 
  },
  
  // Company Branding
  branding: {
    // Logo for PDF cover page (base64 encoded)
    logo: {
      data: String,        // base64 data
      mimeType: String,    // image/png, image/jpeg
      filename: String,    // original filename
    },
    
    // Background watermark image (base64 encoded)
    background: {
      data: String,        // base64 data
      mimeType: String,    // image/png, image/jpeg
      filename: String,    // original filename
      opacity: { type: Number, default: 0.1 },  // 0-1, default 10%
    },
    
    // Company details for PDF
    companyName: { type: String, default: 'Electronic Living' },
    companyWebsite: { type: String, default: 'www.electronicliving.com.au' },
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
