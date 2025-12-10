const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Project = require('../models/Project');
const Device = require('../models/Device');

// Generate a secure random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// GET /api/client/:token - Public route to view project (with optional PIN)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { pin } = req.query;
    
    const project = await Project.findOne({ 
      'clientAccess.token': token,
      'clientAccess.enabled': true 
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Invalid or expired access link' });
    }
    
    // Check PIN if required
    if (project.clientAccess.pin && project.clientAccess.pin !== pin) {
      return res.status(401).json({ error: 'PIN required', requiresPin: true });
    }
    
    // Update last accessed
    project.clientAccess.lastAccessed = new Date();
    await project.save();
    
    // Fetch devices for this project with populated references
    const devices = await Device.find({ projectId: project._id })
      .populate('boundToSwitch', 'name')
      .populate('managedPorts.assignedDevice', 'name ipAddress')
      .select('-__v')
      .sort({ category: 1, deviceType: 1, name: 1 });
    
    // Return project data for client view
    res.json({
      project: {
        _id: project._id,
        name: project.name,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        clientPhone: project.clientPhone,
        address: project.address,
        state: project.state,
        postcode: project.postcode,
        wifiNetworks: project.wifiNetworks,
        projectManager: project.projectManager,
        siteLead: project.siteLead,
        status: project.status,
        description: project.description,
      },
      devices: devices.map(d => ({
        _id: d._id,
        name: d.name,
        category: d.category,
        deviceType: d.deviceType,
        manufacturer: d.manufacturer,
        model: d.model,
        serialNumber: d.serialNumber,
        macAddress: d.macAddress,
        ipAddress: d.ipAddress,
        vlan: d.vlan,
        location: d.location,
        username: d.username,
        password: d.password,
        ssids: d.ssids,
        configNotes: d.configNotes,
        // Switch port info
        portCount: d.portCount,
        managedPorts: d.managedPorts?.map(p => ({
          portNumber: p.portNumber,
          description: p.description,
          assignedDevice: p.assignedDevice ? {
            _id: p.assignedDevice._id,
            name: p.assignedDevice.name,
            ipAddress: p.assignedDevice.ipAddress,
          } : null,
          vlan: p.vlan,
          poeEnabled: p.poeEnabled,
        })),
        // PDU info
        pduPortCount: d.pduPortCount,
        pduPortNames: d.pduPortNames,
      })),
    });
  } catch (error) {
    console.error('Error fetching client view:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

// POST /api/client/:token/verify-pin - Verify PIN for access
router.post('/:token/verify-pin', async (req, res) => {
  try {
    const { token } = req.params;
    const { pin } = req.body;
    
    const project = await Project.findOne({ 
      'clientAccess.token': token,
      'clientAccess.enabled': true 
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Invalid or expired access link' });
    }
    
    if (project.clientAccess.pin && project.clientAccess.pin !== pin) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
module.exports.generateToken = generateToken;
