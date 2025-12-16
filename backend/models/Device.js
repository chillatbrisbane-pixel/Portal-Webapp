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
        'intercom',
        'user-interface',
        'control-system',
        'lighting',
        'av',
        'power',
        'hvac',
        'other'
      ],
      required: true,
    },
    deviceType: {
      type: String,
      enum: [
        // Network
        'router', 'switch', 'access-point', 'cloudkey',
        // Camera
        'camera', 'nvr', 'dvr',
        // Security
        'alarm-panel', 'keypad', 'door-controller', 'ekey-reader',
        // Intercom
        'door-station',
        // User Interface
        'touch-panel', 'remote',
        // Control System
        'control-processor', 'secondary-processor',
        // Lighting
        'lighting-gateway', 'dali-gateway',
        // AV
        'receiver', 'tv', 'projector', 'audio-matrix', 'video-matrix', 'amplifier', 'soundbar', 'media-player',
        // Power
        'pdu', 'ups', 'powerboard',
        // HVAC
        'hvac-controller',
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
    
    // Alarm panel backup file
    alarmBackupFile: {
      filename: String,           // Original filename
      data: String,               // Base64 encoded file data
      uploadedAt: Date,           // When the backup was uploaded
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fileSize: Number,           // Size in bytes
    },
    
    // Alarm dialler fields
    diallerInstalled: { type: Boolean, default: false },
    diallerType: String,         // T4000, Permaconn, Custom
    diallerLocation: String,
    diallerSerial: String,
    diallerAccountNumber: String,  // Monitoring account number
    
    // Monitoring company details
    monitoringCompany: {
      name: String,
      phone: String,
      email: String,
      address: String,
    },
    
    // Alarm user codes with access permissions
    alarmUsers: [{
      name: String,
      code: String,
      accessAreas: [String], // Which areas/partitions they can access
      canArm: { type: Boolean, default: true },
      canDisarm: { type: Boolean, default: true },
      isAdmin: { type: Boolean, default: false },
      // Web login credentials
      webUsername: String,
      webPassword: String,
      // User group and API access
      userGroup: String,
      isRestApiUser: { type: Boolean, default: false },
    }],
    
    // Access control toggles
    hasFobs: { type: Boolean, default: false },
    hasProxTags: { type: Boolean, default: false },
    hasAirkeys: { type: Boolean, default: false },
    
    // Security Fobs
    securityFobs: [{
      name: String,
      model: String,
      serialNumber: String,
      permissionGroup: String,
      notes: String,
    }],
    
    // Prox Tags
    proxTags: [{
      name: String,
      model: String,
      serialNumber: String,
      facultyCode: String,
      permissionGroup: String,
      notes: String,
    }],
    
    // Airkeys
    airkeys: [{
      name: String,
      model: String,
      serialNumber: String,
      buttonConfig: { type: String, enum: ['2', '4', '6', ''], default: '' },
      buttonNotes: String,
      permissionGroup: String,
      notes: String,
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
    
    // ============ CONTROL4 TEMP LOGIN ============
    control4TempUser: String,
    control4TempPass: String,
    control4AccountName: String,
    
    // ============ ARAKNIS / OVRC ============
    ovrcAccountName: String,
    localAdminUser: String,
    localAdminPass: String,
    
    // ============ AUDIO MATRIX / MULTIROOM AMP ============
    audioInputCount: { type: Number, default: 0 },
    audioOutputCount: { type: Number, default: 0 },
    isAmplified: { type: Boolean, default: false },
    audioInputNames: String,    // Newline-separated list
    audioOutputNames: String,   // Newline-separated list
    
    // ============ ROUTER DDNS ============
    ddnsProvider: String,
    ddnsHostname: String,
    
    // ============ ROUTER VLANS ============
    vlan20Enabled: { type: Boolean, default: false },
    vlan20Subnet: String,
    vlan20DhcpStart: String,
    vlan20DhcpEnd: String,
    vlan30Enabled: { type: Boolean, default: false },
    vlan30Subnet: String,
    vlan30DhcpStart: String,
    vlan30DhcpEnd: String,
    
    // ============ ROUTER VPN ============
    vpnServerMode: String,
    vpnDdnsAddress: String,
    vpnSubnet: String,
    vpnNetmask: String,
    vpnClientName: String,
    
    // ============ DYNALITE LIGHTING ============
    dynalitePdegPort: Number,
    dynaliteControlPort: Number,
    
    // ============ HVAC CONTROL ============
    hvacUnitCount: { type: Number, default: 0 },
    hvacUnitLocations: String,   // Newline-separated list
    hvacUnitBrands: String,      // Newline-separated list
    hvacUnitModels: String,      // Newline-separated list
    hvacUnitIPs: String,         // Newline-separated list
    
    // ============ PDU PORTS ============
    pduPortCount: { type: Number, default: 8 },
    pduPortNames: String,        // Newline-separated list
    
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
    
    // UniFi specific
    unifiSiteName: String,
    
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
      enum: ['inception', 'paradox', 'bosch', 'honeywell', 'ajax', 'dahua', 'hikvision', 'custom', '']
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
