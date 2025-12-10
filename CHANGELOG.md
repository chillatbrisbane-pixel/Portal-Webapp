# Portal v23-fixed45 Changelog

## Bug Fix

**Fixed server crash on startup** - The Settings model was using Mongoose's reserved `type` keyword incorrectly, causing the backend to fail to load. Now uses `Mixed` schema type for flexibility.

## Features (from v44)

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

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed45.zip
pm2 restart all
cd frontend && npm run build
```

