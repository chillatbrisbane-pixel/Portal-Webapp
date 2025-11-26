const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all projects for current user (created by or team member)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { createdBy: req.userId },
        { 'teamMembers.userId': req.userId },
      ],
    })
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

// Create new project
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

    // Fetch the saved project to populate
    const savedProject = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .exec();

    res.status(201).json(savedProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is owner or editor
    const userTeamMember = project.teamMembers.find(
      (m) => m.userId.toString() === req.userId.toString()
    );
    const isOwner = project.createdBy.toString() === req.userId.toString();
    const canEdit = isOwner || userTeamMember?.role === 'editor';

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
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
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .exec();

    res.json(updatedProject);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete project (owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can delete
    if (project.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only project owner can delete' });
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

    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .exec();

    res.json(updatedProject);
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

    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('teamMembers.userId', 'name email')
      .exec();

    res.json(updatedProject);
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
