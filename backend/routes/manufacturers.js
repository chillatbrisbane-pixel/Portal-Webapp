const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// In-memory manufacturer database
let manufacturers = [
  {
    id: 1,
    name: 'Crestron',
    category: 'control-system',
    website: 'https://www.crestron.com',
  },
  {
    id: 2,
    name: 'Control4',
    category: 'control-system',
    website: 'https://www.control4.com',
  },
  {
    id: 3,
    name: 'Cisco',
    category: 'network',
    website: 'https://www.cisco.com',
  },
  {
    id: 4,
    name: 'Ubiquiti',
    category: 'network',
    website: 'https://www.ubiquiti.com',
  },
  {
    id: 5,
    name: 'Axis',
    category: 'camera',
    website: 'https://www.axis.com',
  },
  {
    id: 6,
    name: 'Hikvision',
    category: 'camera',
    website: 'https://www.hikvision.com',
  },
  {
    id: 7,
    name: 'Lutron',
    category: 'lighting',
    website: 'https://www.lutron.com',
  },
  {
    id: 8,
    name: 'Qsc',
    category: 'audio',
    website: 'https://www.qsc.com',
  },
  {
    id: 9,
    name: 'Sony',
    category: 'video',
    website: 'https://www.sony.com',
  },
  {
    id: 10,
    name: 'Yamaha',
    category: 'audio',
    website: 'https://www.yamaha.com',
  },
];

// Get all manufacturers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    let filtered = manufacturers;

    if (category) {
      filtered = manufacturers.filter((m) => m.category === category);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Get manufacturers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single manufacturer
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const manufacturer = manufacturers.find((m) => m.id === parseInt(req.params.id));
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    res.json(manufacturer);
  } catch (error) {
    console.error('Get manufacturer error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;