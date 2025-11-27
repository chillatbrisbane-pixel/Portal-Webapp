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

// Category labels and colors
const CATEGORY_INFO = {
  'network': { label: 'Networking', color: '#3b82f6' },
  'camera': { label: 'Cameras & Surveillance', color: '#ef4444' },
  'security': { label: 'Security System', color: '#f59e0b' },
  'control-system': { label: 'Control System', color: '#8b5cf6' },
  'lighting': { label: 'Lighting Control', color: '#eab308' },
  'av': { label: 'Audio Visual', color: '#10b981' },
  'other': { label: 'Other Devices', color: '#6b7280' }
};

// Helper to draw a styled section header
function drawSectionHeader(doc, title, color = '#0066cc') {
  if (doc.y > 680) {
    doc.addPage();
  }
  doc.moveDown(1);
  doc.fontSize(16).fillColor(color).text(title);
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(color).lineWidth(2).stroke();
  doc.moveDown(0.75);
  doc.fillColor('#333333');
}

// Helper to draw a subsection header
function drawSubsectionHeader(doc, title, color = '#666666') {
  if (doc.y > 700) {
    doc.addPage();
  }
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(color).font('Helvetica-Bold').text(title);
  doc.moveTo(50, doc.y + 1).lineTo(300, doc.y + 1).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fillColor('#333333');
}

// Helper to draw a device card
function drawDeviceCard(doc, device, index) {
  if (doc.y > 650) {
    doc.addPage();
  }

  const startY = doc.y;
  const cardWidth = 495;
  
  // Card background
  doc.roundedRect(50, startY, cardWidth, 10, 3).fill('#f8fafc');
  
  // Device name
  doc.fontSize(11).fillColor('#1e293b').font('Helvetica-Bold');
  doc.text(device.name, 55, startY + 5);
  
  // Move below header
  doc.y = startY + 20;
  doc.x = 50;
  
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  
  // Build info columns
  const leftCol = [];
  const rightCol = [];
  
  if (device.manufacturer || device.model) {
    leftCol.push(`Make/Model: ${[device.manufacturer, device.model].filter(Boolean).join(' ')}`);
  }
  if (device.ipAddress) {
    leftCol.push(`IP Address: ${device.ipAddress}`);
  }
  if (device.macAddress) {
    leftCol.push(`MAC Address: ${device.macAddress}`);
  }
  if (device.vlan) {
    leftCol.push(`VLAN: ${device.vlan}`);
  }
  
  if (device.serialNumber) {
    rightCol.push(`Serial: ${device.serialNumber}`);
  }
  if (device.location) {
    rightCol.push(`Location: ${device.location}`);
  }
  if (device.username && !device.hideCredentials) {
    rightCol.push(`Username: ${device.username}`);
  }
  if (device.password && !device.hideCredentials) {
    rightCol.push(`Password: ${device.password}`);
  }
  
  // Draw columns
  const colStartY = doc.y;
  leftCol.forEach((line, i) => {
    doc.text(line, 55, colStartY + (i * 12));
  });
  rightCol.forEach((line, i) => {
    doc.text(line, 300, colStartY + (i * 12));
  });
  
  const maxLines = Math.max(leftCol.length, rightCol.length);
  doc.y = colStartY + (maxLines * 12) + 8;
  
  // Config notes if present
  if (device.configNotes) {
    doc.fontSize(8).fillColor('#64748b').text(`Notes: ${device.configNotes}`, 55);
    doc.moveDown(0.3);
  }
  
  doc.moveDown(0.5);
}

// Generate PDF Handover Report - Professional Book Style
router.get('/project/:projectId', authenticateDownload, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'name email');
      
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const devices = await Device.find({ projectId: req.params.projectId })
      .populate('boundToSwitch', 'name portCount')
      .sort({ category: 1, deviceType: 1, name: 1 });

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: {
        Title: `${project.name} - System Documentation`,
        Author: 'AV Project Manager',
        Subject: 'Smart Home System Documentation',
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_System_Documentation.pdf"`);

    doc.pipe(res);

    // ============================================================
    // COVER PAGE
    // ============================================================
    doc.rect(0, 0, 595, 842).fill('#0066cc');
    
    // White content area
    doc.rect(40, 40, 515, 762).fill('#ffffff');
    
    // Title
    doc.fontSize(32).fillColor('#0066cc').font('Helvetica-Bold');
    doc.text('Smart Home', 60, 150, { align: 'center', width: 475 });
    doc.text('System Documentation', 60, 190, { align: 'center', width: 475 });
    
    // Project name
    doc.moveDown(2);
    doc.fontSize(24).fillColor('#333333');
    doc.text(project.name, 60, 280, { align: 'center', width: 475 });
    
    // Client info
    if (project.clientName) {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#666666');
      doc.text(`Prepared for: ${project.clientName}`, 60, 340, { align: 'center', width: 475 });
    }
    
    if (project.address) {
      doc.fontSize(12).fillColor('#888888');
      doc.text(project.address, 60, 370, { align: 'center', width: 475 });
    }
    
    // Date
    doc.fontSize(12).fillColor('#666666');
    doc.text(`Documentation Date: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`, 60, 700, { align: 'center', width: 475 });
    
    // ============================================================
    // TABLE OF CONTENTS
    // ============================================================
    doc.addPage();
    
    doc.fontSize(24).fillColor('#0066cc').font('Helvetica-Bold');
    doc.text('Contents', 50, 50);
    doc.moveTo(50, 85).lineTo(545, 85).strokeColor('#0066cc').lineWidth(2).stroke();
    
    doc.moveDown(2);
    doc.fontSize(12).fillColor('#333333').font('Helvetica');
    
    const tocItems = [
      { title: 'Project Overview', page: 3 },
      { title: 'Contact Information', page: 3 },
      { title: 'WiFi Networks', page: 3 },
      { title: 'System Summary', page: 4 },
    ];
    
    // Add device categories to TOC
    const devicesByCategory = {};
    devices.forEach(device => {
      if (!devicesByCategory[device.category]) {
        devicesByCategory[device.category] = [];
      }
      devicesByCategory[device.category].push(device);
    });
    
    let pageNum = 5;
    Object.keys(devicesByCategory).forEach(cat => {
      const catInfo = CATEGORY_INFO[cat] || CATEGORY_INFO.other;
      tocItems.push({ title: catInfo.label, page: pageNum });
      pageNum++;
    });
    
    tocItems.push({ title: 'Switch Port Allocations', page: pageNum });
    tocItems.push({ title: 'Support Information', page: pageNum + 1 });
    
    tocItems.forEach((item, i) => {
      const dots = '.'.repeat(Math.max(1, 60 - item.title.length));
      doc.text(`${item.title} ${dots} ${item.page}`, 60, 120 + (i * 25));
    });
    
    // ============================================================
    // PROJECT OVERVIEW PAGE
    // ============================================================
    doc.addPage();
    
    drawSectionHeader(doc, 'Project Overview');
    
    doc.fontSize(11).fillColor('#333333');
    
    const infoTable = [
      ['Project Name', project.name],
      ['Client', project.clientName || 'N/A'],
      ['Address', project.address || 'N/A'],
      ['Status', project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('-', ' ') : 'N/A'],
      ['Created', new Date(project.createdAt).toLocaleDateString('en-AU')],
      ['Last Updated', new Date(project.updatedAt).toLocaleDateString('en-AU')],
    ];
    
    infoTable.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
      doc.moveDown(0.3);
    });
    
    if (project.description) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Description:');
      doc.font('Helvetica').text(project.description);
    }
    
    // Contact Information
    drawSectionHeader(doc, 'Contact Information');
    
    doc.fontSize(11);
    if (project.clientEmail) {
      doc.font('Helvetica-Bold').text('Email: ', { continued: true });
      doc.font('Helvetica').fillColor('#0066cc').text(project.clientEmail);
      doc.fillColor('#333333');
    }
    if (project.clientPhone) {
      doc.font('Helvetica-Bold').text('Phone: ', { continued: true });
      doc.font('Helvetica').text(project.clientPhone);
    }
    
    // WiFi Networks
    drawSectionHeader(doc, 'WiFi Networks');
    
    const wifiNetworks = project.wifiNetworks || [];
    
    // Also get SSIDs from access points
    const apSSIDs = devices
      .filter(d => d.deviceType === 'access-point' && d.ssids && d.ssids.length > 0)
      .flatMap(d => d.ssids);
    
    const allWifi = [...wifiNetworks, ...apSSIDs];
    
    if (allWifi.length > 0) {
      doc.fontSize(10);
      
      // WiFi table header
      doc.font('Helvetica-Bold');
      doc.text('Network Name (SSID)', 55, doc.y, { width: 180 });
      doc.text('Password', 240, doc.y - 12, { width: 150 });
      doc.text('Band', 400, doc.y - 12, { width: 100 });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
      doc.moveDown(0.5);
      
      doc.font('Helvetica');
      allWifi.forEach(wifi => {
        const y = doc.y;
        doc.text(wifi.name || wifi.ssid || 'N/A', 55, y, { width: 180 });
        doc.text(wifi.password || '(Open)', 240, y, { width: 150 });
        doc.text(wifi.band || 'Dual', 400, y, { width: 100 });
        doc.moveDown(0.8);
      });
    } else {
      doc.fontSize(10).text('No WiFi networks configured.');
    }
    
    // ============================================================
    // SYSTEM SUMMARY PAGE
    // ============================================================
    doc.addPage();
    
    drawSectionHeader(doc, 'System Summary');
    
    doc.fontSize(11);
    doc.font('Helvetica-Bold').text(`Total Devices: ${devices.length}`);
    doc.moveDown(0.5);
    
    // Category breakdown
    Object.entries(devicesByCategory).forEach(([category, catDevices]) => {
      const catInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;
      doc.font('Helvetica').fillColor(catInfo.color);
      doc.text(`● ${catInfo.label}: `, { continued: true });
      doc.fillColor('#333333').text(`${catDevices.length} device(s)`);
    });
    
    // IP Address Range Summary
    doc.moveDown(1);
    drawSubsectionHeader(doc, 'IP Address Allocation');
    
    doc.fontSize(9);
    const sortedByIP = [...devices].filter(d => d.ipAddress).sort((a, b) => {
      const parseIP = (ip) => ip.split('.').reduce((acc, oct) => acc * 256 + parseInt(oct), 0);
      return parseIP(a.ipAddress) - parseIP(b.ipAddress);
    });
    
    if (sortedByIP.length > 0) {
      const firstIP = sortedByIP[0].ipAddress;
      const lastIP = sortedByIP[sortedByIP.length - 1].ipAddress;
      doc.text(`IP Range: ${firstIP} - ${lastIP}`);
      doc.text(`Devices with IP: ${sortedByIP.length}`);
    }
    
    // ============================================================
    // DEVICE PAGES BY CATEGORY
    // ============================================================
    Object.entries(devicesByCategory).forEach(([category, catDevices]) => {
      doc.addPage();
      
      const catInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;
      
      // Category header
      doc.fontSize(20).fillColor(catInfo.color).font('Helvetica-Bold');
      doc.text(catInfo.label, 50, 50);
      doc.moveTo(50, 80).lineTo(545, 80).strokeColor(catInfo.color).lineWidth(3).stroke();
      
      doc.moveDown(1.5);
      doc.fontSize(10).fillColor('#666666').font('Helvetica');
      doc.text(`${catDevices.length} device(s) in this category`);
      doc.moveDown(1);
      
      // Sort devices by IP within category
      const sortedDevices = [...catDevices].sort((a, b) => {
        if (!a.ipAddress && !b.ipAddress) return 0;
        if (!a.ipAddress) return 1;
        if (!b.ipAddress) return -1;
        const parseIP = (ip) => ip.split('.').reduce((acc, oct) => acc * 256 + parseInt(oct), 0);
        return parseIP(a.ipAddress) - parseIP(b.ipAddress);
      });
      
      // Device table header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
      doc.text('Device', 55, doc.y, { width: 120 });
      doc.text('IP Address', 175, doc.y - 11, { width: 90 });
      doc.text('Make/Model', 265, doc.y - 11, { width: 120 });
      doc.text('Location', 385, doc.y - 11, { width: 100 });
      doc.text('Credentials', 485, doc.y - 11, { width: 70 });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fillColor('#333333');
      
      sortedDevices.forEach((device, index) => {
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 50;
        }
        
        const y = doc.y;
        const rowHeight = 24;
        
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(50, y - 2, 495, rowHeight).fill('#f8fafc');
        }
        
        doc.fillColor('#333333').fontSize(9);
        
        // Device name
        doc.font('Helvetica-Bold').text(device.name, 55, y, { width: 115 });
        
        // IP
        doc.font('Helvetica').text(device.ipAddress || '-', 175, y, { width: 85 });
        
        // Make/Model
        const makeModel = [device.manufacturer, device.model].filter(Boolean).join(' ');
        doc.text(makeModel || '-', 265, y, { width: 115 });
        
        // Location
        doc.text(device.location || '-', 385, y, { width: 95 });
        
        // Credentials
        if (device.username && device.password && !device.hideCredentials) {
          doc.fontSize(7).text(`${device.username}`, 485, y, { width: 65 });
          doc.text(`${device.password}`, 485, y + 8, { width: 65 });
        } else {
          doc.fontSize(9).text('-', 485, y);
        }
        
        doc.y = y + rowHeight;
      });
      
      // Detailed info for each device
      doc.moveDown(2);
      if (doc.y > 600) doc.addPage();
      
      drawSubsectionHeader(doc, 'Detailed Device Information');
      
      sortedDevices.forEach((device, index) => {
        if (doc.y > 680) {
          doc.addPage();
        }
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`${index + 1}. ${device.name}`);
        
        doc.fontSize(9).font('Helvetica').fillColor('#475569');
        
        const details = [];
        if (device.manufacturer) details.push(`Manufacturer: ${device.manufacturer}`);
        if (device.model) details.push(`Model: ${device.model}`);
        if (device.serialNumber) details.push(`Serial: ${device.serialNumber}`);
        if (device.ipAddress) details.push(`IP: ${device.ipAddress}`);
        if (device.macAddress) details.push(`MAC: ${device.macAddress}`);
        if (device.vlan) details.push(`VLAN: ${device.vlan}`);
        if (device.location) details.push(`Location: ${device.location}`);
        if (device.username && !device.hideCredentials) details.push(`Username: ${device.username}`);
        if (device.password && !device.hideCredentials) details.push(`Password: ${device.password}`);
        
        // Category specific
        if (device.boundToSwitch) {
          const switchName = typeof device.boundToSwitch === 'object' ? device.boundToSwitch.name : 'Switch';
          details.push(`Switch Port: ${switchName} Port ${device.switchPort || 'N/A'}`);
        }
        
        if (device.ssids && device.ssids.length > 0) {
          device.ssids.forEach(ssid => {
            details.push(`SSID: ${ssid.name} (${ssid.password || 'Open'})`);
          });
        }
        
        doc.text(details.join('  |  '), { indent: 15 });
        
        if (device.configNotes) {
          doc.fillColor('#64748b').text(`Notes: ${device.configNotes}`, { indent: 15 });
        }
        
        doc.moveDown(0.8);
      });
    });
    
    // ============================================================
    // SWITCH PORT ALLOCATIONS
    // ============================================================
    const switches = devices.filter(d => d.deviceType === 'switch');
    
    if (switches.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, 'Switch Port Allocations');
      
      switches.forEach(sw => {
        if (doc.y > 600) doc.addPage();
        
        drawSubsectionHeader(doc, `${sw.name} (${sw.portCount || 24} ports)`);
        
        if (sw.ipAddress) {
          doc.fontSize(9).text(`IP: ${sw.ipAddress}  |  ${sw.manufacturer || ''} ${sw.model || ''}`);
          doc.moveDown(0.5);
        }
        
        // Find devices bound to this switch
        const boundDevices = devices.filter(d => {
          const switchId = typeof d.boundToSwitch === 'string' ? d.boundToSwitch : d.boundToSwitch?._id?.toString();
          return switchId === sw._id.toString();
        });
        
        // Port table
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Port', 55, doc.y, { width: 40 });
        doc.text('Device', 100, doc.y - 10, { width: 150 });
        doc.text('IP Address', 255, doc.y - 10, { width: 100 });
        doc.text('VLAN', 360, doc.y - 10, { width: 50 });
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(450, doc.y).strokeColor('#e5e7eb').stroke();
        doc.moveDown(0.3);
        
        doc.font('Helvetica');
        
        const portCount = sw.portCount || 24;
        for (let port = 1; port <= portCount; port++) {
          if (doc.y > 750) {
            doc.addPage();
            doc.y = 50;
          }
          
          const device = boundDevices.find(d => d.switchPort === port);
          const y = doc.y;
          
          if (device) {
            doc.fillColor('#059669');
          } else {
            doc.fillColor('#9ca3af');
          }
          
          doc.text(port.toString(), 55, y, { width: 40 });
          doc.fillColor('#333333');
          doc.text(device ? device.name : '-', 100, y, { width: 150 });
          doc.text(device ? (device.ipAddress || '-') : '-', 255, y, { width: 100 });
          doc.text(device ? (device.vlan || '-').toString() : '-', 360, y, { width: 50 });
          
          doc.moveDown(0.4);
        }
        
        doc.moveDown(1);
      });
    }
    
    // ============================================================
    // SUPPORT PAGE
    // ============================================================
    doc.addPage();
    
    drawSectionHeader(doc, 'Support Information');
    
    doc.fontSize(11).fillColor('#333333');
    doc.font('Helvetica-Bold').text('System Integrator');
    doc.font('Helvetica').text('For technical support or service requests, please contact your system integrator.');
    
    doc.moveDown(1.5);
    
    doc.font('Helvetica-Bold').text('Important Notes:');
    doc.font('Helvetica');
    doc.moveDown(0.5);
    
    const notes = [
      '• Keep this document in a safe place for future reference.',
      '• Do not share WiFi passwords or device credentials with unauthorized persons.',
      '• Contact your integrator before making any changes to system settings.',
      '• Regular maintenance is recommended to ensure optimal system performance.',
      '• Back up any custom programming before system updates.',
    ];
    
    notes.forEach(note => {
      doc.text(note);
      doc.moveDown(0.3);
    });
    
    doc.moveDown(2);
    
    // Footer
    doc.fontSize(9).fillColor('#666666');
    doc.text(`Document generated: ${new Date().toLocaleString('en-AU')}`, { align: 'center' });
    doc.text('This document contains confidential system information.', { align: 'center' });
    
    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
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

    const devices = await Device.find({ projectId: req.params.projectId })
      .sort({ category: 1, deviceType: 1 });

    // CSV header
    const headers = [
      'Name', 'Category', 'Type', 'Manufacturer', 'Model', 'Serial Number',
      'IP Address', 'MAC Address', 'VLAN', 'Username', 'Password',
      'Location', 'Status', 'Notes'
    ];

    // CSV rows
    const rows = devices.map(device => [
      device.name,
      device.category,
      device.deviceType,
      device.manufacturer || '',
      device.model || '',
      device.serialNumber || '',
      device.ipAddress || '',
      device.macAddress || '',
      device.vlan || '',
      device.hideCredentials ? '' : (device.username || ''),
      device.hideCredentials ? '' : (device.password || ''),
      device.location || '',
      device.status || '',
      device.configNotes || ''
    ]);

    // Build CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_devices.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export project as JSON
router.get('/project/:projectId/json', authenticateDownload, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
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
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_backup.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
