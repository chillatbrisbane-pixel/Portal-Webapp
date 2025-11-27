const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const Project = require('../models/Project');
const Device = require('../models/Device');
const jwt = require('jsonwebtoken');

// Middleware to handle auth via query param or header (for download links)
const authenticateDownload = (req, res, next) => {
  let token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Generate PDF Handover Report
router.get('/project/:projectId', authenticateDownload, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'name email');
      
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const devices = await Device.find({ projectId: req.params.projectId })
      .sort({ category: 1, deviceType: 1 });

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: `${project.name} - Handover Report`,
        Author: 'AV Project Manager',
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_Handover_Report.pdf"`);

    doc.pipe(res);

    // ============ HEADER ============
    doc.fontSize(24).fillColor('#0066cc').text('Project Handover Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666666').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // ============ PROJECT DETAILS ============
    doc.fontSize(16).fillColor('#333333').text('Project Information');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#0066cc');
    doc.moveDown(0.5);

    const projectInfo = [
      ['Project Name', project.name],
      ['Client', project.clientName || 'N/A'],
      ['Address', project.address || 'N/A'],
      ['Status', project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('-', ' ')],
      ['Contact Email', project.clientEmail || 'N/A'],
      ['Contact Phone', project.clientPhone || 'N/A'],
    ];

    doc.fontSize(10).fillColor('#333333');
    projectInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    });

    if (project.description) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Description: ');
      doc.font('Helvetica').text(project.description);
    }

    doc.moveDown(2);

    // ============ DEVICE SUMMARY ============
    doc.fontSize(16).fillColor('#333333').text('Device Summary');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#0066cc');
    doc.moveDown(0.5);

    // Group devices by category
    const devicesByCategory = {};
    devices.forEach(device => {
      if (!devicesByCategory[device.category]) {
        devicesByCategory[device.category] = [];
      }
      devicesByCategory[device.category].push(device);
    });

    const categoryLabels = {
      'network': '🔗 Networking',
      'camera': '📹 Cameras',
      'security': '🔒 Security',
      'control-system': '🎛️ Control System',
      'lighting': '💡 Lighting',
      'av': '📺 AV Equipment',
      'other': '📦 Other Devices'
    };

    // Summary counts
    doc.fontSize(10).fillColor('#333333');
    Object.entries(devicesByCategory).forEach(([category, catDevices]) => {
      doc.text(`${categoryLabels[category] || category}: ${catDevices.length} device(s)`);
    });

    doc.moveDown(2);

    // ============ DETAILED DEVICE LIST ============
    Object.entries(devicesByCategory).forEach(([category, catDevices]) => {
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage();
      }

      doc.fontSize(14).fillColor('#0066cc').text(categoryLabels[category] || category);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
      doc.moveDown(0.5);

      catDevices.forEach((device, index) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold').text(device.name);
        doc.fontSize(9).fillColor('#666666').font('Helvetica');

        const deviceDetails = [];
        if (device.manufacturer) deviceDetails.push(`Manufacturer: ${device.manufacturer}`);
        if (device.model) deviceDetails.push(`Model: ${device.model}`);
        if (device.serialNumber) deviceDetails.push(`Serial: ${device.serialNumber}`);
        if (device.ipAddress) deviceDetails.push(`IP: ${device.ipAddress}`);
        if (device.macAddress) deviceDetails.push(`MAC: ${device.macAddress}`);
        if (device.vlan) deviceDetails.push(`VLAN: ${device.vlan}`);
        if (device.location) deviceDetails.push(`Location: ${device.location}`);

        // Show credentials (masked by default in spec, but we'll show in report)
        if (device.username && !device.hideCredentials) {
          deviceDetails.push(`Username: ${device.username}`);
        }
        if (device.password && !device.hideCredentials) {
          deviceDetails.push(`Password: ${device.password}`);
        }

        // Category-specific fields
        if (device.category === 'security' && device.skyTunnelLink) {
          deviceDetails.push(`SkyTunnel: ${device.skyTunnelLink}`);
        }

        deviceDetails.forEach(detail => {
          doc.text(`  • ${detail}`);
        });

        // WiFi SSIDs for access points
        if (device.ssids && device.ssids.length > 0) {
          doc.text('  WiFi Networks:');
          device.ssids.forEach(ssid => {
            doc.text(`    - ${ssid.name}: ${ssid.password || '(no password)'}`);
          });
        }

        if (device.configNotes) {
          doc.text(`  Notes: ${device.configNotes}`);
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    });

    // ============ WIFI CREDENTIALS SECTION ============
    const wifiDevices = devices.filter(d => d.ssids && d.ssids.length > 0);
    if (wifiDevices.length > 0) {
      if (doc.y > 600) {
        doc.addPage();
      }

      doc.fontSize(16).fillColor('#333333').text('WiFi Network Credentials');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#0066cc');
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#333333');
      wifiDevices.forEach(device => {
        device.ssids.forEach(ssid => {
          doc.font('Helvetica-Bold').text(`Network: ${ssid.name}`);
          doc.font('Helvetica').text(`Password: ${ssid.password || 'N/A'}`);
          doc.text(`Band: ${ssid.band || 'Dual'}`);
          doc.moveDown(0.5);
        });
      });
    }

    // ============ FOOTER ============
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999999').text(
      'This document contains sensitive network information. Please store securely.',
      { align: 'center' }
    );
    doc.text(`Report generated by AV Project Manager`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export project data as JSON (for backup)
router.get('/project/:projectId/json', authenticateDownload, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'name email');
      
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const devices = await Device.find({ projectId: req.params.projectId });

    const exportData = {
      exportDate: new Date().toISOString(),
      project: project.toObject(),
      devices: devices.map(d => d.toObject())
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_export.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export devices as CSV
router.get('/project/:projectId/csv', authenticateDownload, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const devices = await Device.find({ projectId: req.params.projectId });

    // Build CSV
    const headers = ['Name', 'Category', 'Type', 'Manufacturer', 'Model', 'Serial', 'IP', 'MAC', 'VLAN', 'Location', 'Username', 'Password', 'Status'];
    const rows = devices.map(d => [
      d.name,
      d.category,
      d.deviceType,
      d.manufacturer || '',
      d.model || '',
      d.serialNumber || '',
      d.ipAddress || '',
      d.macAddress || '',
      d.vlan || '',
      d.location || '',
      d.hideCredentials ? '' : (d.username || ''),
      d.hideCredentials ? '' : (d.password || ''),
      d.status
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_devices.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
