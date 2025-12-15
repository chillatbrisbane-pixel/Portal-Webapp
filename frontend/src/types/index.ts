export interface User {
  _id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'project-manager' | 'tech' | 'sales' | 'viewer';
  isActive: boolean;
  suspended?: boolean;
  suspendedAt?: string;
  suspendedBy?: { _id: string; name: string; email: string };
  mustChangePassword?: boolean;
  lastLogin?: string;
  lastLoginIP?: string;
  twoFactorEnabled?: boolean;
  createdBy?: { _id: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
  // Invite system
  accountStatus?: 'pending' | 'active';
  inviteTokenExpires?: string;
  // Legacy field for migration
  username?: string;
}

export interface ActivityLog {
  _id: string;
  user: { _id: string; name: string; email: string };
  action: string;
  targetUser?: { _id: string; name: string; email: string };
  targetProject?: { _id: string; name: string };
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ProjectVersion {
  _id: string;
  project: string;
  versionNumber: number;
  snapshot: {
    name: string;
    status: string;
    notes?: string;
    clientName?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;
    technology?: Record<string, boolean>;
    devices?: Array<{ deviceId: string; data: any }>;
    wifiNetworks?: Array<any>;
  };
  createdBy: { _id: string; name: string; email: string };
  changeDescription: string;
  createdAt: string;
}

export interface NoteEntry {
  _id: string;
  text: string;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface Technology {
  network: boolean;
  security: boolean;
  cameras: boolean;
  av: boolean;
  lighting: boolean;
  controlSystem: boolean;
}

export interface VLAN {
  subnet: string;
  gateway: string;
  dhcpStart: string;
  dhcpEnd: string;
  description?: string;
}

export interface NetworkConfig {
  vlan1: VLAN;
  vlan20: VLAN;
  vlan30: VLAN;
}

export interface WiFiNetwork {
  name: string;
  password: string;
  vlan: number;
  band: '2.4GHz' | '5GHz' | '6GHz';
}

export interface SwitchPort {
  portNumber: number;
  description: string;
  assignedDevice: string;
  vlan: number;
  poeEnabled: boolean;
  poeType: '802.3af' | '802.3at' | '802.3bt' | 'none';
}

export interface TeamMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedDate: string;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  address: string;
  state?: string;
  postcode?: string;
  projectManager?: {
    userId?: string;
    name?: string;
    phone?: string;
  };
  siteLead?: {
    userId?: string;
    name?: string;
    phone?: string;
  };
  sharePointLink: string;
  skytunnelLink: string;
  status: 'planning' | 'in-progress' | 'completed';
  startDate: string;
  completionDate: string;
  budget: number;
  estimatedCost: number;
  actualCost: number;
  technologies: Technology;
  networkConfig: NetworkConfig;
  wifiNetworks: WiFiNetwork[];
  switchPorts: SwitchPort[];
  devices: Device[];
  createdBy: User;
  teamMembers: TeamMember[];
  notes: string;
  taskStages?: {
    id: string;
    label: string;
    color: string;
    order: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Device Categories
export type DeviceCategory = 
  | 'network'
  | 'camera'
  | 'security'
  | 'intercom'
  | 'user-interface'
  | 'control-system'
  | 'lighting'
  | 'av'
  | 'power'
  | 'hvac'
  | 'other';

// Device Types
export type DeviceType = 
  // Network
  | 'router' | 'switch' | 'access-point' | 'cloudkey'
  // Camera
  | 'camera' | 'nvr' | 'dvr'
  // Security
  | 'alarm-panel' | 'keypad' | 'door-controller' | 'ekey-reader'
  // Control System
  | 'control-processor' | 'touch-panel' | 'secondary-processor' | 'door-station' | 'remote'
  // Lighting
  | 'lighting-gateway' | 'dali-gateway'
  // AV
  | 'receiver' | 'tv' | 'projector' | 'audio-matrix' | 'video-matrix' | 'amplifier' | 'soundbar' | 'media-player'
  // Power
  | 'pdu' | 'ups' | 'powerboard'
  // HVAC
  | 'hvac-controller'
  // Other
  | 'fan' | 'irrigation' | 'hvac' | 'relay' | 'fireplace' | 'shade' | 'pool' | 'generic';

export interface SSID {
  name: string;
  password: string;
  vlan: number;
  band: '2.4GHz' | '5GHz' | '6GHz' | 'dual' | '';
}

export interface ManagedPort {
  portNumber: number;
  description: string;
  assignedDevice?: string;
  vlan: number;
  poeEnabled: boolean;
}

export interface SecurityZone {
  number: number;
  name: string;
  type: 'entry' | 'perimeter' | 'interior' | 'fire' | '24hr' | '';
}

export interface SecurityOutput {
  number: number;
  name: string;
  type: string;
}

export interface SecurityDoor {
  number: number;
  name: string;
}

export interface AudioZone {
  number: number;
  name: string;
  sourceInput: string;
}

export interface AlarmUser {
  _id?: string;
  name: string;
  code: string;
  accessAreas: string[];
  canArm: boolean;
  canDisarm: boolean;
  isAdmin: boolean;
  webUsername?: string;
  webPassword?: string;
  userGroup?: string;
  isRestApiUser?: boolean;
}

export interface NVRUser {
  _id?: string;
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
  notes: string;
}

export interface SecurityFob {
  _id?: string;
  name: string;
  model: string;
  serialNumber: string;
  permissionGroup: string;
  notes: string;
}

export interface ProxTag {
  _id?: string;
  name: string;
  model: string;
  serialNumber: string;
  facultyCode: string;
  permissionGroup: string;
  notes: string;
}

export interface Airkey {
  _id?: string;
  name: string;
  model: string;
  serialNumber: string;
  buttonConfig: '2' | '4' | '6' | '';
  buttonNotes: string;
  permissionGroup: string;
  notes: string;
}

export interface Device {
  _id: string;
  projectId: string;
  name: string;
  
  // Category and Type
  category: DeviceCategory;
  deviceType: DeviceType;
  
  // Common Fields
  manufacturer: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  ipAddress: string;
  vlan: number;
  firmwareVersion: string;
  
  // Credentials
  username: string;
  password: string;
  apiKey: string;
  hideCredentials: boolean;
  
  // Location and Installation
  location: string;
  room: string;
  rackPosition: string;
  installDate: string;
  
  // Alarm System Specific
  slamCount: number;           // Inception SLAM modules
  inputExpanderCount: number;  // Input expanders
  outputExpanderCount: number; // Output expanders
  readerCount: number;         // Card readers
  partitionCount: number;      // Partitions/areas
  userCodeCount: number;       // User codes (legacy)
  sirenCount: number;          // Sirens
  
  // Alarm Dialler
  diallerInstalled: boolean;
  diallerType: string;
  diallerLocation: string;
  diallerSerial: string;
  diallerAccountNumber: string;
  monitoringCompany: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  
  // Alarm user codes with access permissions
  alarmUsers: AlarmUser[];
  
  // Access control toggles
  hasFobs: boolean;
  hasProxTags: boolean;
  hasAirkeys: boolean;
  
  // Security Fobs
  securityFobs: SecurityFob[];
  
  // Prox Tags
  proxTags: ProxTag[];
  
  // Airkeys
  airkeys: Airkey[];
  
  // NVR extra users
  nvrUsers: NVRUser[];
  
  // Sonos specific
  sonosPin: string;
  networkPath: 'wired' | 'wireless' | '';
  
  // Switch/Port Binding
  switchPort: number;
  boundToSwitch?: string | { _id: string; name: string; portCount?: number; lanPorts?: number };
  boundToNVR?: string | { _id: string; name: string };
  boundToProcessor?: string | { _id: string; name: string };
  irPort: number;
  
  // Connection Type
  connectionType: 'wired' | 'wifi' | 'both' | 'none' | '';
  
  // Network - Router
  lanPorts: number;
  wanPorts: number;
  wanProtocol: 'pppoe' | 'static' | 'dhcp' | '';
  wanIP: string;
  wanGateway: string;
  wanDNS: string;
  
  // Network - UniFi
  unifiSiteName: string;
  
  // Network - Switch
  portCount: 8 | 16 | 24 | 48;
  poeType: 'none' | 'af' | 'at' | 'bt' | '';
  sfpPorts: number;
  managedPorts: ManagedPort[];
  
  // Network - WAP
  channel: string;
  bandwidth: string;
  ssids: SSID[];
  
  // Camera
  resolution: string;
  cameraType: 'dome' | 'bullet' | 'ptz' | 'turret' | 'fisheye' | '';
  inputPorts: number;
  outputPorts: number;
  storageCapacity: string;
  maxChannels: number;
  connectedCameras: string[];
  
  // Security
  panelType: 'inception' | 'paradox' | 'bosch' | 'honeywell' | 'custom' | '';
  skyTunnelLink: string;
  zoneCount: number;
  zones: SecurityZone[];
  outputCount: number;
  outputs: SecurityOutput[];
  doorCount: number;
  doors: SecurityDoor[];
  
  // Control System
  controlBrand: 'control4' | 'crestron' | 'savant' | 'elan' | 'custom' | '';
  irPorts: number;
  ioPorts: number;
  audioPorts: number;
  relayPorts: number;
  serialPorts: number;
  
  // Lighting
  lightingBrand: 'cbus' | 'lutron' | 'control4' | 'crestron' | 'dynalite' | 'custom' | '';
  circuitCount: number;
  dimmable: boolean;
  
  // AV
  controlMethod: 'ir' | 'ip' | 'serial' | 'cec' | 'rs232' | '';
  hdmiInputs: number;
  hdmiOutputs: number;
  audioInputs: number;
  audioOutputs: number;
  zoneConfiguration: 4 | 6 | 8 | 16 | 32 | null;
  audioZones: AudioZone[];
  screenSize: string;
  displayType: 'led' | 'oled' | 'qled' | 'lcd' | 'projector' | '';
  
  // Other
  fanBrand: 'haiku' | 'hunter' | 'custom' | '';
  hvacBrand: 'coolmaster' | 'intesis' | 'custom' | '';
  hvacZones: number;
  relayChannels: number;
  
  // Documentation
  documentationUrl: string;
  configNotes: string;
  specifications: Record<string, any>;
  
  // Status
  status: 'not-installed' | 'installed' | 'configured' | 'tested' | 'commissioned';
  isActive: boolean;
  
  createdAt: string;
  updatedAt: string;
}

// Brand options by category
export const BRAND_OPTIONS = {
  network: {
    router: ['Araknis', 'Pakedge', 'Ubiquiti', 'Cisco', 'Netgear', 'TP-Link', 'Custom'],
    switch: ['Araknis', 'Pakedge', 'Ubiquiti', 'Netgear', 'Cisco', 'TP-Link', 'Custom'],
    'access-point': ['Araknis', 'Pakedge', 'Ubiquiti', 'Ruckus', 'Cisco', 'Custom'],
    cloudkey: ['Ubiquiti', 'Pakedge', 'Araknis', 'Custom'],
  },
  camera: {
    camera: ['Dahua', 'Hikvision', 'Luma', 'Ubiquiti', 'Axis', 'Hanwha', 'Custom'],
    nvr: ['Dahua', 'Hikvision', 'Luma', 'Ubiquiti', 'Custom'],
    dvr: ['Dahua', 'Hikvision', 'Luma', 'Custom'],
  },
  security: {
    'alarm-panel': ['Inner Range (Inception)', 'Paradox', 'Bosch', 'Honeywell', 'Dahua', 'Ajax', 'Custom'],
    keypad: ['Inner Range (Inception)', 'Paradox', 'Bosch', 'Honeywell', 'Ajax', 'Custom'],
    'door-controller': ['Inner Range (Inception)', 'Paradox', 'Custom'],
    'ekey-reader': ['Ekey', 'Custom'],
  },
  intercom: {
    'door-station': ['2N', 'Doorbird', 'Ubiquiti', 'Hikvision', 'Dahua', 'Control4', 'Crestron Home', 'Custom'],
  },
  'user-interface': {
    'touch-panel': ['Control4', 'Crestron Home', 'RTI', 'Custom'],
    'remote': ['Control4', 'Crestron Home', 'RTI', 'Custom'],
  },
  'control-system': {
    'control-processor': ['Control4', 'Crestron Home', 'RTI', 'Custom'],
    'secondary-processor': ['Control4', 'Crestron Home', 'RTI', 'Custom'],
  },
  lighting: {
    'lighting-gateway': ['C-Bus', 'Lutron', 'Control4', 'Crestron', 'Dynalite', 'Custom'],
    'dali-gateway': ['Helvar', 'Tridonic', 'Philips', 'Osram', 'Custom'],
  },
  av: {
    receiver: ['Denon', 'Marantz', 'Yamaha', 'Integra', 'Anthem', 'Trinnov', 'Sony', 'Custom'],
    tv: ['Samsung', 'LG', 'Sony', 'TCL', 'Custom'],
    projector: ['Sony', 'JVC', 'Epson', 'BenQ', 'Optoma', 'Custom'],
    'audio-matrix': ['Sonance', 'Sonos', 'Control4', 'Crestron', 'Russound', 'Autonomic', 'Anthem', 'Episode', 'Pulse Eight', 'Triad', 'Custom'],
    'video-matrix': ['Crestron', 'Atlona', 'Just Add Power', 'Binary', 'AVPro Edge', 'Pulse Eight', 'Custom'],
    amplifier: ['Sonance', 'Origin Acoustics', 'Control4', 'Rotel', 'Triad', 'Anthem', 'Episode', 'Crown', 'Custom'],
    soundbar: ['Sonos', 'Samsung', 'LG', 'Bose', 'Custom'],
    'media-player': ['Apple TV', 'Nvidia Shield', 'Roku', 'Amazon Fire', 'Custom'],
  },
  power: {
    pdu: ['Pakedge', 'Wattbox', 'APC', 'CyberPower', 'Tripp Lite', 'Panamax', 'Custom'],
    ups: ['Wattbox', 'APC', 'CyberPower', 'Tripp Lite', 'Custom'],
    powerboard: ['HPM', 'Clipsal', 'Belkin', 'Custom'],
  },
  hvac: {
    'hvac-controller': ['Coolmaster', 'Intesis', 'Daikin', 'Mitsubishi', 'Fujitsu', 'ActronAir', 'Custom'],
  },
  other: {
    fan: ['Haiku', 'Hunter', 'Custom'],
    hvac: ['Coolmaster', 'Intesis', 'Custom'],
    relay: ['ControlByWeb', 'Custom'],
  }
};

// Device type options by category
export const DEVICE_TYPE_OPTIONS: Record<DeviceCategory, { value: DeviceType; label: string }[]> = {
  network: [
    { value: 'router', label: '🌐 Router' },
    { value: 'switch', label: '🔀 Switch' },
    { value: 'access-point', label: '📡 Wireless Access Point' },
    { value: 'cloudkey', label: '☁️ Cloudkey / Controller' },
  ],
  camera: [
    { value: 'camera', label: '📹 Camera' },
    { value: 'nvr', label: '💾 NVR' },
  ],
  security: [
    { value: 'alarm-panel', label: '🚨 Alarm Panel' },
    { value: 'keypad', label: '🔢 Keypad' },
    { value: 'door-controller', label: '🚪 Door Controller' },
    { value: 'ekey-reader', label: '👆 Ekey Fingerprint Reader' },
  ],
  intercom: [
    { value: 'door-station', label: '🔔 Door Station' },
  ],
  'user-interface': [
    { value: 'touch-panel', label: '📱 Touch Panel' },
    { value: 'remote', label: '🎮 Hand Held Remote' },
  ],
  'control-system': [
    { value: 'control-processor', label: '🖥️ Main Processor' },
    { value: 'secondary-processor', label: '🔧 Secondary Processor' },
  ],
  lighting: [
    { value: 'lighting-gateway', label: '💡 Lighting Gateway' },
    { value: 'dali-gateway', label: '🔌 DALI Gateway' },
  ],
  av: [
    { value: 'receiver', label: '🔊 AV Receiver' },
    { value: 'tv', label: '📺 TV/Display' },
    { value: 'projector', label: '🎬 Projector' },
    { value: 'audio-matrix', label: '🎵 Audio Matrix/Multiroom' },
    { value: 'video-matrix', label: '🖥️ Video Matrix/Distribution' },
    { value: 'amplifier', label: '🔈 Amplifier' },
    { value: 'soundbar', label: '🔉 Soundbar' },
    { value: 'media-player', label: '▶️ Media Player' },
  ],
  power: [
    { value: 'pdu', label: '🔌 Power Distribution Unit (PDU)' },
    { value: 'ups', label: '🔋 UPS / Battery Backup' },
    { value: 'powerboard', label: '🔌 Powerboard / Power Strip' },
  ],
  hvac: [
    { value: 'hvac-controller', label: '❄️ HVAC Controller' },
  ],
  other: [
    { value: 'fan', label: '🌀 Smart Fan' },
    { value: 'irrigation', label: '💧 Irrigation Controller' },
    { value: 'hvac', label: '❄️ HVAC Controller' },
    { value: 'relay', label: '⚡ Relay' },
    { value: 'fireplace', label: '🔥 Fireplace' },
    { value: 'shade', label: '🪟 Shade/Blind' },
    { value: 'pool', label: '🏊 Pool Controller' },
    { value: 'generic', label: '📦 Other Device' },
  ],
};

// Device connection type configuration
// Defines available connection options and defaults for each device type
export const DEVICE_CONNECTION_CONFIG: Record<string, {
  options: ('wired' | 'wifi' | 'both' | 'none')[];
  default: 'wired' | 'wifi' | 'both' | 'none';
  requiresSwitch: boolean; // Whether this device type typically needs switch binding
}> = {
  // Network devices - always wired
  'router': { options: ['wired'], default: 'wired', requiresSwitch: false },
  'switch': { options: ['wired'], default: 'wired', requiresSwitch: false },
  'access-point': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'cloudkey': { options: ['wired'], default: 'wired', requiresSwitch: true },
  
  // Cameras - mostly wired (PoE) but some WiFi
  'camera': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'nvr': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'dvr': { options: ['wired'], default: 'wired', requiresSwitch: true },
  
  // Security - mostly wired
  'alarm-panel': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'keypad': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: false },
  'door-controller': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'ekey-reader': { options: ['wired'], default: 'wired', requiresSwitch: true },
  
  // Control - wired
  'control-processor': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'touch-panel': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'secondary-processor': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'door-station': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'remote': { options: ['wifi', 'none'], default: 'wifi', requiresSwitch: false },
  
  // Lighting - wired
  'lighting-processor': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'dimmer': { options: ['wired', 'none'], default: 'none', requiresSwitch: false },
  'relay-pack': { options: ['wired', 'none'], default: 'none', requiresSwitch: false },
  'lighting-gateway': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'dali-gateway': { options: ['wired'], default: 'wired', requiresSwitch: true },
  
  // AV - mostly wired
  'receiver': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'tv': { options: ['wired', 'wifi', 'both'], default: 'wired', requiresSwitch: true },
  'projector': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'audio-matrix': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'video-matrix': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'amplifier': { options: ['wired', 'none'], default: 'wired', requiresSwitch: true },
  'soundbar': { options: ['wired', 'wifi', 'both'], default: 'wifi', requiresSwitch: false },
  'media-player': { options: ['wired', 'wifi', 'both'], default: 'wired', requiresSwitch: true },
  
  // Other - varies
  'fan': { options: ['wifi'], default: 'wifi', requiresSwitch: false },
  'irrigation': { options: ['wired', 'wifi'], default: 'wifi', requiresSwitch: false },
  'hvac': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'relay': { options: ['wired'], default: 'wired', requiresSwitch: true },
  'fireplace': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: false },
  'shade': { options: ['wired', 'wifi', 'none'], default: 'wired', requiresSwitch: false },
  'pool': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'generic': { options: ['wired', 'wifi', 'both', 'none'], default: 'wired', requiresSwitch: true },
  
  // Power devices
  'pdu': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
  'ups': { options: ['wired', 'wifi', 'none'], default: 'wired', requiresSwitch: true },
  'powerboard': { options: ['none'], default: 'none', requiresSwitch: false },
  
  // HVAC
  'hvac-controller': { options: ['wired', 'wifi'], default: 'wired', requiresSwitch: true },
};

// Helper to get connection config for a device type
export const getDeviceConnectionConfig = (deviceType: string) => {
  return DEVICE_CONNECTION_CONFIG[deviceType] || DEVICE_CONNECTION_CONFIG['generic'];
};

export interface Manufacturer {
  id: number;
  name: string;
  category: string;
  website: string;
}

export interface DeviceTemplate {
  id: number;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  specifications: Record<string, any>;
}
