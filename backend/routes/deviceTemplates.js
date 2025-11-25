const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Predefined device templates
const deviceTemplates = [
  {
    id: 1,
    name: 'Network Switch - Cisco',
    category: 'switch',
    manufacturer: 'Cisco',
    model: 'C3850',
    specifications: {
      ports: 48,
      powerRequirement: '740W',
      vlanSupport: true,
    },
  },
  {
    id: 2,
    name: 'WiFi Access Point - Ubiquiti',
    category: 'access-point',
    manufacturer: 'Ubiquiti',
    model: 'U6-Pro',
    specifications: {
      bands: ['2.4GHz', '5GHz'],
      poe: '802.3at',
      coverage: '200m²',
    },
  },
  {
    id: 3,
    name: 'IP Camera - Axis',
    category: 'camera',
    manufacturer: 'Axis',
    model: 'P3367-V',
    specifications: {
      resolution: '5MP',
      poe: '802.3at',
      nightVision: true,
    },
  },
  {
    id: 4,
    name: 'NVR - Hikvision',
    category: 'nvr',
    manufacturer: 'Hikvision',
    model: 'DS-7732NI-K4',
    specifications: {
      channels: 32,
      storage: '48TB',
      resolution: '8MP',
    },
  },
  {
    id: 5,
    name: 'Control Processor - Crestron',
    category: 'control-system',
    manufacturer: 'Crestron',
    model: 'DM-MD64X64-RPS',
    specifications: {
      inputOutputs: '64x64',
      resolution: '4K',
      poe: true,
    },
  },
  {
    id: 6,
    name: 'Lighting Controller - Lutron',
    category: 'lighting',
    manufacturer: 'Lutron',
    model: 'HomeWorks iO',
    specifications: {
      zones: 'Unlimited',
      dimming: 'Wireless',
      integration: 'HomeKit Ready',
    },
  },
  {
    id: 7,
    name: 'Audio Amplifier - QSC',
    category: 'audio',
    manufacturer: 'Qsc',
    model: 'MP-M12',
    specifications: {
      channels: 12,
      power: '2700W',
      cooling: 'Fanless',
    },
  },
  {
    id: 8,
    name: 'Video Display - Sony',
    category: 'video',
    manufacturer: 'Sony',
    model: 'BZ55XR',
    specifications: {
      screenSize: '55"',
      resolution: '4K',
      brightness: '2000nit',
    },
  },
];

// Get all device templates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    let filtered = deviceTemplates;

    if (category) {
      filtered = deviceTemplates.filter((t) => t.category === category);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single template
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const template = deviceTemplates.find((t) => t.id === parseInt(req.params.id));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;