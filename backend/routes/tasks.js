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
    const { project, title, description, assignee, stage, priority, dueDate } = req.body;
    
    // Validate required fields
    if (!project) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }
    
    // Get the highest order number for this project and stage
    const lastTask = await Task.findOne({ project, stage: stage || 'planning' }).sort({ order: -1 });
    const order = lastTask ? lastTask.order + 1 : 0;
    
    const task = new Task({
      project,
      title: title.trim(),
      description: description || '',
      assignee: assignee && assignee !== '' ? assignee : null,
      stage: stage || 'planning',
      completed: false,
      priority: priority || 'medium',
      dueDate: dueDate && dueDate !== '' ? dueDate : null,
      createdBy: req.user._id,
      order
    });
    
    await task.save();
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email');
    
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, assignee, stage, completed, priority, dueDate } = req.body;
    
    const updateData = { title, description, priority };
    
    // Handle assignee - allow null/unassigned
    if (assignee === '' || assignee === null) {
      updateData.assignee = null;
    } else if (assignee) {
      updateData.assignee = assignee;
    }
    
    // Handle stage change
    if (stage !== undefined) {
      updateData.stage = stage;
    }
    
    // Handle dueDate
    if (dueDate === '' || dueDate === null) {
      updateData.dueDate = null;
    } else if (dueDate) {
      updateData.dueDate = dueDate;
    }
    
    // Handle completion
    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed) {
        updateData.completedAt = new Date();
        updateData.completedBy = req.user._id;
      } else {
        updateData.completedAt = null;
        updateData.completedBy = null;
      }
    }
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('comments.user', 'name email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Toggle task completion
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const updateData = { completed: !task.completed };
    if (!task.completed) {
      updateData.completedAt = new Date();
      updateData.completedBy = req.user._id;
    } else {
      updateData.completedAt = null;
      updateData.completedBy = null;
    }
    
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email');
    
    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Move task to different stage
router.patch('/:id/stage', auth, async (req, res) => {
  try {
    const { stage } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { stage },
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email');
    
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
