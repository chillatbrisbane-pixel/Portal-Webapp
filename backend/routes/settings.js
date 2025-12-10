const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/settings/branding - Get branding settings
router.get('/branding', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // Return branding info (without full base64 data for listing)
    res.json({
      branding: {
        logo: settings.branding?.logo ? {
          filename: settings.branding.logo.filename,
          mimeType: settings.branding.logo.mimeType,
          hasData: !!settings.branding.logo.data,
        } : null,
        background: settings.branding?.background ? {
          filename: settings.branding.background.filename,
          mimeType: settings.branding.background.mimeType,
          opacity: settings.branding.background.opacity,
          hasData: !!settings.branding.background.data,
        } : null,
        companyName: settings.branding?.companyName || 'Electronic Living',
        companyWebsite: settings.branding?.companyWebsite || 'www.electronicliving.com.au',
      }
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
});

// GET /api/settings/branding/logo - Get logo image data
router.get('/branding/logo', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    if (!settings.branding?.logo?.data) {
      return res.status(404).json({ error: 'No logo uploaded' });
    }
    
    res.json({
      data: settings.branding.logo.data,
      mimeType: settings.branding.logo.mimeType,
      filename: settings.branding.logo.filename,
    });
  } catch (error) {
    console.error('Error fetching logo:', error);
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

// GET /api/settings/branding/background - Get background image data
router.get('/branding/background', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    if (!settings.branding?.background?.data) {
      return res.status(404).json({ error: 'No background uploaded' });
    }
    
    res.json({
      data: settings.branding.background.data,
      mimeType: settings.branding.background.mimeType,
      filename: settings.branding.background.filename,
      opacity: settings.branding.background.opacity,
    });
  } catch (error) {
    console.error('Error fetching background:', error);
    res.status(500).json({ error: 'Failed to fetch background' });
  }
});

// PUT /api/settings/branding - Update branding settings (admin only)
router.put('/branding', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { logo, background, companyName, companyWebsite } = req.body;
    
    const settings = await Settings.getSettings();
    
    // Ensure branding object exists
    if (!settings.branding) {
      settings.branding = {
        companyName: 'Electronic Living',
        companyWebsite: 'www.electronicliving.com.au',
      };
    }
    
    // Update logo if provided
    if (logo !== undefined) {
      if (logo === null) {
        // Remove logo
        settings.branding.logo = undefined;
      } else if (logo.data) {
        // Validate base64 and size (max 2MB)
        const sizeInBytes = (logo.data.length * 3) / 4;
        if (sizeInBytes > 2 * 1024 * 1024) {
          return res.status(400).json({ error: 'Logo must be under 2MB' });
        }
        
        settings.branding.logo = {
          data: logo.data,
          mimeType: logo.mimeType || 'image/png',
          filename: logo.filename || 'logo.png',
        };
      }
    }
    
    // Update background if provided
    if (background !== undefined) {
      if (background === null) {
        // Remove background
        settings.branding.background = undefined;
      } else if (background.data) {
        // Validate base64 and size (max 5MB for backgrounds)
        const sizeInBytes = (background.data.length * 3) / 4;
        if (sizeInBytes > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Background must be under 5MB' });
        }
        
        settings.branding.background = {
          data: background.data,
          mimeType: background.mimeType || 'image/png',
          filename: background.filename || 'background.png',
          opacity: background.opacity || 0.1,
        };
      } else if (background.opacity !== undefined) {
        // Just updating opacity
        if (settings.branding.background) {
          settings.branding.background.opacity = background.opacity;
        }
      }
    }
    
    // Update company details
    if (companyName !== undefined) {
      settings.branding.companyName = companyName;
    }
    if (companyWebsite !== undefined) {
      settings.branding.companyWebsite = companyWebsite;
    }
    
    settings.markModified('branding');  // Required for Mixed type
    settings.updatedAt = new Date();
    settings.updatedBy = req.userId;
    
    await settings.save();
    
    res.json({ 
      success: true,
      branding: {
        logo: settings.branding?.logo ? {
          filename: settings.branding.logo.filename,
          mimeType: settings.branding.logo.mimeType,
          hasData: !!settings.branding.logo.data,
        } : null,
        background: settings.branding?.background ? {
          filename: settings.branding.background.filename,
          mimeType: settings.branding.background.mimeType,
          opacity: settings.branding.background.opacity,
          hasData: !!settings.branding.background.data,
        } : null,
        companyName: settings.branding?.companyName || 'Electronic Living',
        companyWebsite: settings.branding?.companyWebsite || 'www.electronicliving.com.au',
      }
    });
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// DELETE /api/settings/branding/logo - Remove logo (admin only)
router.delete('/branding/logo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    if (settings.branding) {
      settings.branding.logo = undefined;
    }
    settings.markModified('branding');
    settings.updatedAt = new Date();
    settings.updatedBy = req.userId;
    await settings.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing logo:', error);
    res.status(500).json({ error: 'Failed to remove logo' });
  }
});

// DELETE /api/settings/branding/background - Remove background (admin only)
router.delete('/branding/background', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    if (settings.branding) {
      settings.branding.background = undefined;
    }
    settings.markModified('branding');
    settings.updatedAt = new Date();
    settings.updatedBy = req.userId;
    await settings.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing background:', error);
    res.status(500).json({ error: 'Failed to remove background' });
  }
});

module.exports = router;
