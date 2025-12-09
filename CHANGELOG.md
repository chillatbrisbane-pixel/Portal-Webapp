# Portal v23-fixed37 Changelog

## What's New in This Update

### New Device Categories
- **Intercom** - New category for door communication systems
  - Door Stations moved here from Control System
  - Brands: 2N, Doorbird, Ubiquiti, Hikvision, Dahua, Control4, Crestron Home

- **User Interfaces** - New category for control interfaces
  - Touch Panels moved here from Control System  
  - Hand Held Remotes moved here from Control System
  - Brands: Control4, Crestron Home, RTI

### New Brand Options
- **Cameras**: Added Ubiquiti
- **Security > Alarm Panel**: Added Dahua and Ajax

### Project Improvements
- **Address Fields**: Added State dropdown (NSW, VIC, QLD, etc.) and Postcode
- **Team Display**: New green section in project header showing:
  - 👔 Project Manager (name & phone)
  - 🦺 Site Lead (name & phone)
- **WiFi Security**: Passwords now hidden by default with 👁️ Show/🙈 Hide toggle

### Dashboard Changes  
- **Default View**: Now shows "In Progress" projects instead of all projects
- **My Tasks**: Still shows your assigned tasks across all projects

### Task System (from previous update)
- Custom stages (columns) you create are now saved correctly
- Click ⚙️ Stages to add, rename, reorder, or delete columns
- Friendly color names in the color picker (Grey, Red, Yellow, etc.)

### Admin Features
- **Backup & Restore**: New tab in Settings (admin only)
  - 📥 Download Full Backup - exports all projects, devices, and tasks as JSON
  - 📂 Import Backup - restore from a backup file
  - Shows import results (created/skipped counts)

### Bug Fixes
- Task routes now load correctly (fixed auth middleware issue)
- Task creation works properly
- Custom task stages now save to the database

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed37.zip
pm2 restart all
cd frontend && npm run build
```

## Notes
- Existing door stations and touch panels will still work but may show under their old categories until re-saved
- The backup feature only works for admin users
- WiFi passwords can still be copied even when hidden
