const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { authenticateToken } = require('../middleware/auth');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Tasks route is working', timestamp: new Date().toISOString() });
});

// Get all tasks with filters (for Tasks page)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      projectId, 
      assignee, 
      stage, 
      priority, 
      completed, 
      dueBefore, 
      dueAfter,
      search,
      sort = 'dueDate'
    } = req.query;
    
    const query = {};
    
    if (projectId) query.project = projectId;
    if (assignee) {
      query.$or = [
        { assignee: assignee },
        { assignees: assignee }
      ];
    }
    if (stage) query.stage = stage;
    if (priority) query.priority = priority;
    if (completed !== undefined) query.completed = completed === 'true';
    
    if (dueBefore || dueAfter) {
      query.dueDate = {};
      if (dueBefore) query.dueDate.$lte = new Date(dueBefore);
      if (dueAfter) query.dueDate.$gte = new Date(dueAfter);
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    let sortOption = {};
    switch (sort) {
      case 'dueDate': sortOption = { dueDate: 1, priority: -1 }; break;
      case 'priority': sortOption = { priority: -1, dueDate: 1 }; break;
      case 'created': sortOption = { createdAt: -1 }; break;
      case 'stage': sortOption = { stage: 1, order: 1 }; break;
      default: sortOption = { dueDate: 1 };
    }
    
    const tasks = await Task.find(query)
      .populate('project', 'name clientName status')
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email')
      .sort(sortOption);
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get tasks assigned to current user (across all projects)
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ 
      $or: [
        { assignee: req.userId },
        { assignees: req.userId }
      ],
      completed: false 
    })
      .populate('project', 'name')
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, priority: -1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('comments.user', 'name email')
      .populate('subtasks.completedBy', 'name email')
      .sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single task
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email')
      .populate('subtasks.completedBy', 'name email');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create task
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('Creating task with body:', JSON.stringify(req.body));
    const { project, title, description, assignee, assignees, stage, priority, dueDate, subtasks } = req.body;
    
    // Validate required fields
    if (!project) {
      console.log('Task creation failed: No project ID');
      return res.status(400).json({ message: 'Project ID is required' });
    }
    if (!title || !title.trim()) {
      console.log('Task creation failed: No title');
      return res.status(400).json({ message: 'Task title is required' });
    }
    
    // Get the highest order number for this project and stage
    const lastTask = await Task.findOne({ project, stage: stage || 'planning' }).sort({ order: -1 });
    const order = lastTask ? lastTask.order + 1 : 0;
    
    // Handle assignees - support both single assignee and multiple assignees
    let taskAssignees = [];
    if (assignees && assignees.length > 0) {
      taskAssignees = assignees.filter(a => a && a !== '');
    } else if (assignee && assignee !== '') {
      taskAssignees = [assignee];
    }
    
    const taskData = {
      project,
      title: title.trim(),
      description: description || '',
      assignee: taskAssignees.length > 0 ? taskAssignees[0] : null,
      assignees: taskAssignees,
      subtasks: subtasks || [],
      stage: stage || 'planning',
      completed: false,
      priority: priority || 'medium',
      dueDate: dueDate && dueDate !== '' ? dueDate : null,
      createdBy: req.userId,
      order
    };
    
    console.log('Task data to save:', JSON.stringify(taskData));
    
    const task = new Task(taskData);
    await task.save();
    
    console.log('Task saved with ID:', task._id);
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email');
    
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Task creation error:', error);
    console.error('Error stack:', error.stack);
    res.status(400).json({ message: error.message });
  }
});

// Update task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, assignee, assignees, stage, completed, priority, dueDate, subtasks } = req.body;
    
    const updateData = { title, description, priority };
    
    // Handle assignees - support both single and multiple
    if (assignees !== undefined) {
      const validAssignees = (assignees || []).filter(a => a && a !== '');
      updateData.assignees = validAssignees;
      updateData.assignee = validAssignees.length > 0 ? validAssignees[0] : null;
    } else if (assignee === '' || assignee === null) {
      updateData.assignee = null;
      updateData.assignees = [];
    } else if (assignee) {
      updateData.assignee = assignee;
      updateData.assignees = [assignee];
    }
    
    // Handle subtasks
    if (subtasks !== undefined) {
      updateData.subtasks = subtasks;
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
        updateData.completedBy = req.userId;
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
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('comments.user', 'name email')
      .populate('subtasks.completedBy', 'name email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Toggle task completion
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const updateData = { completed: !task.completed };
    if (!task.completed) {
      updateData.completedAt = new Date();
      updateData.completedBy = req.userId;
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
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email');
    
    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Toggle subtask completion
router.patch('/:id/subtasks/:subtaskId/toggle', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found' });
    }
    
    subtask.completed = !subtask.completed;
    if (subtask.completed) {
      subtask.completedAt = new Date();
      subtask.completedBy = req.userId;
    } else {
      subtask.completedAt = null;
      subtask.completedBy = null;
    }
    
    await task.save();
    
    const updatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.completedBy', 'name email');
    
    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Move task to different stage
router.patch('/:id/stage', authenticateToken, async (req, res) => {
  try {
    const { stage } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { stage },
      { new: true }
    )
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
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
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    task.comments.push({
      user: req.userId,
      text
    });
    
    await task.save();
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('assignees', 'name email')
      .populate('createdBy', 'name email')
      .populate('comments.user', 'name email');
    
    res.json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete task
router.delete('/:id', authenticateToken, async (req, res) => {
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
router.post('/reorder', authenticateToken, async (req, res) => {
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
