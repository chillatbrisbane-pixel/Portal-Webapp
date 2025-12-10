# Portal v23-fixed43 Changelog

## What's New in This Update

### 📄 PDF Report - Logo Removed
- Removed logo from cover page (placeholder for future branding)
- Kept all other PDF improvements:
  - Title: **"Integrated System Profile"**
  - Subtitle: *"Technical Reference for Devices, Network, and Infrastructure"*
  - Footer: "Prepared by Electronic Living" with website

### 🔒 Security > Alarm Panel > Dialler (from v42)
New fields when "Alarm Dialler Installed" is checked:
- **Account Number** - Monitoring account number
- **Monitoring Company** details:
  - Company Name
  - Phone
  - Email
  - Address

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed43.zip
pm2 restart all
cd frontend && npm run build
```

