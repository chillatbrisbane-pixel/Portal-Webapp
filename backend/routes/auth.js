const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
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

// Register new user (admin only)
router.post('/register', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      role: role || 'technician',
      createdBy: req.userId,
      mustChangePassword: false, // New users don't need to change password
    });

    await user.save();

    // Log the activity
    await logActivity(req.userId, 'user_created', { 
      newUserEmail: user.email, 
      newUserRole: user.role 
    }, req, user._id);

    res.status(201).json({
      message: 'User created successfully',
      userId: user._id,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    // Validate input - support both email and legacy username login
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email or legacy username
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Try legacy username for migration
      user = await User.findOne({ username: email });
    }

    if (!user) {
      await logActivity(null, 'login_failed', { attemptedEmail: email }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    // Check if user is suspended
    if (user.suspended) {
      return res.status(403).json({ error: 'User account is suspended. Contact an administrator.' });
    }

    // Check password
    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      await logActivity(user._id, 'login_failed', { reason: 'wrong_password' }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({ 
          requires2FA: true, 
          message: 'Two-factor authentication code required' 
        });
      }

      // Verify 2FA code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2, // Allow 2 time steps tolerance
      });

      if (!verified) {
        // Check backup codes
        const backupCodeIndex = user.twoFactorBackupCodes?.findIndex(
          bc => !bc.used && bc.code === twoFactorCode
        );
        
        if (backupCodeIndex === -1) {
          await logActivity(user._id, 'login_failed', { reason: 'invalid_2fa' }, req);
          return res.status(401).json({ error: 'Invalid two-factor code' });
        }

        // Mark backup code as used
        user.twoFactorBackupCodes[backupCodeIndex].used = true;
        await user.save();
      }
    }

    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIP = getClientIP(req);
    await user.save();

    // Log successful login
    await logActivity(user._id, 'login', {}, req);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toJSON(),
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await user.comparePassword(currentPassword);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Log activity
    await logActivity(user._id, 'password_change', {}, req);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force password change (for first login migration)
router.post('/force-change-password', authenticateToken, async (req, res) => {
  try {
    const { newPassword, newEmail } = req.body;

    if (!newPassword || !newEmail) {
      return res.status(400).json({ error: 'New password and email are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already used by another user
    const existingUser = await User.findOne({ 
      email: newEmail.toLowerCase(), 
      _id: { $ne: user._id } 
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update user
    user.email = newEmail.toLowerCase();
    user.password = newPassword;
    user.mustChangePassword = false;
    user.username = undefined; // Remove legacy username
    await user.save();

    // Log activity
    await logActivity(user._id, 'password_change', { emailUpdated: true }, req);

    // Generate new token with updated info
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Account updated successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Force change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup 2FA - Generate secret
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Portal (${user.email})`,
      issuer: 'Portal',
    });

    // Store secret temporarily (not enabled yet)
    user.twoFactorSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify and enable 2FA
router.post('/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: 'Please setup 2FA first' });
    }

    // Verify code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push({
        code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        used: false,
      });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    // Log activity
    await logActivity(user._id, '2fa_enabled', {}, req);

    res.json({
      message: '2FA enabled successfully',
      backupCodes: backupCodes.map(bc => bc.code),
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable 2FA' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    // Log activity
    await logActivity(user._id, '2fa_disabled', {}, req);

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get 2FA status
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      enabled: user.twoFactorEnabled || false,
      backupCodesRemaining: user.twoFactorBackupCodes?.filter(bc => !bc.used).length || 0,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;