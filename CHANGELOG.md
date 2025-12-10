# Portal v23-fixed42 Changelog

## What's New in This Update

### 🔒 Security > Alarm Panel > Dialler Enhancements
New fields added when "Alarm Dialler Installed" is checked:
- **Account Number** - Monitoring account number
- **Monitoring Company** details:
  - Company Name
  - Phone
  - Email
  - Address

These details are displayed in a highlighted green section for easy visibility.

### 📄 PDF Handover Report Redesign

**New Title:**
- Changed from "Smart Home System Documentation" to **"Integrated System Profile"**
- Added subtitle: *"Technical Reference for Devices, Network, and Infrastructure"*

**Electronic Living Branding:**
- Logo displayed at top of cover page
- "Prepared by Electronic Living" footer with website
- Updated author metadata

**Monitoring Company in PDF:**
- Security devices with diallers now show monitoring company info in the PDF report

### Previous Features (v41)
- Networking wizard with Routers + Switches
- Touch Panels → User Interfaces category
- Category order: Networking → Security → Cameras → Control System → User Interfaces → Intercom → Lighting → Power → HVAC → AV → Other
- Network device order: Router → Cloudkey → Switches → WAPs

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed42.zip
pm2 restart all
cd frontend && npm run build
```

