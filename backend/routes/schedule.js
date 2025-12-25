const express = require('express');
const router = express.Router();
const ScheduleEntry = require('../models/ScheduleEntry');
const TechnicianGroup = require('../models/TechnicianGroup');
const PublicHoliday = require('../models/PublicHoliday');
const User = require('../models/User');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/schedule - Get schedule grid for date range
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, technicianId, contractorId, projectId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const options = {};
    if (technicianId) options.technicianId = technicianId;
    if (contractorId) options.contractorId = contractorId;
    if (projectId) options.projectId = projectId;
    
    const entries = await ScheduleEntry.getScheduleGrid(start, end, options);
    const holidays = await PublicHoliday.getHolidaysInRange(start, end, 'QLD');
    
    res.json({ entries, holidays });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/schedule/groups - Get technician groups with members
router.get('/groups', async (req, res) => {
  try {
    const groups = await TechnicianGroup.getGroupsWithMembers();
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/schedule/techs - Get all users who can be scheduled (for groups management)
router.get('/techs', async (req, res) => {
  try {
    const users = await User.find({ 
      isActive: true,
      suspended: { $ne: true },
      role: { $in: ['admin', 'project-manager', 'project-coordinator', 'tech'] }
    }).select('name email role').sort({ name: 1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching techs:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

// GET /api/schedule/tech/:techId - Get schedule for specific tech
router.get('/tech/:techId', async (req, res) => {
  try {
    const { techId } = req.params;
    const { startDate, endDate } = req.query;
    
    const query = { technician: techId };
    
    if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    } else {
      // Default to next 14 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoWeeks = new Date(today);
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      query.date = { $gte: today, $lte: twoWeeks };
    }
    
    const entries = await ScheduleEntry.find(query)
      .populate('project', 'name clientName address')
      .populate('task', 'title completed')
      .sort({ date: 1, timeSlot: 1 });
    
    res.json(entries);
  } catch (error) {
    console.error('Error fetching tech schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/schedule/project/:projectId - Get schedule for specific project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    const query = { project: projectId };
    
    if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    } else {
      // Default: all future entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.date = { $gte: today };
    }
    
    const entries = await ScheduleEntry.find(query)
      .populate('technician', 'name email')
      .populate('contractor', 'name company')
      .sort({ date: 1, timeSlot: 1 });
    
    // Group by date
    const byDate = {};
    entries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(entry);
    });
    
    // Calculate summary
    const totalSlots = entries.length;
    const techsInvolved = [...new Set(entries.map(e => 
      e.technician?._id?.toString() || e.contractor?._id?.toString()
    ))].length;
    
    res.json({ entries, byDate, summary: { totalSlots, techsInvolved } });
  } catch (error) {
    console.error('Error fetching project schedule:', error);
    res.status(500).json({ error: 'Failed to fetch project schedule' });
  }
});

// GET /api/schedule/availability - Check who's available
router.get('/availability', async (req, res) => {
  try {
    const { date, slots } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const slotsToCheck = slots ? slots.split(',') : ['AM1', 'AM2', 'PM1', 'PM2'];
    
    // Get all booked entries for the date
    const booked = await ScheduleEntry.find({
      date: new Date(date),
      timeSlot: { $in: slotsToCheck }
    }).select('technician contractor timeSlot');
    
    // Get all techs from groups
    const groups = await TechnicianGroup.getGroupsWithMembers();
    
    const availability = [];
    
    for (const group of groups) {
      for (const member of group.members) {
        const techId = member.memberType === 'user' 
          ? member.user?._id?.toString() 
          : member.contractor?._id?.toString();
        
        const techName = member.memberType === 'user'
          ? member.user?.name
          : member.contractor?.name;
        
        if (!techId || !techName) continue;
        
        const bookedSlots = booked
          .filter(b => 
            (b.technician?.toString() === techId) || 
            (b.contractor?.toString() === techId)
          )
          .map(b => b.timeSlot);
        
        const freeSlots = slotsToCheck.filter(s => !bookedSlots.includes(s));
        
        availability.push({
          id: techId,
          name: techName,
          type: member.memberType,
          group: group.name,
          role: member.role,
          bookedSlots,
          freeSlots,
          isFullyAvailable: freeSlots.length === slotsToCheck.length,
          isPartiallyAvailable: freeSlots.length > 0 && freeSlots.length < slotsToCheck.length,
          isFullyBooked: freeSlots.length === 0
        });
      }
    }
    
    res.json(availability);
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// POST /api/schedule - Create single entry
router.post('/', authorizeRole(['admin', 'project-manager', 'project-coordinator']), async (req, res) => {
  try {
    const entry = new ScheduleEntry({
      ...req.body,
      createdBy: req.userId,
      updatedBy: req.userId
    });
    
    await entry.save();
    
    await entry.populate('technician', 'name email');
    await entry.populate('contractor', 'name company');
    await entry.populate('project', 'name clientName');
    
    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating schedule entry:', error);
    res.status(500).json({ error: error.message || 'Failed to create entry' });
  }
});

// POST /api/schedule/bulk - Bulk create/update entries
router.post('/bulk', authorizeRole(['admin', 'project-manager', 'project-coordinator']), async (req, res) => {
  try {
    const { entries, operation } = req.body;
    
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries array is required' });
    }
    
    const results = [];
    
    for (const entryData of entries) {
      if (operation === 'upsert') {
        const filter = {
          date: entryData.date,
          timeSlot: entryData.timeSlot
        };
        
        if (entryData.technician) {
          filter.technician = entryData.technician;
        } else if (entryData.contractor) {
          filter.contractor = entryData.contractor;
        }
        
        const update = {
          ...entryData,
          updatedBy: req.userId
        };
        
        const result = await ScheduleEntry.findOneAndUpdate(
          filter,
          { $set: update, $setOnInsert: { createdBy: req.userId } },
          { upsert: true, new: true }
        );
        
        results.push(result);
      } else if (operation === 'delete') {
        await ScheduleEntry.deleteOne({
          date: entryData.date,
          timeSlot: entryData.timeSlot,
          technician: entryData.technician
        });
        results.push({ deleted: true, ...entryData });
      } else {
        const entry = new ScheduleEntry({
          ...entryData,
          createdBy: req.userId,
          updatedBy: req.userId
        });
        await entry.save();
        results.push(entry);
      }
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ error: error.message || 'Failed to process bulk update' });
  }
});

// POST /api/schedule/copy - Copy entries from one date to another
router.post('/copy', authorizeRole(['admin', 'project-manager', 'project-coordinator']), async (req, res) => {
  try {
    const { sourceDate, targetDate, technicianId, slots } = req.body;
    
    if (!sourceDate || !targetDate || !technicianId) {
      return res.status(400).json({ error: 'sourceDate, targetDate, and technicianId are required' });
    }
    
    const query = {
      date: new Date(sourceDate),
      technician: technicianId
    };
    
    if (slots && slots.length > 0) {
      query.timeSlot = { $in: slots };
    }
    
    const sourceEntries = await ScheduleEntry.find(query);
    
    if (sourceEntries.length === 0) {
      return res.status(404).json({ error: 'No entries found to copy' });
    }
    
    // Check for existing entries on target date
    const existing = await ScheduleEntry.find({
      date: new Date(targetDate),
      technician: technicianId,
      timeSlot: { $in: sourceEntries.map(e => e.timeSlot) }
    });
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'Target date already has entries for some slots',
        conflictingSlots: existing.map(e => e.timeSlot)
      });
    }
    
    const newEntries = sourceEntries.map(e => ({
      date: new Date(targetDate),
      timeSlot: e.timeSlot,
      technician: e.technician,
      contractor: e.contractor,
      entryType: e.entryType,
      project: e.project,
      projectCode: e.projectCode,
      projectName: e.projectName,
      leaveType: e.leaveType,
      description: e.description,
      notes: e.notes,
      createdBy: req.userId,
      updatedBy: req.userId
    }));
    
    const created = await ScheduleEntry.insertMany(newEntries);
    
    res.status(201).json({ 
      message: `Copied ${created.length} entries`,
      entries: created 
    });
  } catch (error) {
    console.error('Error copying entries:', error);
    res.status(500).json({ error: 'Failed to copy entries' });
  }
});

// PUT /api/schedule/:id - Update entry
router.put('/:id', authorizeRole(['admin', 'project-manager', 'project-coordinator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await ScheduleEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    
    // Check if locked to simPRO
    if (entry.simpro?.status === 'locked') {
      return res.status(400).json({ 
        error: 'This entry is locked to simPRO. Unlock it first or edit in simPRO.' 
      });
    }
    
    Object.assign(entry, req.body, { updatedBy: req.userId });
    await entry.save();
    
    await entry.populate('technician', 'name email');
    await entry.populate('contractor', 'name company');
    await entry.populate('project', 'name clientName');
    
    res.json(entry);
  } catch (error) {
    console.error('Error updating schedule entry:', error);
    res.status(500).json({ error: error.message || 'Failed to update entry' });
  }
});

// DELETE /api/schedule/:id - Delete entry
router.delete('/:id', authorizeRole(['admin', 'project-manager', 'project-coordinator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await ScheduleEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    
    if (entry.simpro?.status === 'locked') {
      return res.status(400).json({ error: 'This entry is locked to simPRO. Unlock it first.' });
    }
    
    await entry.deleteOne();
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// POST /api/schedule/:id/lock - Lock to simPRO (future)
router.post('/:id/lock', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, notes } = req.body;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }
    
    const entry = await ScheduleEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    
    if (entry.simpro?.status === 'locked') {
      return res.status(400).json({ error: 'Entry is already locked' });
    }
    
    // TODO: Actually push to simPRO API here when integrated
    
    entry.simpro = {
      status: 'locked',
      startTime,
      endTime,
      lockedAt: new Date(),
      lockedBy: req.userId
    };
    
    if (notes) {
      entry.notes = notes;
    }
    
    await entry.save();
    
    res.json({ message: 'Entry locked to simPRO', entry });
  } catch (error) {
    console.error('Error locking to simPRO:', error);
    res.status(500).json({ error: 'Failed to lock to simPRO' });
  }
});

// POST /api/schedule/:id/unlock - Unlock from simPRO
router.post('/:id/unlock', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await ScheduleEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    
    if (entry.simpro?.status !== 'locked') {
      return res.status(400).json({ error: 'Entry is not locked' });
    }
    
    entry.simpro.status = 'unlinked';
    entry.updatedBy = req.userId;
    
    await entry.save();
    
    res.json({ message: 'Entry unlocked from simPRO', entry });
  } catch (error) {
    console.error('Error unlocking from simPRO:', error);
    res.status(500).json({ error: 'Failed to unlock from simPRO' });
  }
});

// ===== TECHNICIAN GROUPS MANAGEMENT =====

// POST /api/schedule/groups - Create a group
router.post('/groups', authorizeRole(['admin']), async (req, res) => {
  try {
    const group = new TechnicianGroup(req.body);
    await group.save();
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// PUT /api/schedule/groups/:id - Update a group
router.put('/groups/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const group = await TechnicianGroup.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/schedule/groups/:id - Delete a group
router.delete('/groups/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const group = await TechnicianGroup.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/schedule/groups/:id/members - Add member to group
router.post('/groups/:id/members', authorizeRole(['admin']), async (req, res) => {
  try {
    const { memberType, userId, contractorId, role } = req.body;
    
    const group = await TechnicianGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const id = memberType === 'user' ? userId : contractorId;
    await group.addMember(memberType, id, role);
    
    const updated = await TechnicianGroup.findById(req.params.id)
      .populate('members.user', 'name email role')
      .populate('members.contractor', 'name company category');
    
    res.json(updated);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/schedule/groups/:id/members/:memberId - Remove member from group
router.delete('/groups/:id/members/:memberId', authorizeRole(['admin']), async (req, res) => {
  try {
    const { memberType } = req.query;
    
    const group = await TechnicianGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    await group.removeMember(memberType || 'user', req.params.memberId);
    
    const updated = await TechnicianGroup.findById(req.params.id)
      .populate('members.user', 'name email role')
      .populate('members.contractor', 'name company category');
    
    res.json(updated);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PUT /api/schedule/groups/:id/reorder - Reorder members in group
router.put('/groups/:id/reorder', authorizeRole(['admin']), async (req, res) => {
  try {
    const { memberIds } = req.body;
    
    const group = await TechnicianGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    await group.reorderMembers(memberIds);
    
    res.json({ message: 'Members reordered' });
  } catch (error) {
    console.error('Error reordering members:', error);
    res.status(500).json({ error: 'Failed to reorder members' });
  }
});

// ===== PUBLIC HOLIDAYS =====

// GET /api/schedule/holidays - Get holidays
router.get('/holidays', async (req, res) => {
  try {
    const { year, state } = req.query;
    
    let startDate, endDate;
    if (year) {
      startDate = new Date(parseInt(year), 0, 1);
      endDate = new Date(parseInt(year), 11, 31);
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    const holidays = await PublicHoliday.getHolidaysInRange(startDate, endDate, state);
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// POST /api/schedule/holidays/seed - Seed holidays for a year
router.post('/holidays/seed', authorizeRole(['admin']), async (req, res) => {
  try {
    const { year } = req.body;
    if (!year) {
      return res.status(400).json({ error: 'year is required' });
    }
    
    await PublicHoliday.seedYear(parseInt(year));
    res.json({ message: `Holidays seeded for ${year}` });
  } catch (error) {
    console.error('Error seeding holidays:', error);
    res.status(500).json({ error: 'Failed to seed holidays' });
  }
});

module.exports = router;
