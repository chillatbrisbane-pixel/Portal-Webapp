const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Project = require('../models/Project');
const { authenticateToken } = require('../middleware/auth');

// Get all devices for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    // Verify user has access to project
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasAccess =
      project.createdBy.toString() === req.userId.toString() ||
      project.teamMembers.some((m) => m.userId.toString() === req.userId.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const devices = await Device.find({ projectId: req.params.projectId }).sort({
      createdAt: -1,
    });
    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single device
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Verify access to project
    const project = await Project.findById(device.projectId);
    const hasAccess =
      project.createdBy.toString() === req.userId.toString() ||
      project.teamMembers.some((m) => m.userId.toString() === req.userId.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(device);
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create device
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.body;

    // Verify access to project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const userTeamMember = project.teamMembers.find(
      (m) => m.userId.toString() === req.userId.toString()
    );
    const canEdit =
      project.createdBy.toString() === req.userId.toString() ||
      userTeamMember?.role === 'editor';

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
    }

    const device = new Device(req.body);
    await device.save();
    res.status(201).json(device);
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

    // Verify access to project
    const project = await Project.findById(device.projectId);
    const userTeamMember = project.teamMembers.find(
      (m) => m.userId.toString() === req.userId.toString()
    );
    const canEdit =
      project.createdBy.toString() === req.userId.toString() ||
      userTeamMember?.role === 'editor';

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
    }

    Object.assign(device, req.body);
    await device.save();
    res.json(device);
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

    // Verify access to project
    const project = await Project.findById(device.projectId);
    const userTeamMember = project.teamMembers.find(
      (m) => m.userId.toString() === req.userId.toString()
    );
    const canEdit =
      project.createdBy.toString() === req.userId.toString() ||
      userTeamMember?.role === 'editor';

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
    }

    await Device.findByIdAndDelete(req.params.id);
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;