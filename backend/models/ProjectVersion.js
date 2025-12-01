const mongoose = require('mongoose');

const projectVersionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    // Snapshot of project data at this version
    snapshot: {
      name: String,
      status: String,
      notes: String,
      clientName: String,
      clientAddress: String,
      clientPhone: String,
      clientEmail: String,
      technology: {
        network: Boolean,
        security: Boolean,
        av: Boolean,
        lighting: Boolean,
        control: Boolean,
      },
      // Store device IDs and their data at this point
      devices: [{
        deviceId: mongoose.Schema.Types.ObjectId,
        data: mongoose.Schema.Types.Mixed,
      }],
      // Store WiFi networks
      wifiNetworks: [{
        name: String,
        ssid: String,
        password: String,
        subnet: String,
        vlan: String,
        securityType: String,
        notes: String,
      }],
    },
    // Who created this version
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Description of what changed
    changeDescription: {
      type: String,
      default: 'Project updated',
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
projectVersionSchema.index({ project: 1, versionNumber: -1 });

// Keep only the last 5 versions per project
projectVersionSchema.statics.cleanupOldVersions = async function(projectId, keepCount = 5) {
  const versions = await this.find({ project: projectId })
    .sort({ versionNumber: -1 })
    .skip(keepCount);
  
  if (versions.length > 0) {
    const idsToDelete = versions.map(v => v._id);
    await this.deleteMany({ _id: { $in: idsToDelete } });
  }
};

module.exports = mongoose.model('ProjectVersion', projectVersionSchema);
