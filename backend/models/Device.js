const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'network',
        'security',
        'camera',
        'av',
        'lighting',
        'control-system',
        'audio',
        'video',
        'switch',
        'router',
        'access-point',
        'nvr',
        'other',
      ],
      required: true,
    },
    manufacturer: String,
    model: String,
    serialNumber: String,
    macAddress: String,
    ipAddress: String,
    vlan: Number,
    
    // Credentials
    username: String,
    password: String,
    apiKey: String,
    
    // Location and port info
    location: String,
    rackPosition: String,
    switchPort: Number,
    
    // Technical specs
    specifications: mongoose.Schema.Types.Mixed,
    
    // Documentation
    documentationUrl: String,
    configNotes: String,
    
    // Status
    status: {
      type: String,
      enum: ['not-installed', 'installed', 'configured', 'tested', 'commissioned'],
      default: 'not-installed',
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

deviceSchema.index({ projectId: 1 });
deviceSchema.index({ category: 1 });

module.exports = mongoose.model('Device', deviceSchema);