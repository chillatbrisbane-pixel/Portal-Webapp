const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Project = require('../models/Project');
const { authenticateToken } = require('../middleware/auth');
const { generatePassword } = require('../utils/passwordGenerator');
const { getNextAvailableIP, checkIPConflict, getDefaultVLAN, IP_CONFIG } = require('../utils/ipAssignment');

// Helper function to auto-update project skytunnel link from Inception device
// Returns the skytunnel link if it was updated, null otherwise
async function updateProjectSkytunnelFromDevice(device) {
  try {
    // Only proceed if this is an Inception alarm panel with a serial number
    if (device.deviceType === 'alarm-panel' && 
        device.panelType === 'inception' && 
        device.serialNumber) {
      const skytunnelLink = `https://skytunnel.cloud/${device.serialNumber}`;
      
      // Update the project's skytunnel link
      await Project.findByIdAndUpdate(device.projectId, {
        skytunnelLink: skytunnelLink
      });
      
      console.log(`Auto-updated project skytunnel link: ${skytunnelLink}`);
      return skytunnelLink;
    }
    return null;
  } catch (error) {
    console.error('Error updating skytunnel link:', error);
    return null;
  }
}

// ============ UTILITY ENDPOINTS ============

// Generate password
router.get('/generate-password', authenticateToken, (req, res) => {
  try {
    const password = generatePassword();
    res.json({ password });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next available IP for a device type
router.get('/next-ip/:projectId/:deviceType', authenticateToken, async (req, res) => {
  try {
    const { projectId, deviceType } = req.params;
    const category = req.query.category || 'other';
    
    const result = await getNextAvailableIP(projectId, deviceType, category, Device);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check IP conflict
router.post('/check-ip-conflict', authenticateToken, async (req, res) => {
  try {
    const { projectId, ipAddress, excludeDeviceId } = req.body;
    const result = await checkIPConflict(projectId, ipAddress, excludeDeviceId, Device);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get IP configuration reference
router.get('/ip-config', authenticateToken, (req, res) => {
  res.json(IP_CONFIG);
});

// Get available switch ports for a project
router.get('/available-switch-ports/:projectId', authenticateToken, async (req, res) => {
  try {
    const switches = await Device.find({
      projectId: req.params.projectId,
      deviceType: 'switch'
    }).select('name portCount managedPorts');
    
    const result = switches.map(sw => {
      const usedPorts = new Set((sw.managedPorts || []).map(p => p.portNumber));
      const availablePorts = [];
      for (let i = 1; i <= (sw.portCount || 24); i++) {
        if (!usedPorts.has(i)) {
          availablePorts.push(i);
        }
      }
      return {
        switchId: sw._id,
        switchName: sw.name,
        totalPorts: sw.portCount || 24,
        availablePorts
      };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CRUD OPERATIONS ============

// Get all devices for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // All authenticated users can view all project devices
    const devices = await Device.find({ projectId: req.params.projectId })
      .populate('boundToSwitch', 'name')
      .populate('boundToNVR', 'name')
      .populate('boundToProcessor', 'name')
      .sort({ category: 1, createdAt: -1 });
      
    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get devices by category
router.get('/project/:projectId/category/:category', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({
      projectId: req.params.projectId,
      category: req.params.category
    })
      .populate('boundToSwitch', 'name')
      .populate('boundToNVR', 'name')
      .sort({ createdAt: -1 });
      
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single device
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)
      .populate('boundToSwitch', 'name portCount')
      .populate('boundToNVR', 'name')
      .populate('boundToProcessor', 'name');
      
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // All authenticated users can view device details
    res.json(device);
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create device with auto-IP assignment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { projectId, autoAssignIP } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // All authenticated users can create devices
    let deviceData = { ...req.body };
    
    // Auto-assign IP if requested and no IP provided
    if (autoAssignIP && !deviceData.ipAddress) {
      const ipResult = await getNextAvailableIP(
        projectId,
        deviceData.deviceType || deviceData.category,
        deviceData.category,
        Device
      );
      deviceData.ipAddress = ipResult.ip;
      deviceData.vlan = ipResult.vlan;
    }
    
    // Set default VLAN if not provided
    if (!deviceData.vlan) {
      deviceData.vlan = getDefaultVLAN(deviceData.deviceType, deviceData.category);
    }

    // Check for IP conflict
    if (deviceData.ipAddress) {
      const conflict = await checkIPConflict(projectId, deviceData.ipAddress, null, Device);
      if (conflict.hasConflict) {
        return res.status(400).json({
          error: `IP conflict: ${deviceData.ipAddress} is already assigned to "${conflict.conflictingDevice.name}"`,
          conflict: conflict.conflictingDevice
        });
      }
    }

    const device = new Device(deviceData);
    await device.save();
    
    // Auto-update project skytunnel link if this is an Inception alarm panel
    const updatedSkytunnelLink = await updateProjectSkytunnelFromDevice(device);
    
    // Populate references before returning
    await device.populate('boundToSwitch', 'name');
    await device.populate('boundToNVR', 'name');
    
    // Include skytunnel update info in response
    const response = device.toObject();
    if (updatedSkytunnelLink) {
      response._projectUpdate = { skytunnelLink: updatedSkytunnelLink };
    }
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update device
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // All authenticated users can update devices
    // Check for IP conflict if IP is being changed
    if (req.body.ipAddress && req.body.ipAddress !== device.ipAddress) {
      const conflict = await checkIPConflict(device.projectId, req.body.ipAddress, device._id, Device);
      if (conflict.hasConflict) {
        return res.status(400).json({
          error: `IP conflict: ${req.body.ipAddress} is already assigned to "${conflict.conflictingDevice.name}"`,
          conflict: conflict.conflictingDevice
        });
      }
    }

    Object.assign(device, req.body);
    await device.save();
    
    // Auto-update project skytunnel link if this is an Inception alarm panel
    const updatedSkytunnelLink = await updateProjectSkytunnelFromDevice(device);
    
    await device.populate('boundToSwitch', 'name');
    await device.populate('boundToNVR', 'name');
    await device.populate('boundToProcessor', 'name');
    
    // Include skytunnel update info in response
    const response = device.toObject();
    if (updatedSkytunnelLink) {
      response._projectUpdate = { skytunnelLink: updatedSkytunnelLink };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete device
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // All authenticated users can delete devices
    await Device.findByIdAndDelete(req.params.id);
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk create devices
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { projectId, devices: deviceList } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // All authenticated users can bulk create devices
    const createdDevices = [];
    const errors = [];

    for (const deviceData of deviceList) {
      try {
        // Auto-assign IP if needed
        if (deviceData.autoAssignIP && !deviceData.ipAddress) {
          const ipResult = await getNextAvailableIP(
            projectId,
            deviceData.deviceType || deviceData.category,
            deviceData.category,
            Device
          );
          deviceData.ipAddress = ipResult.ip;
          deviceData.vlan = ipResult.vlan;
        }

        const device = new Device({ ...deviceData, projectId });
        await device.save();
        createdDevices.push(device);
      } catch (err) {
        errors.push({ device: deviceData.name, error: err.message });
      }
    }

    res.status(201).json({ created: createdDevices, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
