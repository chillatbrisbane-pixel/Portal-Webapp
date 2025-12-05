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
  'power': { label: 'Power Distribution', color: '#dc2626' },
  'hvac': { label: 'HVAC Control', color: '#06b6d4' },
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
function drawSubsectionHeader(doc, title, color = '#666666', centered = false) {
  if (doc.y > 700) {
    doc.addPage();
  }
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(color).font('Helvetica-Bold');
  if (centered) {
    doc.text(title, 50, doc.y, { width: 495, align: 'center' });
    doc.moveTo(150, doc.y + 1).lineTo(445, doc.y + 1).strokeColor('#e5e7eb').lineWidth(1).stroke();
  } else {
    doc.text(title);
    doc.moveTo(50, doc.y + 1).lineTo(300, doc.y + 1).strokeColor('#e5e7eb').lineWidth(1).stroke();
  }
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
    // SYSTEM SUMMARY PAGE - Simplified Overview
    // ============================================================
    doc.addPage();
    
    drawSectionHeader(doc, 'System Overview');
    
    // Simple category grid - just show what categories are present
    doc.fontSize(11).font('Helvetica');
    doc.text('This system includes the following subsystems:', { continued: false });
    doc.moveDown(0.5);
    
    Object.entries(devicesByCategory).forEach(([category, catDevices]) => {
      const catInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;
      doc.fillColor(catInfo.color).fontSize(10);
      doc.text(`✓ ${catInfo.label} (${catDevices.length})`, { indent: 20 });
    });
    
    doc.moveDown(1);
    doc.fillColor('#333333').fontSize(10);
    doc.text(`Total Equipment: ${devices.length} devices`);
    
    doc.moveDown(1.5);
    
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
      
      // Device table header - no credentials in summary
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
      doc.text('Device', 55, doc.y, { width: 140 });
      doc.text('IP Address', 200, doc.y - 11, { width: 100 });
      doc.text('Make/Model', 305, doc.y - 11, { width: 140 });
      doc.text('Location', 450, doc.y - 11, { width: 100 });
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
        const rowHeight = 20;
        
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(50, y - 2, 495, rowHeight).fill('#f8fafc');
        }
        
        doc.fillColor('#333333').fontSize(9);
        
        // Device name
        doc.font('Helvetica-Bold').text(device.name, 55, y, { width: 140 });
        
        // IP
        doc.font('Helvetica').text(device.ipAddress || '-', 200, y, { width: 100 });
        
        // Make/Model
        const makeModel = [device.manufacturer, device.model].filter(Boolean).join(' ');
        doc.text(makeModel || '-', 305, y, { width: 140 });
        
        // Location
        doc.text(device.location || '-', 450, y, { width: 95 });
        
        doc.y = y + rowHeight;
      });
      
      // Detailed info for each device
      doc.moveDown(2);
      if (doc.y > 600) doc.addPage();
      
      drawSubsectionHeader(doc, 'Detailed Device Information', '#666666', true);
      
      sortedDevices.forEach((device, index) => {
        if (doc.y > 650) {
          doc.addPage();
        }
        
        // Device header with background
        const headerY = doc.y;
        doc.rect(50, headerY, 495, 18).fill('#f1f5f9');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`${device.name}`, 55, headerY + 4);
        
        // IP on right side of header
        if (device.ipAddress) {
          doc.font('Helvetica').fontSize(9).fillColor('#475569');
          doc.text(device.ipAddress, 450, headerY + 5, { width: 90, align: 'right' });
        }
        
        doc.y = headerY + 22;
        doc.fontSize(9).font('Helvetica').fillColor('#475569');
        
        // Two-column layout for details
        const leftX = 60;
        const rightX = 300;
        let currentY = doc.y;
        
        // Left column
        if (device.manufacturer || device.model) {
          doc.text(`Make/Model: ${[device.manufacturer, device.model].filter(Boolean).join(' ')}`, leftX, currentY);
          currentY += 12;
        }
        if (device.serialNumber) {
          doc.text(`Serial: ${device.serialNumber}`, leftX, currentY);
          currentY += 12;
        }
        if (device.macAddress) {
          doc.text(`MAC: ${device.macAddress}`, leftX, currentY);
          currentY += 12;
        }
        if (device.location) {
          doc.text(`Location: ${device.location}`, leftX, currentY);
          currentY += 12;
        }
        
        // Right column - reset Y position
        let rightY = doc.y;
        if (device.vlan) {
          doc.text(`VLAN: ${device.vlan}`, rightX, rightY);
          rightY += 12;
        }
        if (device.username && !device.hideCredentials) {
          doc.text(`Username: ${device.username}`, rightX, rightY);
          rightY += 12;
        }
        if (device.password && !device.hideCredentials) {
          doc.text(`Password: ${device.password}`, rightX, rightY);
          rightY += 12;
        }
        if (device.boundToSwitch) {
          const switchName = typeof device.boundToSwitch === 'object' ? device.boundToSwitch.name : 'Switch';
          doc.text(`Port: ${switchName} P${device.switchPort || '?'}`, rightX, rightY);
          rightY += 12;
        }
        
        // SSIDs (full width)
        doc.y = Math.max(currentY, rightY);
        if (device.ssids && device.ssids.length > 0) {
          device.ssids.forEach(ssid => {
            doc.text(`WiFi: ${ssid.name} / ${ssid.password || 'Open'}`, leftX, doc.y);
            doc.y += 12;
          });
        }
        
        // Notes (full width)
        if (device.configNotes) {
          doc.fillColor('#64748b').fontSize(8);
          doc.text(`Notes: ${device.configNotes}`, leftX, doc.y, { width: 480 });
          doc.moveDown(0.3);
        }
        
        doc.moveDown(0.8);
        doc.fillColor('#475569');
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
        
        // Port table header
        doc.fontSize(8).font('Helvetica-Bold');
        const headerY = doc.y;
        doc.text('Port', 55, headerY, { width: 35 });
        doc.text('Device', 95, headerY, { width: 110 });
        doc.text('IP Address', 210, headerY, { width: 90 });
        doc.text('MAC Address', 305, headerY, { width: 110 });
        doc.text('VLAN', 420, headerY, { width: 40 });
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
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
          
          doc.text(port.toString(), 55, y, { width: 35 });
          doc.fillColor('#333333');
          doc.text(device ? device.name : '-', 95, y, { width: 110 });
          doc.text(device ? (device.ipAddress || '-') : '-', 210, y, { width: 90 });
          doc.fontSize(7).text(device ? (device.macAddress || '-') : '-', 305, y, { width: 110 });
          doc.fontSize(8).text(device ? (device.vlan || '-').toString() : '-', 420, y, { width: 40 });
          
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
    doc.moveDown(0.5);
    
    // Electronic Living contact box
    doc.rect(50, doc.y, 495, 60).fill('#f0f9ff');
    const boxY = doc.y;
    doc.fillColor('#0369a1').fontSize(14).font('Helvetica-Bold');
    doc.text('Electronic Living', 60, boxY + 10);
    doc.fillColor('#333333').fontSize(11).font('Helvetica');
    doc.text('1300 764 554', 60, boxY + 30);
    doc.fontSize(10).fillColor('#666666');
    doc.text('For technical support or service requests', 60, boxY + 45);
    doc.y = boxY + 70;
    
    doc.moveDown(1);
    
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11).text('Important Notes:');
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

// Import project from JSON backup
router.post('/import', authenticateDownload, async (req, res) => {
  try {
    const { project: projectData, devices: devicesData } = req.body;
    
    if (!projectData || !devicesData) {
      return res.status(400).json({ error: 'Invalid backup file format. Expected project and devices data.' });
    }

    // Create new project (remove _id and timestamps to create fresh)
    const { _id, createdAt, updatedAt, createdBy, ...projectFields } = projectData;
    
    // Append "(Imported)" to name to distinguish from original
    projectFields.name = `${projectFields.name} (Imported)`;
    projectFields.createdBy = req.userId;
    
    const newProject = await Project.create(projectFields);
    
    // Map old device IDs to new device IDs for switch bindings
    const deviceIdMap = {};
    const devicesToCreate = [];
    
    // First pass: prepare devices without bindings
    for (const deviceData of devicesData) {
      const { _id: oldId, createdAt: dCreatedAt, updatedAt: dUpdatedAt, projectId, boundToSwitch, boundToNVR, boundToProcessor, ...deviceFields } = deviceData;
      
      deviceIdMap[oldId] = null; // Will be filled after creation
      
      devicesToCreate.push({
        ...deviceFields,
        projectId: newProject._id,
        // Store old binding IDs temporarily for second pass
        _oldBoundToSwitch: boundToSwitch,
        _oldBoundToNVR: boundToNVR,
        _oldBoundToProcessor: boundToProcessor,
        _oldId: oldId,
      });
    }
    
    // Create all devices
    const createdDevices = [];
    for (const deviceData of devicesToCreate) {
      const { _oldBoundToSwitch, _oldBoundToNVR, _oldBoundToProcessor, _oldId, ...cleanDeviceData } = deviceData;
      const newDevice = await Device.create(cleanDeviceData);
      deviceIdMap[_oldId] = newDevice._id;
      createdDevices.push({
        device: newDevice,
        oldBoundToSwitch: _oldBoundToSwitch,
        oldBoundToNVR: _oldBoundToNVR,
        oldBoundToProcessor: _oldBoundToProcessor,
      });
    }
    
    // Second pass: update bindings with new IDs
    for (const { device, oldBoundToSwitch, oldBoundToNVR, oldBoundToProcessor } of createdDevices) {
      const updates = {};
      
      if (oldBoundToSwitch) {
        const oldSwitchId = typeof oldBoundToSwitch === 'object' ? oldBoundToSwitch._id : oldBoundToSwitch;
        if (deviceIdMap[oldSwitchId]) {
          updates.boundToSwitch = deviceIdMap[oldSwitchId];
        }
      }
      
      if (oldBoundToNVR) {
        const oldNvrId = typeof oldBoundToNVR === 'object' ? oldBoundToNVR._id : oldBoundToNVR;
        if (deviceIdMap[oldNvrId]) {
          updates.boundToNVR = deviceIdMap[oldNvrId];
        }
      }
      
      if (oldBoundToProcessor) {
        const oldProcId = typeof oldBoundToProcessor === 'object' ? oldBoundToProcessor._id : oldBoundToProcessor;
        if (deviceIdMap[oldProcId]) {
          updates.boundToProcessor = deviceIdMap[oldProcId];
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await Device.findByIdAndUpdate(device._id, updates);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Project imported successfully with ${createdDevices.length} devices`,
      projectId: newProject._id,
      projectName: newProject.name,
    });

  } catch (error) {
    console.error('JSON import error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
