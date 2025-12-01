const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Auth actions
        'login',
        'login_failed',
        'logout',
        'password_change',
        '2fa_enabled',
        '2fa_disabled',
        // User management
        'user_created',
        'user_updated',
        'user_deleted',
        'user_suspended',
        'user_unsuspended',
        'user_role_changed',
        // Project actions
        'project_created',
        'project_updated',
        'project_deleted',
        'project_cloned',
        // Device actions
        'device_created',
        'device_updated',
        'device_deleted',
        'devices_bulk_created',
      ],
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    targetProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    targetDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ targetUser: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
