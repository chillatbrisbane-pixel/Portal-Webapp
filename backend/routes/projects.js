const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const ProjectVersion = require('../models/ProjectVersion');
const Device = require('../models/Device');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Helper to create a version snapshot
const createVersionSnapshot = async (project, userId, changeDescription = 'Project updated') => {
  try {
    // Get all devices for this project
    const devices = await Device.find({ project: project._id });
    
    // Get next version number
    const lastVersion = await ProjectVersion.findOne({ project: project._id })
      .sort({ versionNumber: -1 });
    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    // Create snapshot
    const snapshot = {
      name: project.name,
      status: project.status,
      notes: project.notes,
      clientName: project.clientName,
      clientAddress: project.address,
      clientPhone: project.clientPhone,
      clientEmail: project.clientEmail,
      technology: project.technologies,
      devices: devices.map(d => ({
        deviceId: d._id,
        data: d.toObject(),
      })),
      wifiNetworks: project.wifiNetworks || [],
    };

    await ProjectVersion.create({
      project: project._id,
      versionNumber,
      snapshot,
      createdBy: userId,
      changeDescription,
    });

    // Cleanup old versions (keep last 5)
    await ProjectVersion.cleanupOldVersions(project._id, 5);
  } catch (err) {
    console.error('Failed to create version snapshot:', err);
  }
};

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

    // All authenticated users can view all projects
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new project - SIMPLIFIED (no populate)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Only tech and admins can create projects
    if (!['tech', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only techs and admins can create projects' });
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

// Update project (tech and admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Viewers cannot update projects
    if (req.userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit projects' });
    }
    
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create version snapshot BEFORE updating
    await createVersionSnapshot(project, req.userId, req.body.changeDescription || 'Project updated');

    // Update only allowed fields
    const allowedFields = [
      'name',
      'description',
      'clientName',
      'clientEmail',
      'clientPhone',
      'address',
      'state',
      'postcode',
      'projectManager',
      'siteLead',
      'sharePointLink',
      'skytunnelLink',
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
      'taskStages',
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

// Add a note entry to project
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Initialize noteEntries if it doesn't exist
    if (!project.noteEntries) {
      project.noteEntries = [];
    }

    // Add the new note entry
    project.noteEntries.push({
      text: text.trim(),
      createdBy: req.userId,
      createdAt: new Date(),
    });

    await project.save();

    // Populate the user info and return
    await project.populate('noteEntries.createdBy', 'name email');
    
    res.json(project.noteEntries);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get note entries for a project
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('noteEntries.createdBy', 'name email');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project.noteEntries || []);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a note entry (admin or note creator only)
router.delete('/:id/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const noteIndex = project.noteEntries.findIndex(
      n => n._id.toString() === req.params.noteId
    );

    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = project.noteEntries[noteIndex];
    
    // Only allow deletion by note creator or admin
    if (note.createdBy.toString() !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    project.noteEntries.splice(noteIndex, 1);
    await project.save();

    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Delete note error:', error);
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

// Get version history for a project
router.get('/:id/versions', authenticateToken, async (req, res) => {
  try {
    const versions = await ProjectVersion.find({ project: req.params.id })
      .populate('createdBy', 'name email')
      .sort({ versionNumber: -1 })
      .limit(5);

    res.json(versions);
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rollback to a specific version
router.post('/:id/rollback/:versionId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const version = await ProjectVersion.findOne({
      _id: req.params.versionId,
      project: req.params.id,
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Create a snapshot of current state before rollback
    await createVersionSnapshot(project, req.userId, `Rollback from version ${version.versionNumber}`);

    // Restore project data from snapshot
    const snapshot = version.snapshot;
    project.name = snapshot.name || project.name;
    project.status = snapshot.status || project.status;
    project.notes = snapshot.notes || project.notes;
    project.clientName = snapshot.clientName;
    project.address = snapshot.clientAddress;
    project.clientPhone = snapshot.clientPhone;
    project.clientEmail = snapshot.clientEmail;
    project.technologies = snapshot.technology;
    project.wifiNetworks = snapshot.wifiNetworks || [];

    await project.save();

    // Restore devices
    if (snapshot.devices && snapshot.devices.length > 0) {
      // Delete current devices
      await Device.deleteMany({ project: project._id });

      // Recreate devices from snapshot
      for (const deviceSnapshot of snapshot.devices) {
        const deviceData = { ...deviceSnapshot.data };
        delete deviceData._id;
        delete deviceData.__v;
        deviceData.project = project._id;
        
        await Device.create(deviceData);
      }
    }

    // Fetch updated project with devices
    const updatedProject = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email');

    res.json({
      message: `Rolled back to version ${version.versionNumber}`,
      project: updatedProject,
    });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
