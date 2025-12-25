const express = require('express');
const router = express.Router();
const Contractor = require('../models/Contractor');
const TechnicianGroup = require('../models/TechnicianGroup');
const ScheduleEntry = require('../models/ScheduleEntry');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/contractors - Get all contractors
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    
    const query = {};
    if (active === 'true') query.isActive = true;
    if (active === 'false') query.isActive = false;
    
    const contractors = await Contractor.find(query)
      .sort({ displayOrder: 1, name: 1 });
    
    res.json(contractors);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// GET /api/contractors/:id - Get single contractor
router.get('/:id', async (req, res) => {
  try {
    const contractor = await Contractor.findById(req.params.id);
    
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    
    res.json(contractor);
  } catch (error) {
    console.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Failed to fetch contractor' });
  }
});

// GET /api/contractors/:id/schedule - Get contractor's schedule
router.get('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const query = { contractor: id };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const entries = await ScheduleEntry.find(query)
      .populate('project', 'name clientName')
      .sort({ date: 1, timeSlot: 1 });
    
    res.json(entries);
  } catch (error) {
    console.error('Error fetching contractor schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// POST /api/contractors - Create contractor (admin/PM only)
router.post('/', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const contractor = new Contractor(req.body);
    await contractor.save();
    
    // If groupId specified, add to group
    if (req.body.groupId) {
      const group = await TechnicianGroup.findById(req.body.groupId);
      if (group) {
        await group.addMember('contractor', contractor._id);
      }
    }
    
    res.status(201).json(contractor);
  } catch (error) {
    console.error('Error creating contractor:', error);
    res.status(500).json({ error: error.message || 'Failed to create contractor' });
  }
});

// PUT /api/contractors/:id - Update contractor
router.put('/:id', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const contractor = await Contractor.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    
    res.json(contractor);
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(500).json({ error: error.message || 'Failed to update contractor' });
  }
});

// DELETE /api/contractors/:id - Delete/deactivate contractor
router.delete('/:id', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    
    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    
    // Check for scheduled entries
    const entryCount = await ScheduleEntry.countDocuments({ contractor: id });
    
    if (hard === 'true') {
      // Hard delete - also remove schedule entries
      await ScheduleEntry.deleteMany({ contractor: id });
      
      // Remove from any groups
      await TechnicianGroup.updateMany(
        { 'members.contractor': id },
        { $pull: { members: { contractor: id } } }
      );
      
      await contractor.deleteOne();
      
      res.json({ 
        message: 'Contractor permanently deleted',
        entriesDeleted: entryCount
      });
    } else {
      // Soft delete
      contractor.isActive = false;
      await contractor.save();
      
      res.json({ 
        message: 'Contractor deactivated',
        scheduledEntries: entryCount
      });
    }
  } catch (error) {
    console.error('Error deleting contractor:', error);
    res.status(500).json({ error: 'Failed to delete contractor' });
  }
});

// POST /api/contractors/:id/reactivate - Reactivate contractor
router.post('/:id/reactivate', authorizeRole(['admin', 'project-manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const contractor = await Contractor.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );
    
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    
    res.json(contractor);
  } catch (error) {
    console.error('Error reactivating contractor:', error);
    res.status(500).json({ error: 'Failed to reactivate contractor' });
  }
});

module.exports = router;
