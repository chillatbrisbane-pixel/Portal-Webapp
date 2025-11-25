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
  status: 'planning' | 'in-progress' | 'on-hold' | 'completed' | 'archived';
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

export interface Device {
  _id: string;
  projectId: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  ipAddress: string;
  vlan: number;
  username: string;
  password: string;
  apiKey: string;
  location: string;
  rackPosition: string;
  switchPort: number;
  status: 'not-installed' | 'installed' | 'configured' | 'tested' | 'commissioned';
  configNotes: string;
  createdAt: string;
  updatedAt: string;
}

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