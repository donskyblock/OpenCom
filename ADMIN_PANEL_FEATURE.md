## Server Admin Panel (v1.0)

OpenCom now includes a comprehensive web-based admin panel for self-hosted server owners. Manage your guild members, create and configure roles, and set granular permissions—all from a beautiful, intuitive UI.

### What You Can Do

✅ **Manage Members**: View all guild members, assign roles, see who has what permissions
✅ **Create Roles**: Custom roles with names and colors  
✅ **Configure Permissions**: 13 granular permission flags (MANAGE_ROLES, KICK_MEMBERS, SPEAK, etc.)
✅ **Hierarchy System**: Discord-style role hierarchy prevents permission abuse
✅ **Live Updates**: Changes apply immediately across the platform

### Getting Started

1. **Login** to your OpenCom instance
2. **Open Settings** (⚙️ button in the main app)
3. **Scroll to the bottom** - If you own servers, you'll see **"🔧 Server Admin Panel"**
4. **Click to open** the admin panel in a new window

### Accessing via URL

You can also access directly at:
```
https://your-opencom-instance.com/server-admin.html
```

### Quick Tips

- **Member roles**: Click "➕ Add Role" on any member to assign them a role
- **Remove roles**: Click the role badge to quickly remove it
- **Edit permissions**: Select a role and click "Edit Permissions" to customize exactly what that role can do
- **Create roles**: Use the "Create New Role" section to add custom roles
- **Multi-guild support**: Switch between guilds in the dropdown at the top

### Features

- 👥 Full member roster with real-time updates
- 📋 Unlimited custom roles with permission control
- 🔐 13 distinct permissions including voice controls
- 🎨 Role-based access control system
- ⚙️ Granular permission editor
- 📊 Responsive grid layout supporting any number of members/roles

### Security

- Only server owners can access the admin panel
- All changes require proper authentication
- Permissions are validated server-side
- Role hierarchy prevents unauthorized elevation

### Support

For issues or feature requests, check the [SERVER_ADMIN_GUIDE.md](./SERVER_ADMIN_GUIDE.md) for detailed documentation and troubleshooting.

---

**Note**: This is v1.0 with core functionality. Coming soon: Audit logs, ban management, server settings, and more!
