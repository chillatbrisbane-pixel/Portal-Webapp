const mongoose = require('mongoose');

const scheduleEntrySchema = new mongoose.Schema({
  // When
  date: {
    type: Date,
    required: true,
    index: true
  },
  timeSlot: {
    type: String,
    enum: ['AM1', 'AM2', 'PM1', 'PM2'],
    required: true
  },
  
  // Who - either technician (internal) or contractor (external)
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  contractor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contractor',
    index: true
  },
  
  // Entry type
  entryType: {
    type: String,
    enum: [
      'project',
      'leave',
      'public-holiday',
      'training',
      'meeting',
      'office',
      'wfh',
      'quoting',
      'service-meeting',
      'unassigned',
      'other'
    ],
    required: true,
    default: 'project'
  },
  
  // Project link (when entryType is 'project' or 'unassigned')
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  // Denormalized for fast grid display
  projectCode: String,
  projectName: String,
  
  // Task link (optional - for task integration)
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  
  // Leave details (when entryType is 'leave')
  leaveType: {
    type: String,
    enum: ['annual', 'sick', 'personal', 'carers', 'compassionate', 'time-lieu']
  },
  
  // Description and notes
  description: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  
  // simPRO integration (future)
  simpro: {
    scheduleId: String,
    status: {
      type: String,
      enum: ['planned', 'locked', 'conflict', 'unlinked'],
      default: 'planned'
    },
    startTime: String,
    endTime: String,
    lastSyncAt: Date,
    lockedAt: Date,
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound indexes for efficient grid queries
scheduleEntrySchema.index({ date: 1, technician: 1, timeSlot: 1 });
scheduleEntrySchema.index({ date: 1, contractor: 1, timeSlot: 1 });
scheduleEntrySchema.index({ project: 1, date: 1 });

// Ensure either technician or contractor is set, not both
scheduleEntrySchema.pre('validate', function(next) {
  if (this.technician && this.contractor) {
    next(new Error('Schedule entry cannot have both technician and contractor'));
  }
  if (!this.technician && !this.contractor) {
    next(new Error('Schedule entry must have either technician or contractor'));
  }
  next();
});

// Denormalize project details on save
scheduleEntrySchema.pre('save', async function(next) {
  if (this.isModified('project') && this.project) {
    const Project = mongoose.model('Project');
    const project = await Project.findById(this.project).select('name clientName');
    if (project) {
      // Use last 5 digits of project _id as code if no explicit code field
      this.projectCode = this.project.toString().slice(-5);
      this.projectName = project.clientName || project.name;
    }
  }
  next();
});

// Static method to get schedule for date range
scheduleEntrySchema.statics.getScheduleGrid = async function(startDate, endDate, options = {}) {
  const query = {
    date: { $gte: startDate, $lte: endDate }
  };
  
  if (options.technicianId) {
    query.technician = options.technicianId;
  }
  if (options.contractorId) {
    query.contractor = options.contractorId;
  }
  if (options.projectId) {
    query.project = options.projectId;
  }
  
  return this.find(query)
    .populate('technician', 'name email')
    .populate('contractor', 'name company')
    .populate('project', 'name clientName')
    .sort({ date: 1, timeSlot: 1 });
};

// Static method to check for conflicts
scheduleEntrySchema.statics.checkConflicts = async function(technicianId, date, slots) {
  return this.find({
    technician: technicianId,
    date: date,
    timeSlot: { $in: slots }
  });
};

module.exports = mongoose.model('ScheduleEntry', scheduleEntrySchema);
