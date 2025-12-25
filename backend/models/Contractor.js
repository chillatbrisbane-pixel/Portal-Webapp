const mongoose = require('mongoose');

const contractorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  category: {
    type: String,
    enum: ['contractor', 'subcontractor'],
    default: 'contractor'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for active contractors
contractorSchema.index({ isActive: 1, name: 1 });

// Virtual for display label
contractorSchema.virtual('displayName').get(function() {
  if (this.company) {
    return `${this.name} (${this.company})`;
  }
  return this.name;
});

// Virtual for role label (CON or SUB)
contractorSchema.virtual('roleLabel').get(function() {
  return this.category === 'subcontractor' ? 'SUB' : 'CON';
});

// Ensure virtuals are included in JSON
contractorSchema.set('toJSON', { virtuals: true });
contractorSchema.set('toObject', { virtuals: true });

// Static method to get active contractors
contractorSchema.statics.getActive = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

module.exports = mongoose.model('Contractor', contractorSchema);
