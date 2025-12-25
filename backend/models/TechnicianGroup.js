const mongoose = require('mongoose');

const technicianGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Members of this group
  members: [{
    memberType: {
      type: String,
      enum: ['user', 'contractor'],
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contractor'
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    role: {
      type: String,
      trim: true  // e.g., "SUP" for supervisor
    }
  }],
  
  colour: {
    type: String,
    default: '#6b7280'
  }
}, {
  timestamps: true
});

// Index for ordering
technicianGroupSchema.index({ displayOrder: 1, name: 1 });

// Static method to get all groups with populated members
technicianGroupSchema.statics.getGroupsWithMembers = async function() {
  const groups = await this.find({ isActive: true })
    .populate('members.user', 'name email role isActive scheduleNotes')
    .populate('members.contractor', 'name company category isActive')
    .sort({ displayOrder: 1 });
  
  // Filter out inactive members and sort
  return groups.map(group => {
    const doc = group.toObject();
    doc.members = doc.members
      .filter(m => {
        if (m.memberType === 'contractor' && m.contractor) {
          return m.contractor.isActive;
        }
        if (m.memberType === 'user' && m.user) {
          return m.user.isActive !== false;
        }
        return false;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return doc;
  });
};

// Method to add a member
technicianGroupSchema.methods.addMember = async function(memberType, id, role = null) {
  const maxOrder = this.members.reduce((max, m) => Math.max(max, m.displayOrder), -1);
  
  const member = {
    memberType,
    displayOrder: maxOrder + 1,
    role
  };
  
  if (memberType === 'user') {
    member.user = id;
  } else {
    member.contractor = id;
  }
  
  this.members.push(member);
  return this.save();
};

// Method to remove a member
technicianGroupSchema.methods.removeMember = async function(memberType, id) {
  this.members = this.members.filter(m => {
    if (memberType === 'user') {
      return !m.user || m.user.toString() !== id.toString();
    } else {
      return !m.contractor || m.contractor.toString() !== id.toString();
    }
  });
  return this.save();
};

// Method to reorder members
technicianGroupSchema.methods.reorderMembers = async function(memberIds) {
  memberIds.forEach((id, index) => {
    const member = this.members.find(m => 
      (m.user && m.user.toString() === id) || 
      (m.contractor && m.contractor.toString() === id)
    );
    if (member) {
      member.displayOrder = index;
    }
  });
  return this.save();
};

module.exports = mongoose.model('TechnicianGroup', technicianGroupSchema);
