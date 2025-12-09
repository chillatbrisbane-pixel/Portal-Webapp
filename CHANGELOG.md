# Portal v23-fixed39 Changelog

## What's New in This Update

### 🐛 Bug Fixes
- **Backup API Fixed** - Changed from absolute localhost URL to relative `/api/backup` path
  - ⚠️ **IMPORTANT**: You MUST run `npm run build` after deploying to fix this error!

### 🔀 Network Device Ordering
- Order is now: **Router → Cloudkey → Switches → WAPs**
- Cloudkey (WiFi manager) now appears right after router, before switches

### 🔧 Switch Configuration in Wizard (Enhanced)
When adding switches via the New Project Wizard:

**Single Switch:**
- Select Port Count (8/16/24/48)
- Select PoE Type (No PoE, PoE, PoE+, PoE++)

**Multiple Switches:**
- Configure EACH switch individually
- Each switch gets its own Port Count and PoE Type selection
- Example: Switch 1 = 48-port PoE++, Switch 2 = 24-port PoE+, Switch 3 = 8-port No PoE

### Previous v38 Features
- PDU Outlet Count selection in wizard
- Camera connection choice (Switch vs NVR)
- Fixed category mapping (PDU→Power, HVAC→HVAC)
- New categories: Intercom, User Interfaces
- Project Manager & Site Lead in header
- WiFi password hide/show toggle
- Admin backup/restore

---

## ⚠️ CRITICAL: How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed39.zip
pm2 restart all

# THIS STEP IS REQUIRED to fix the backup error:
cd frontend && npm run build
```

The backup error occurs because the browser is still using the OLD compiled JavaScript. Running `npm run build` creates new compiled files with the fix.

---

## Summary of All Category/Device Ordering

**Categories (top to bottom):**
1. 🔗 Networking
2. 📹 Cameras
3. 🔒 Security
4. 🔔 Intercom
5. 📱 User Interfaces
6. 🎛️ Control System
7. 💡 Lighting
8. 📺 AV Equipment
9. 🔌 Power
10. ❄️ HVAC Control
11. 📦 Other

**Network devices (top to bottom):**
1. Router
2. Cloudkey
3. Switches
4. WAPs

