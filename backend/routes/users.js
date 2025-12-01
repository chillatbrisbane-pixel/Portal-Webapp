const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Helper to get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
};

// Helper to log activity
const logActivity = async (userId, action, details = {}, req = null, targetUser = null) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      targetUser,
      details,
      ipAddress: req ? getClientIP(req) : null,
      userAgent: req?.headers['user-agent'] || null,
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('createdBy', 'name email')
      .populate('suspendedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activity logs (admin only)
router.get('/activity-logs', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { userId, action, limit = 100, page = 1 } = req.query;
    
    const query = {};
    if (userId) query.user = userId;
    if (action) query.action = action;

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email')
      .populate('targetUser', 'name email')
      .populate('targetProject', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get login history for a user (admin only)
router.get('/:id/login-history', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const logs = await ActivityLog.find({
      user: req.params.id,
      action: { $in: ['login', 'login_failed'] },
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Users can view their own profile, admins can view any
    if (req.params.id !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('createdBy', 'name email')
      .populate('suspendedBy', 'name email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin only, or self for limited fields)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    const isOwnProfile = req.params.id === req.userId.toString();

    if (!isAdmin && !isOwnProfile) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = user.role;

    // Users can update own name and email
    // Admins can update anything except password
    const allowedFields = isAdmin 
      ? ['name', 'role', 'isActive'] 
      : isOwnProfile 
        ? ['name', 'email'] 
        : ['name'];

    // Check if email is being changed and validate uniqueness
    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ 
        email: req.body.email.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'email') {
          user[field] = req.body[field].toLowerCase();
        } else {
          user[field] = req.body[field];
        }
      }
    });

    await user.save();

    // Log activity
    if (isAdmin && oldRole !== user.role) {
      await logActivity(req.userId, 'user_role_changed', { 
        oldRole, 
        newRole: user.role 
      }, req, user._id);
    } else {
      await logActivity(req.userId, 'user_updated', {
        updatedFields: Object.keys(req.body).filter(k => allowedFields.includes(k))
      }, req, user._id);
    }

    res.json(user.toJSON());
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Suspend user (admin only)
router.post('/:id/suspend', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Prevent self-suspension
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot suspend your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.suspended = true;
    user.suspendedAt = new Date();
    user.suspendedBy = req.userId;
    await user.save();

    // Log activity
    await logActivity(req.userId, 'user_suspended', { reason: req.body.reason }, req, user._id);

    res.json({ message: 'User suspended successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsuspend user (admin only)
router.post('/:id/unsuspend', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.suspended = false;
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    await user.save();

    // Log activity
    await logActivity(req.userId, 'user_unsuspended', {}, req, user._id);

    res.json({ message: 'User unsuspended successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change password (self only, moved from /users/:id to /auth)
router.post('/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Users can only change their own password
    if (req.params.id !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await user.comparePassword(currentPassword);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Log activity
    await logActivity(req.userId, 'password_change', {}, req);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset password (admin only)
router.post('/:id/reset-password', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.password = newPassword;
    user.mustChangePassword = true; // Force them to change on next login
    await user.save();

    // Log activity
    await logActivity(req.userId, 'user_updated', { passwordReset: true }, req, user._id);

    res.json({ message: 'Password reset successfully. User will be required to change it on next login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUserEmail = user.email;
    await User.findByIdAndDelete(req.params.id);

    // Log activity
    await logActivity(req.userId, 'user_deleted', { deletedUserEmail }, req);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;