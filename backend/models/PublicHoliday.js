const mongoose = require('mongoose');

const publicHolidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // State-specific holidays (null = national)
  state: {
    type: String,
    enum: ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT', null],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for date range queries with state
publicHolidaySchema.index({ date: 1, state: 1 });

// Static method to get holidays for a date range
publicHolidaySchema.statics.getHolidaysInRange = async function(startDate, endDate, state = null) {
  const query = {
    date: { $gte: startDate, $lte: endDate },
    isActive: true
  };
  
  // Include national holidays (state: null) and state-specific
  if (state) {
    query.$or = [
      { state: null },
      { state: state }
    ];
  }
  
  return this.find(query).sort({ date: 1 });
};

// Static method to check if a specific date is a holiday
publicHolidaySchema.statics.isHoliday = async function(date, state = null) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const query = {
    date: { $gte: startOfDay, $lte: endOfDay },
    isActive: true
  };
  
  if (state) {
    query.$or = [
      { state: null },
      { state: state }
    ];
  }
  
  return this.findOne(query);
};

// Static method to seed Australian public holidays for a year
publicHolidaySchema.statics.seedYear = async function(year) {
  // Calculate Easter dates (Computus algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easterSunday = new Date(year, month, day);
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(goodFriday.getDate() - 2);
  const easterSaturday = new Date(easterSunday);
  easterSaturday.setDate(easterSaturday.getDate() - 1);
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterMonday.getDate() + 1);
  
  // Second Monday of June for QLD Queen's Birthday
  const junFirst = new Date(year, 5, 1);
  const dayOfWeek = junFirst.getDay();
  const firstMonday = dayOfWeek === 0 ? 2 : (dayOfWeek === 1 ? 1 : 9 - dayOfWeek);
  const queensBirthdayQLD = new Date(year, 5, firstMonday + 7);
  
  const holidays = [
    // National holidays
    { date: new Date(year, 0, 1), name: "New Year's Day", state: null },
    { date: new Date(year, 0, 26), name: 'Australia Day', state: null },
    { date: goodFriday, name: 'Good Friday', state: null },
    { date: easterSaturday, name: 'Easter Saturday', state: null },
    { date: easterMonday, name: 'Easter Monday', state: null },
    { date: new Date(year, 3, 25), name: 'Anzac Day', state: null },
    { date: new Date(year, 11, 25), name: 'Christmas Day', state: null },
    { date: new Date(year, 11, 26), name: 'Boxing Day', state: null },
    
    // QLD-specific
    { date: queensBirthdayQLD, name: "Queen's Birthday", state: 'QLD' },
  ];
  
  // Use upsert to avoid duplicates
  const operations = holidays.map(h => ({
    updateOne: {
      filter: { date: h.date, name: h.name },
      update: { $set: h },
      upsert: true
    }
  }));
  
  return this.bulkWrite(operations);
};

module.exports = mongoose.model('PublicHoliday', publicHolidaySchema);
