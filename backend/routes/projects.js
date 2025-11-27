const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all projects (all users see all projects)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({})
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .populate('devices');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access permission
    const hasAccess =
      project.createdBy._id.toString() === req.userId.toString() ||
      project.teamMembers.some((m) => m.userId._id.toString() === req.userId.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new project - SIMPLIFIED (no populate)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Only managers and admins can create projects
    if (!['manager', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only managers and admins can create projects' });
    }

    const projectData = {
      ...req.body,
      createdBy: req.userId,
      teamMembers: [
        {
          userId: req.userId,
          role: 'owner',
        },
      ],
    };

    const project = new Project(projectData);
    await project.save();

    // Just return the saved project without populate for now
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project (all users can edit)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update only allowed fields
    const allowedFields = [
      'name',
      'description',
      'clientName',
      'clientEmail',
      'clientPhone',
      'address',
      'status',
      'startDate',
      'completionDate',
      'budget',
      'estimatedCost',
      'actualCost',
      'technologies',
      'networkConfig',
      'wifiNetworks',
      'switchPorts',
      'notes',
      'handoverDocument',
      'devices',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    await project.save();

    // Return updated project
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete project (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Only admins can delete projects
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete projects' });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add team member to project
router.post('/:id/team', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can add team members
    if (project.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only project owner can add team members' });
    }

    // Check if already a member
    if (project.teamMembers.some((m) => m.userId.toString() === userId)) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    project.teamMembers.push({
      userId,
      role: role || 'viewer',
    });

    await project.save();
    res.json(project);
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove team member from project
router.delete('/:id/team/:userId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can remove team members
    if (project.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only project owner can remove team members' });
    }

    project.teamMembers = project.teamMembers.filter(
      (m) => m.userId.toString() !== req.params.userId
    );

    await project.save();
    res.json(project);
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add device to project
router.post('/:id/devices', authenticateToken, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          devices: {
            _id: new mongoose.Types.ObjectId(),
            ...req.body,
          },
        },
      },
      { new: true }
    );
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove device from project
router.delete('/:id/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $pull: { devices: { _id: req.params.deviceId } } },
      { new: true }
    );
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone project
router.post('/:id/clone', authenticateToken, async (req, res) => {
  try {
    const { name, cloneDevices } = req.body;
    
    const sourceProject = await Project.findById(req.params.id);
    if (!sourceProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create new project with cloned data
    const clonedData = {
      name: name || `${sourceProject.name} (Copy)`,
      description: sourceProject.description,
      clientName: sourceProject.clientName,
      clientEmail: sourceProject.clientEmail,
      clientPhone: sourceProject.clientPhone,
      address: sourceProject.address,
      status: 'planning',
      technologies: sourceProject.technologies,
      networkConfig: sourceProject.networkConfig,
      wifiNetworks: sourceProject.wifiNetworks,
      switchPorts: [],
      createdBy: req.userId,
      teamMembers: [],
    };

    const newProject = new Project(clonedData);
    await newProject.save();

    // Clone devices if requested
    if (cloneDevices) {
      const Device = require('../models/Device');
      const { getNextAvailableIP } = require('../utils/ipAssignment');
      
      const sourceDevices = await Device.find({ projectId: req.params.id });
      
      for (const device of sourceDevices) {
        const ipResult = await getNextAvailableIP(
          newProject._id.toString(),
          device.deviceType || device.category,
          device.category,
          Device
        );
        
        const clonedDevice = new Device({
          projectId: newProject._id,
          name: device.name,
          category: device.category,
          deviceType: device.deviceType,
          manufacturer: device.manufacturer,
          model: device.model,
          vlan: device.vlan,
          location: device.location,
          room: device.room,
          configNotes: device.configNotes,
          ipAddress: ipResult.ip,
          status: 'not-installed',
        });
        
        await clonedDevice.save();
      }
    }

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Clone project error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
