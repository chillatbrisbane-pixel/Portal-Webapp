const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// Get all tasks for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email')
      .sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create task
router.post('/', auth, async (req, res) => {
  try {
    const { project, title, description, assignee, status, priority, dueDate } = req.body;
    
    // Get the highest order number for this project
    const lastTask = await Task.findOne({ project }).sort({ order: -1 });
    const order = lastTask ? lastTask.order + 1 : 0;
    
    const task = new Task({
      project,
      title,
      description,
      assignee: assignee || null,
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      createdBy: req.user._id,
      order
    });
    
    await task.save();
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email');
    
    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, assignee, status, priority, dueDate } = req.body;
    
    const updateData = { title, description, priority, dueDate };
    
    // Handle assignee - allow null/unassigned
    if (assignee === '' || assignee === null) {
      updateData.assignee = null;
    } else if (assignee) {
      updateData.assignee = assignee;
    }
    
    // Handle status change
    if (status) {
      updateData.status = status;
      if (status === 'done') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update task status (quick update)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const updateData = { status };
    if (status === 'done') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add comment to task
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    task.comments.push({
      user: req.user._id,
      text
    });
    
    await task.save();
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email');
    
    res.json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reorder tasks
router.post('/reorder', auth, async (req, res) => {
  try {
    const { taskIds } = req.body;
    
    const updates = taskIds.map((id, index) => 
      Task.findByIdAndUpdate(id, { order: index })
    );
    
    await Promise.all(updates);
    res.json({ message: 'Tasks reordered' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
