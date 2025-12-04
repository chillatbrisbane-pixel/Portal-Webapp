// IP Assignment Logic based on device category and type
// Follows the spec's IP allocation scheme

const IP_CONFIG = {
  // Networking - VLAN 1 (192.168.210.x)
  router: {
    vlan: 1,
    defaultIP: '192.168.210.1',
    range: { start: 1, end: 10 },
    subnet: '192.168.210'
  },
  switch: {
    vlan: 1,
    defaultIP: '192.168.210.251',
    range: { start: 240, end: 254 },
    subnet: '192.168.210'
  },
  'access-point': {
    vlan: 1,
    defaultIP: '192.168.210.11',
    range: { start: 11, end: 30 },
    subnet: '192.168.210'
  },
  
  // Security Cameras - VLAN 20 (192.168.220.x)
  camera: {
    vlan: 20,
    defaultIP: '192.168.220.131',
    range: { start: 131, end: 200 },
    subnet: '192.168.220'
  },
  nvr: {
    vlan: 20,
    defaultIP: '192.168.220.81',
    range: { start: 81, end: 90 },
    subnet: '192.168.220'
  },
  
  // Security System - VLAN 1
  security: {
    vlan: 1,
    defaultIP: '192.168.210.80',
    range: { start: 80, end: 89 },
    subnet: '192.168.210'
  },
  
  // Control System - VLAN 1
  'control-processor': {
    vlan: 1,
    defaultIP: '192.168.210.100',
    range: { start: 100, end: 100 },
    subnet: '192.168.210'
  },
  'touch-panel': {
    vlan: 1,
    defaultIP: '192.168.210.101',
    range: { start: 101, end: 120 },
    subnet: '192.168.210'
  },
  'secondary-processor': {
    vlan: 1,
    defaultIP: '192.168.210.91',
    range: { start: 91, end: 99 },
    subnet: '192.168.210'
  },
  'door-station': {
    vlan: 1,
    defaultIP: '192.168.210.121',
    range: { start: 121, end: 130 },
    subnet: '192.168.210'
  },
  
  // Lighting - VLAN 1
  lighting: {
    vlan: 1,
    defaultIP: '192.168.210.250',
    range: { start: 248, end: 250 },
    subnet: '192.168.210'
  },
  
  // AV System - VLAN 1
  receiver: {
    vlan: 1,
    defaultIP: '192.168.210.71',
    range: { start: 71, end: 79 },
    subnet: '192.168.210'
  },
  tv: {
    vlan: 1,
    defaultIP: '192.168.210.41',
    range: { start: 41, end: 50 },
    subnet: '192.168.210'
  },
  'audio-matrix': {
    vlan: 1,
    defaultIP: '192.168.210.21',
    range: { start: 21, end: 30 },
    subnet: '192.168.210'
  },
  
  // Other Smart Devices - VLAN 1
  fan: {
    vlan: 1,
    defaultIP: '192.168.210.31',
    range: { start: 31, end: 40 },
    subnet: '192.168.210'
  },
  irrigation: {
    vlan: 1,
    defaultIP: '192.168.210.110',
    range: { start: 110, end: 119 },
    subnet: '192.168.210'
  },
  hvac: {
    vlan: 1,
    defaultIP: '192.168.210.30',
    range: { start: 30, end: 30 },
    subnet: '192.168.210'
  },
  relay: {
    vlan: 1,
    defaultIP: '192.168.210.51',
    range: { start: 51, end: 60 },
    subnet: '192.168.210'
  },
  fireplace: {
    vlan: 1,
    defaultIP: '192.168.210.55',
    range: { start: 55, end: 70 },
    subnet: '192.168.210'
  },
  
  // Power - VLAN 1
  pdu: {
    vlan: 1,
    defaultIP: '192.168.210.5',
    range: { start: 5, end: 10 },
    subnet: '192.168.210'
  },
  ups: {
    vlan: 1,
    defaultIP: '192.168.210.5',
    range: { start: 5, end: 10 },
    subnet: '192.168.210'
  },
  
  // Network Controllers
  cloudkey: {
    vlan: 1,
    defaultIP: '192.168.210.2',
    range: { start: 2, end: 4 },
    subnet: '192.168.210'
  },
  
  // Generic categories
  network: {
    vlan: 1,
    defaultIP: '192.168.210.200',
    range: { start: 200, end: 220 },
    subnet: '192.168.210'
  },
  av: {
    vlan: 1,
    defaultIP: '192.168.210.41',
    range: { start: 41, end: 70 },
    subnet: '192.168.210'
  },
  'control-system': {
    vlan: 1,
    defaultIP: '192.168.210.100',
    range: { start: 91, end: 130 },
    subnet: '192.168.210'
  },
  other: {
    vlan: 1,
    defaultIP: '192.168.210.200',
    range: { start: 200, end: 230 },
    subnet: '192.168.210'
  }
};

// Get config for a device type/category
function getIPConfig(deviceType, category) {
  // First check specific device type
  if (IP_CONFIG[deviceType]) {
    return IP_CONFIG[deviceType];
  }
  // Fall back to category
  if (IP_CONFIG[category]) {
    return IP_CONFIG[category];
  }
  // Default fallback
  return IP_CONFIG.other;
}

// Find next available IP for a device type within a project
async function getNextAvailableIP(projectId, deviceType, category, Device) {
  const config = getIPConfig(deviceType, category);
  
  // Get all devices in this project with IPs in the same subnet
  const existingDevices = await Device.find({
    projectId,
    ipAddress: { $regex: `^${config.subnet}` }
  }).select('ipAddress');
  
  const usedIPs = new Set(existingDevices.map(d => d.ipAddress));
  
  // Find first available IP in the range
  for (let i = config.range.start; i <= config.range.end; i++) {
    const candidateIP = `${config.subnet}.${i}`;
    if (!usedIPs.has(candidateIP)) {
      return { ip: candidateIP, vlan: config.vlan };
    }
  }
  
  // If range exhausted, return default with warning
  return { 
    ip: config.defaultIP, 
    vlan: config.vlan, 
    warning: 'IP range exhausted, may have conflicts' 
  };
}

// Check for IP conflicts within a project
async function checkIPConflict(projectId, ipAddress, excludeDeviceId, Device) {
  const query = {
    projectId,
    ipAddress,
  };
  
  if (excludeDeviceId) {
    query._id = { $ne: excludeDeviceId };
  }
  
  const conflictingDevice = await Device.findOne(query);
  
  if (conflictingDevice) {
    return {
      hasConflict: true,
      conflictingDevice: {
        id: conflictingDevice._id,
        name: conflictingDevice.name,
        category: conflictingDevice.category
      }
    };
  }
  
  return { hasConflict: false };
}

// Get default VLAN for a category
function getDefaultVLAN(deviceType, category) {
  const config = getIPConfig(deviceType, category);
  return config.vlan;
}

module.exports = {
  IP_CONFIG,
  getIPConfig,
  getNextAvailableIP,
  checkIPConflict,
  getDefaultVLAN
};
