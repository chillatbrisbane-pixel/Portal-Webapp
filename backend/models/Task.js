const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
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
  // Keep old assignee field for backwards compatibility
  assignee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // New: multiple assignees
  assignees: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // New: subtasks
  subtasks: [subtaskSchema],
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

// Pre-save hook to sync assignee with assignees array for backwards compatibility
taskSchema.pre('save', function(next) {
  // If assignees has values but assignee is empty, set assignee to first assignee
  if (this.assignees && this.assignees.length > 0 && !this.assignee) {
    this.assignee = this.assignees[0];
  }
  // If assignee is set but assignees is empty, add assignee to assignees
  if (this.assignee && (!this.assignees || this.assignees.length === 0)) {
    this.assignees = [this.assignee];
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
