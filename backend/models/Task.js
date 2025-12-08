const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project',
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: String,
  assignee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  stage: {
    type: String,
    default: 'planning'
  },
  completed: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: Date,
  comments: [commentSchema],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  order: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Index for efficient queries
taskSchema.index({ project: 1, stage: 1 });
taskSchema.index({ project: 1, assignee: 1 });
taskSchema.index({ project: 1, completed: 1 });

module.exports = mongoose.model('Task', taskSchema);
