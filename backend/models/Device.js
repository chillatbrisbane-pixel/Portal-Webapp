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
    
    // Category and Type
    category: {
      type: String,
      enum: [
        'network',
        'camera',
        'security',
        'control-system',
        'lighting',
        'av',
        'other'
      ],
      required: true,
    },
    deviceType: {
      type: String,
      enum: [
        // Network
        'router', 'switch', 'access-point',
        // Camera
        'camera', 'nvr', 'dvr',
        // Security
        'alarm-panel', 'keypad', 'door-controller',
        // Control System
        'control-processor', 'touch-panel', 'secondary-processor', 'door-station', 'remote',
        // Lighting
        'lighting-gateway', 'dali-gateway',
        // AV
        'receiver', 'tv', 'projector', 'audio-matrix', 'video-matrix', 'amplifier', 'soundbar', 'media-player',
        // Other
        'fan', 'irrigation', 'hvac', 'relay', 'fireplace', 'shade', 'pool', 'generic'
      ],
      default: 'generic'
    },
    
    // Common Fields
    manufacturer: String,
    model: String,
    serialNumber: String,
    macAddress: String,
    ipAddress: String,
    vlan: { type: Number, default: 1 },
    firmwareVersion: String,
    
    // Credentials
    username: String,
    password: String,
    apiKey: String,
    hideCredentials: { type: Boolean, default: false }, // For Unifi devices
    
    // Location and Installation
    location: String,
    room: String,
    rackPosition: String,
    installDate: Date,
    
    // ============ ALARM SYSTEM SPECIFIC ============
    // Inception specific
    slamCount: { type: Number, default: 0 },        // Number of SLAM modules
    inputExpanderCount: { type: Number, default: 0 }, // Input expanders
    outputExpanderCount: { type: Number, default: 0 }, // Output expanders
    readerCount: { type: Number, default: 0 },      // Card readers
    // General alarm
    partitionCount: { type: Number, default: 1 },   // Number of partitions/areas
    userCodeCount: { type: Number, default: 0 },    // Number of user codes (legacy)
    sirenCount: { type: Number, default: 0 },       // Internal/external sirens
    
    // Alarm user codes with access permissions
    alarmUsers: [{
      name: String,
      code: String,
      accessAreas: [String], // Which areas/partitions they can access
      canArm: { type: Boolean, default: true },
      canDisarm: { type: Boolean, default: true },
      isAdmin: { type: Boolean, default: false },
    }],
    
    // ============ NVR SPECIFIC ============
    // Extra NVR users (beyond main credentials)
    nvrUsers: [{
      username: String,
      password: String,
      role: { type: String, enum: ['admin', 'operator', 'viewer'], default: 'viewer' },
      notes: String,
    }],
    
    // ============ SONOS SPECIFIC ============
    sonosPin: String,           // Sonos setup PIN
    networkPath: {              // For Sonos devices
      type: String,
      enum: ['wired', 'wireless', ''],
      default: ''
    },
    
    // Switch/Port Binding
    switchPort: Number,
    boundToSwitch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    },
    
    // NVR Binding (for cameras)
    boundToNVR: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    },
    
    // Control Processor Binding (for IR devices)
    boundToProcessor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    },
    irPort: Number,
    
    // Connection Type
    connectionType: {
      type: String,
      enum: ['wired', 'wifi', 'both', 'none', ''],
      default: 'wired'
    },
    
    // ============ NETWORK-SPECIFIC FIELDS ============
    
    // Router specific
    lanPorts: { type: Number, min: 1, max: 48 },
    wanPorts: { type: Number, min: 1, max: 4 },
    wanProtocol: {
      type: String,
      enum: ['pppoe', 'static', 'dhcp', '']
    },
    wanIP: String,
    wanGateway: String,
    wanDNS: String,
    
    // Switch specific
    portCount: {
      type: Number,
      enum: [8, 16, 24, 48]
    },
    poeType: {
      type: String,
      enum: ['none', 'af', 'at', 'bt', ''] // 802.3af, 802.3at (PoE+), 802.3bt (PoE++)
    },
    sfpPorts: Number,
    managedPorts: [{
      portNumber: Number,
      description: String,
      assignedDevice: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
      vlan: Number,
      poeEnabled: Boolean
    }],
    
    // WAP specific
    channel: String,
    bandwidth: String,
    ssids: [{
      name: String,
      password: String,
      vlan: Number,
      band: { type: String, enum: ['2.4GHz', '5GHz', '6GHz', 'dual', ''] }
    }],
    
    // ============ CAMERA-SPECIFIC FIELDS ============
    
    resolution: String,
    cameraType: {
      type: String,
      enum: ['dome', 'bullet', 'ptz', 'turret', 'fisheye', '']
    },
    inputPorts: Number,
    outputPorts: Number,
    storageCapacity: String, // For NVR
    maxChannels: Number, // For NVR
    connectedCameras: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    }],
    
    // ============ SECURITY-SPECIFIC FIELDS ============
    
    // Security Panel
    panelType: {
      type: String,
      enum: ['inception', 'paradox', 'bosch', 'honeywell', 'custom', '']
    },
    skyTunnelLink: String, // Auto-generated for Inner Range Inception
    zoneCount: Number,
    zones: [{
      number: Number,
      name: String,
      type: { type: String, enum: ['entry', 'perimeter', 'interior', 'fire', '24hr', ''] }
    }],
    outputCount: Number,
    outputs: [{
      number: Number,
      name: String,
      type: { type: String }
    }],
    doorCount: Number,
    doors: [{
      number: Number,
      name: String
    }],
    
    // ============ CONTROL SYSTEM-SPECIFIC FIELDS ============
    
    controlBrand: {
      type: String,
      enum: ['control4', 'crestron', 'savant', 'elan', 'custom', '']
    },
    irPorts: Number,
    ioPorts: Number,
    audioPorts: Number,
    relayPorts: Number,
    serialPorts: Number,
    
    // ============ LIGHTING-SPECIFIC FIELDS ============
    
    lightingBrand: {
      type: String,
      enum: ['cbus', 'lutron', 'control4', 'crestron', 'dynalite', 'custom', '']
    },
    circuitCount: Number,
    dimmable: Boolean,
    
    // ============ AV-SPECIFIC FIELDS ============
    
    controlMethod: {
      type: String,
      enum: ['ir', 'ip', 'serial', 'cec', 'rs232', '']
    },
    hdmiInputs: Number,
    hdmiOutputs: Number,
    audioInputs: Number,
    audioOutputs: Number,
    
    // Multi-Zone Amp specific
    zoneConfiguration: {
      type: Number,
      enum: [4, 6, 8, 16, 32, null]
    },
    audioZones: [{
      number: Number,
      name: String,
      sourceInput: String
    }],
    
    // Display specific
    screenSize: String,
    displayType: {
      type: String,
      enum: ['led', 'oled', 'qled', 'lcd', 'projector', '']
    },
    
    // ============ OTHER DEVICE FIELDS ============
    
    // Fan (Haiku)
    fanBrand: {
      type: String,
      enum: ['haiku', 'hunter', 'custom', '']
    },
    
    // HVAC
    hvacBrand: {
      type: String,
      enum: ['coolmaster', 'intesis', 'custom', '']
    },
    hvacZones: Number,
    
    // Relay
    relayChannels: Number,
    
    // ============ DOCUMENTATION & NOTES ============
    
    documentationUrl: String,
    configNotes: String,
    specifications: mongoose.Schema.Types.Mixed,
    
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

// Indexes
deviceSchema.index({ projectId: 1 });
deviceSchema.index({ category: 1 });
deviceSchema.index({ deviceType: 1 });
deviceSchema.index({ ipAddress: 1 });

// Pre-save hook for auto-generating skyTunnelLink
deviceSchema.pre('save', function(next) {
  if (this.category === 'security' && this.panelType === 'inception' && this.serialNumber) {
    this.skyTunnelLink = `https://skytunnel.com.au/inception/${this.serialNumber}`;
  }
  next();
});

module.exports = mongoose.model('Device', deviceSchema);
