# Portal v23-fixed41 Changelog

## What's New in This Update

### 🔗 Networking Wizard - Now with Routers!

The "Network Switches" tile in the Project Wizard is now **"Networking"** and includes:

**🌐 Routers Section:**
- Quantity (0-10)
- Brand (Ubiquiti, Araknis, Netgear, Cisco, MikroTik)
- Model (optional)

**🔀 Switches Section:**
- Quantity (0-20)
- Brand (Ubiquiti, Araknis, Netgear)
- Model (optional)
- Per-switch configuration: Port count + PoE type

Both routers and switches are created in the Networking category.

### 📱 Touch Panels Fixed (from v40)
Touch Panels now correctly go to **User Interfaces** category

### 📋 Category Order (from v40)
1. 🔗 Networking
2. 🔒 Security
3. 📹 Cameras
4. 🎛️ Control System
5. 📱 User Interfaces
6. 🔔 Intercom
7. 💡 Lighting
8. 🔌 Power
9. ❄️ HVAC Control
10. 📺 AV Equipment
11. 📦 Other

### 🔀 Network Device Order
Within Networking category: Router → Cloudkey → Switches → WAPs

---

## How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed41.zip
pm2 restart all
cd frontend && npm run build
```

**Remember**: Always run `npm run build` for frontend changes!

