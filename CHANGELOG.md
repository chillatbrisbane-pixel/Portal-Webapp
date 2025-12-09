# Portal v23-fixed38 Changelog

## What's New in This Update

### Bug Fixes from v23-fixed37
- **Backup API**: Fixed "failed to fetch" error - was pointing to localhost instead of production server
- **Backend**: Added `intercom` and `user-interface` categories to Device model (was causing validation error)
- **DVR Option**: Removed from Camera dropdown (kept in backend for existing data)

### New Project Wizard Improvements
- **Switch Port Count**: Now asks how many ports (8/16/24/48) when adding switches
- **PDU Outlet Count**: Now asks how many outlets (4/6/8/10/12) when adding PDUs  
- **Camera Connection**: Choose whether cameras connect to Network Switch or direct to NVR
- **Fixed Categories**: PDU now goes to Power category, HVAC Controller to HVAC category
- **Touch Panels**: Correctly added to Control System category

### Device List Improvements
- **Category Order**: Network now appears at top, followed by Cameras, Security, etc.
- **Network Device Order**: Within Networking, devices sorted: Router → Switches → WAPs → Cloudkey
- **New Categories in Filter**: Intercom and User Interfaces now in dropdown

### New Device Categories (from v37)
- **🔔 Intercom** - Door Stations (Ubiquiti, 2N, Doorbird, Hikvision, Dahua)
- **📱 User Interfaces** - Touch Panels & Hand Held Remotes

### New Brands Added (from v37)
- **Cameras**: Ubiquiti
- **Security > Alarm**: Dahua, Ajax

### Project Header (from v37)
- **State & Postcode** fields for addresses
- **Project Manager** name & phone (green banner)
- **Site Lead** name & phone (green banner)
- **WiFi passwords** hidden by default with 👁️ Show / 🙈 Hide toggle

### Dashboard (from v37)
- Now defaults to **In Progress** projects view

### Admin Backup & Restore (from v37)
In Settings (admin only):
- **Export** - Download all projects, devices & tasks as JSON
- **Import** - Restore from backup file

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed38.zip
pm2 restart all
cd frontend && npm run build
```

## Notes
- Existing DVR devices will still work, but DVR option is hidden from new device dropdown
- Touch Panels can be added to either User Interfaces or Control System (both work)

