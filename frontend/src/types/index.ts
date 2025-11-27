export interface User {
  _id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'technician';
  isActive: boolean;
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
  createdAt: string;
  updatedAt: string;
}

// Device Categories
export type DeviceCategory = 
  | 'network'
  | 'camera'
  | 'security'
  | 'control-system'
  | 'lighting'
  | 'av'
  | 'other';

// Device Types
export type DeviceType = 
  // Network
  | 'router' | 'switch' | 'access-point'
  // Camera
  | 'camera' | 'nvr' | 'dvr'
  // Security
  | 'alarm-panel' | 'keypad' | 'door-controller'
  // Control System
  | 'control-processor' | 'touch-panel' | 'secondary-processor' | 'door-station' | 'remote'
  // Lighting
  | 'lighting-gateway' | 'dimmer' | 'relay-pack'
  // AV
  | 'receiver' | 'tv' | 'projector' | 'audio-matrix' | 'amplifier' | 'soundbar' | 'media-player'
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
  
  // Switch/Port Binding
  switchPort: number;
  boundToSwitch?: string | { _id: string; name: string };
  boundToNVR?: string | { _id: string; name: string };
  boundToProcessor?: string | { _id: string; name: string };
  irPort: number;
  
  // Network - Router
  lanPorts: number;
  wanPorts: number;
  wanProtocol: 'pppoe' | 'static' | 'dhcp' | '';
  wanIP: string;
  wanGateway: string;
  wanDNS: string;
  
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
    router: ['Araknis', 'Ubiquiti', 'Cisco', 'Netgear', 'TP-Link', 'Custom'],
    switch: ['Araknis', 'Ubiquiti', 'Netgear', 'Cisco', 'TP-Link', 'Custom'],
    'access-point': ['Araknis', 'Ubiquiti', 'Ruckus', 'Cisco', 'Custom'],
  },
  camera: {
    camera: ['Dahua', 'Hikvision', 'Luma', 'Axis', 'Hanwha', 'Custom'],
    nvr: ['Dahua', 'Hikvision', 'Luma', 'Custom'],
  },
  security: {
    'alarm-panel': ['Inner Range (Inception)', 'Paradox', 'Bosch', 'Honeywell', 'Custom'],
  },
  'control-system': {
    'control-processor': ['Control4', 'Crestron', 'Savant', 'Elan', 'Custom'],
    'touch-panel': ['Control4', 'Crestron', 'Savant', 'Custom'],
  },
  lighting: {
    'lighting-gateway': ['C-Bus', 'Lutron', 'Control4', 'Crestron', 'Dynalite', 'Custom'],
  },
  av: {
    receiver: ['Denon', 'Marantz', 'Yamaha', 'Sony', 'Anthem', 'Custom'],
    tv: ['Samsung', 'LG', 'Sony', 'TCL', 'Custom'],
    'audio-matrix': ['Sonance', 'Sonos', 'Control4', 'Russound', 'Custom'],
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
  ],
  camera: [
    { value: 'camera', label: '📹 Camera' },
    { value: 'nvr', label: '💾 NVR' },
    { value: 'dvr', label: '📼 DVR' },
  ],
  security: [
    { value: 'alarm-panel', label: '🚨 Alarm Panel' },
    { value: 'keypad', label: '🔢 Keypad' },
    { value: 'door-controller', label: '🚪 Door Controller' },
  ],
  'control-system': [
    { value: 'control-processor', label: '🖥️ Main Processor' },
    { value: 'touch-panel', label: '📱 Touch Panel' },
    { value: 'secondary-processor', label: '🔧 Secondary Processor' },
    { value: 'door-station', label: '🔔 Door Station' },
    { value: 'remote', label: '🎮 Remote' },
  ],
  lighting: [
    { value: 'lighting-gateway', label: '💡 Lighting Gateway' },
    { value: 'dimmer', label: '🔆 Dimmer' },
    { value: 'relay-pack', label: '⚡ Relay Pack' },
  ],
  av: [
    { value: 'receiver', label: '🔊 AV Receiver' },
    { value: 'tv', label: '📺 TV/Display' },
    { value: 'projector', label: '🎬 Projector' },
    { value: 'audio-matrix', label: '🎚️ Audio Matrix/Multi-Zone Amp' },
    { value: 'amplifier', label: '🔈 Amplifier' },
    { value: 'soundbar', label: '🔉 Soundbar' },
    { value: 'media-player', label: '▶️ Media Player' },
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
