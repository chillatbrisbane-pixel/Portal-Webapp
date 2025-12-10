# Portal v23-fixed44 Changelog

## What's New in This Update

### 🎨 Company Branding Settings (Admin Only)

New **Branding** tab in Settings allows admins to customize PDF reports:

**Company Details:**
- Company Name (appears in PDF footer and support page)
- Website URL (appears in PDF footer and support page)

**Logo Upload:**
- PNG/JPEG support (max 2MB)
- Displayed at top of PDF cover page
- Preview shown in settings
- Remove button to clear logo

**Background Watermark:**
- Optional image displayed faded behind PDF content
- PNG/JPEG support (max 5MB)
- Adjustable opacity (5% to 30%)
- Preview with opacity applied
- Remove button to clear background

### 📄 PDF Report Updates
- Cover page now uses custom logo if uploaded
- Background watermark appears on cover page
- Company name and website from settings shown in footer
- Support page uses company name/website from settings

### Previous Features (v43)
- Alarm dialler account number and monitoring company fields
- "Integrated System Profile" PDF title
- Networking wizard with Routers + Switches

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed44.zip
pm2 restart all
cd frontend && npm run build
```

