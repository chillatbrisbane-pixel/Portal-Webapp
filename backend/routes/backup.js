const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Project = require('../models/Project');
const Device = require('../models/Device');
const Task = require('../models/Task');

// Get full backup of all projects (admin only)
router.get('/export', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can export backups' });
    }

    // Get all projects with devices
    const projects = await Project.find()
      .populate('createdBy', 'name email')
      .lean();

    // Get all devices
    const devices = await Device.find().lean();

    // Get all tasks
    const tasks = await Task.find().lean();

    // Create backup object
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      exportedBy: req.userId,
      data: {
        projects,
        devices,
        tasks,
      },
      counts: {
        projects: projects.length,
        devices: devices.length,
        tasks: tasks.length,
      }
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=portal-backup-${new Date().toISOString().split('T')[0]}.json`);
    
    res.json(backup);
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup (admin only)
router.post('/import', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can import backups' });
    }

    const { backup, options } = req.body;

    if (!backup || !backup.data) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const results = {
      projects: { created: 0, skipped: 0, errors: [] },
      devices: { created: 0, skipped: 0, errors: [] },
      tasks: { created: 0, skipped: 0, errors: [] },
    };

    // Map old IDs to new IDs
    const projectIdMap = new Map();
    const deviceIdMap = new Map();

    // Import projects
    if (backup.data.projects && Array.isArray(backup.data.projects)) {
      for (const projectData of backup.data.projects) {
        try {
          const oldId = projectData._id;
          
          // Check if project with same name exists
          const existing = await Project.findOne({ name: projectData.name });
          if (existing && !options?.overwrite) {
            results.projects.skipped++;
            projectIdMap.set(oldId, existing._id.toString());
            continue;
          }

          // Remove _id and timestamps to create new
          const { _id, createdAt, updatedAt, __v, devices: oldDevices, ...cleanData } = projectData;
          
          // Set createdBy to current user
          cleanData.createdBy = req.userId;
          cleanData.devices = []; // Will be populated after devices are imported

          const newProject = new Project(cleanData);
          await newProject.save();
          
          projectIdMap.set(oldId, newProject._id.toString());
          results.projects.created++;
        } catch (err) {
          results.projects.errors.push({ name: projectData.name, error: err.message });
        }
      }
    }

    // Import devices
    if (backup.data.devices && Array.isArray(backup.data.devices)) {
      for (const deviceData of backup.data.devices) {
        try {
          const oldId = deviceData._id;
          const oldProjectId = deviceData.project;
          
          // Map to new project ID
          const newProjectId = projectIdMap.get(oldProjectId);
          if (!newProjectId) {
            results.devices.skipped++;
            continue;
          }

          // Remove _id and timestamps
          const { _id, createdAt, updatedAt, __v, ...cleanData } = deviceData;
          cleanData.project = newProjectId;

          const newDevice = new Device(cleanData);
          await newDevice.save();

          deviceIdMap.set(oldId, newDevice._id.toString());

          // Add device to project
          await Project.findByIdAndUpdate(newProjectId, {
            $push: { devices: newDevice._id }
          });

          results.devices.created++;
        } catch (err) {
          results.devices.errors.push({ name: deviceData.name, error: err.message });
        }
      }
    }

    // Import tasks
    if (backup.data.tasks && Array.isArray(backup.data.tasks)) {
      for (const taskData of backup.data.tasks) {
        try {
          const oldProjectId = taskData.project;
          
          // Map to new project ID
          const newProjectId = projectIdMap.get(oldProjectId);
          if (!newProjectId) {
            results.tasks.skipped++;
            continue;
          }

          // Remove _id and timestamps
          const { _id, createdAt, updatedAt, __v, ...cleanData } = taskData;
          cleanData.project = newProjectId;
          cleanData.createdBy = req.userId;
          // Clear assignee as user IDs won't match
          cleanData.assignee = null;
          cleanData.completedBy = null;

          const newTask = new Task(cleanData);
          await newTask.save();

          results.tasks.created++;
        } catch (err) {
          results.tasks.errors.push({ title: taskData.title, error: err.message });
        }
      }
    }

    res.json({
      success: true,
      message: 'Backup imported successfully',
      results
    });
  } catch (error) {
    console.error('Backup import error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
