const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    clientName: {
      type: String,
      trim: true,
    },
    clientEmail: {
      type: String,
      trim: true,
    },
    clientPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    sharePointLink: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planning', 'in-progress', 'completed'],
      default: 'planning',
    },
    startDate: Date,
    completionDate: Date,
    budget: Number,
    estimatedCost: Number,
    actualCost: Number,
    
    // Technologies selected from setup wizard
    technologies: {
      network: { type: Boolean, default: false },
      security: { type: Boolean, default: false },
      cameras: { type: Boolean, default: false },
      av: { type: Boolean, default: false },
      lighting: { type: Boolean, default: false },
      controlSystem: { type: Boolean, default: false },
    },

    // Network configuration
    networkConfig: {
      vlan1: {
        subnet: { type: String, default: '192.168.210.0/24' },
        gateway: { type: String, default: '192.168.210.1' },
        dhcpStart: { type: String, default: '192.168.210.100' },
        dhcpEnd: { type: String, default: '192.168.210.200' },
      },
      vlan20: {
        subnet: { type: String, default: '192.168.220.0/24' },
        gateway: { type: String, default: '192.168.220.1' },
        dhcpStart: { type: String, default: '192.168.220.100' },
        dhcpEnd: { type: String, default: '192.168.220.200' },
        description: { type: String, default: 'Cameras' },
      },
      vlan30: {
        subnet: { type: String, default: '192.168.230.0/24' },
        gateway: { type: String, default: '192.168.230.1' },
        dhcpStart: { type: String, default: '192.168.230.100' },
        dhcpEnd: { type: String, default: '192.168.230.200' },
       description: { type: String, default: 'Guest Network' },
      },
    },

    // Devices and equipment
    devices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],

    // WiFi networks
    wifiNetworks: [
      {
        name: String,
        password: String,
        vlan: Number,
        band: { type: String, enum: ['2.4GHz', '5GHz', '6GHz', 'Dual'], default: '5GHz' },
      },
    ],

    // Switch ports
    switchPorts: [
      {
        portNumber: Number,
        description: String,
        assignedDevice: String,
        vlan: Number,
        poeEnabled: Boolean,
        poeType: { type: String, enum: ['802.3af', '802.3at', '802.3bt', 'none'], default: 'none' },
      },
    ],

    // Team access
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    teamMembers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
        addedDate: { type: Date, default: Date.now },
      },
    ],

    // Notes and documentation
    notes: String, // Legacy field - kept for backwards compatibility
    
    // Timestamped note entries
    noteEntries: [{
      text: { type: String, required: true },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      createdAt: { type: Date, default: Date.now },
    }],
    
    // Project handover document
    handoverDocument: {
      generatedDate: Date,
      html: String,
    },
  },
  { timestamps: true }
);

// Index for team-based queries
projectSchema.index({ createdBy: 1 });
projectSchema.index({ 'teamMembers.userId': 1 });

module.exports = mongoose.model('Project', projectSchema);