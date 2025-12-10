const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Generate a secure calendar token for a user
const generateCalendarToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// GET /api/calendar/token - Get or generate calendar feed token for current user
router.get('/token', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new token if none exists
    if (!user.calendarToken) {
      user.calendarToken = generateCalendarToken();
      await user.save();
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const feedUrl = `${baseUrl}/api/calendar/feed/${user.calendarToken}`;

    res.json({
      token: user.calendarToken,
      feedUrl,
      instructions: [
        'To add to Outlook:',
        '1. Open Outlook Calendar',
        '2. Click "Add calendar" → "Subscribe from web"',
        '3. Paste the feed URL',
        '4. Name it "Portal Tasks"',
        '',
        'To add to Google Calendar:',
        '1. Open Google Calendar Settings',
        '2. Click "Add calendar" → "From URL"',
        '3. Paste the feed URL',
      ]
    });
  } catch (error) {
    console.error('Calendar token error:', error);
    res.status(500).json({ error: 'Failed to generate calendar token' });
  }
});

// POST /api/calendar/regenerate - Regenerate calendar token (invalidates old feed)
router.post('/regenerate', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.calendarToken = generateCalendarToken();
    await user.save();

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const feedUrl = `${baseUrl}/api/calendar/feed/${user.calendarToken}`;

    res.json({
      message: 'Calendar token regenerated. Update your calendar subscription with the new URL.',
      token: user.calendarToken,
      feedUrl,
    });
  } catch (error) {
    console.error('Calendar regenerate error:', error);
    res.status(500).json({ error: 'Failed to regenerate calendar token' });
  }
});

// Helper to escape ICS text
const escapeICS = (text) => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

// Helper to format date for ICS (YYYYMMDD or YYYYMMDDTHHMMSSZ)
const formatICSDate = (date, allDay = false) => {
  const d = new Date(date);
  if (allDay) {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
};

// GET /api/calendar/feed/:token - Public ICS feed (no auth, uses token)
router.get('/feed/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user by calendar token
    const user = await User.findOne({ calendarToken: token });
    if (!user) {
      return res.status(404).send('Invalid calendar feed');
    }

    // Get all incomplete tasks assigned to this user
    const tasks = await Task.find({
      assignee: user._id,
      completed: false,
    })
      .populate('project', 'name')
      .sort({ dueDate: 1 });

    // Build ICS file
    const now = new Date();
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Electronic Living//Portal Tasks//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Portal Tasks',
      'X-WR-TIMEZONE:Australia/Sydney',
    ];

    for (const task of tasks) {
      const uid = `task-${task._id}@portal.electronicliving.com.au`;
      const created = formatICSDate(task.createdAt);
      const modified = formatICSDate(task.updatedAt);
      
      // Use due date if set, otherwise created date
      let startDate, endDate;
      if (task.dueDate) {
        startDate = formatICSDate(task.dueDate, true); // All-day event
        // End date is next day for all-day events
        const nextDay = new Date(task.dueDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = formatICSDate(nextDay, true);
      } else {
        // No due date - skip or use created date?
        continue; // Skip tasks without due dates
      }

      const projectName = task.project?.name || 'Unknown Project';
      const priority = task.priority === 'high' ? '1' : task.priority === 'low' ? '9' : '5';
      const status = task.completed ? 'COMPLETED' : 'NEEDS-ACTION';

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:${uid}`);
      ics.push(`DTSTAMP:${formatICSDate(now)}`);
      ics.push(`DTSTART;VALUE=DATE:${startDate}`);
      ics.push(`DTEND;VALUE=DATE:${endDate}`);
      ics.push(`SUMMARY:${escapeICS(task.title)}`);
      ics.push(`DESCRIPTION:${escapeICS(`Project: ${projectName}\\n${task.description || ''}`)}`);
      ics.push(`LOCATION:${escapeICS(projectName)}`);
      ics.push(`PRIORITY:${priority}`);
      ics.push(`STATUS:${status}`);
      ics.push(`CREATED:${created}`);
      ics.push(`LAST-MODIFIED:${modified}`);
      
      // Add alarm for high priority tasks (1 day before)
      if (task.priority === 'high') {
        ics.push('BEGIN:VALARM');
        ics.push('ACTION:DISPLAY');
        ics.push(`DESCRIPTION:Task Due: ${escapeICS(task.title)}`);
        ics.push('TRIGGER:-P1D');
        ics.push('END:VALARM');
      }
      
      ics.push('END:VEVENT');
    }

    ics.push('END:VCALENDAR');

    // Send as ICS file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="portal-tasks.ics"');
    res.send(ics.join('\r\n'));

  } catch (error) {
    console.error('Calendar feed error:', error);
    res.status(500).send('Failed to generate calendar feed');
  }
});

module.exports = router;
