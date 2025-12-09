# Portal v23-fixed40 Changelog

## What's New in This Update

### 🐛 Bug Fixes
- **Touch Panels** now correctly go to **User Interfaces** category (was going to Control System)

### 📋 New Category Order
Categories now display in this order:
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

### ✅ Verified Wizard Device → Category Mappings

| Wizard Option | Device Type | Category |
|---------------|-------------|----------|
| Network Switches | switch | Networking |
| Wireless Access Points | access-point | Networking |
| Security Cameras | camera | Cameras |
| NVR | nvr | Cameras |
| Security Panel | alarm-panel | Security |
| Control System | control-processor | Control System |
| Touch Panels | touch-panel | **User Interfaces** |
| Lighting Gateway | lighting-gateway | Lighting |
| HVAC Control | hvac-controller | HVAC |
| AV Receivers | receiver | AV |
| Multiroom Audio | audio-matrix | AV |
| Video Distribution | video-matrix | AV |
| TVs/Displays | tv | AV |
| Power / PDU | pdu | Power |

### 🔀 Network Device Order (within Networking)
1. Router
2. Cloudkey
3. Switches
4. WAPs

---

## Previous Fixes (v39)
- Backup API uses relative URL (no more localhost error)
- Enhanced switch config: per-switch port count & PoE type

---

## ⚠️ How to Deploy

```bash
cd /home/app/Portal-Webapp
unzip -o Portal-Webapp-v23-fixed40.zip
pm2 restart all
cd frontend && npm run build
```

**Remember**: You MUST run `npm run build` for changes to take effect!

