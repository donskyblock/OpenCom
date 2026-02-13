# 🎯 Server Admin Panel - Quick Start Guide

## What Is This?

The **Server Admin Panel** is a web-based dashboard for self-hosted OpenCom servers. If you own a server, you can now:

✅ Manage guild members and their roles
✅ Create custom roles with permission levels
✅ Configure granular permissions (who can send messages, manage channels, etc.)
✅ View real-time guild information
✅ Modify settings for multiple servers from one dashboard

## How to Access

### Option 1: From the Main App (Easiest)
1. Open OpenCom in your browser
2. Click the **⚙️ Settings** button (bottom left)
3. **If you own servers**, you'll see a button at the bottom:
   ```
   🔧 Server Admin Panel
   ```
4. Click it and it opens in a new window

### Option 2: Direct URL
Go directly to:
```
https://your-opencom-instance.com/server-admin.html
```

## Using the Panel

### Step 1: Select Your Server
The left sidebar shows all servers you own. Click one to select it.

### Step 2: Select a Guild
A dropdown appears showing all guilds on that server. Pick the one you want to manage.

### Step 3: Manage Members, Roles, or View Admin Info
Three tabs appear at the top:

#### 👥 MEMBERS TAB
- See all guild members in a grid
- Each card shows: profile picture, name, current roles
- Click **"➕ Add Role"** to assign a role to a member
- Click a **role badge** to quickly remove that role
- Profile pictures auto-display or show initials

#### 📋 ROLES TAB
- **Create New Role**: Type a name and click Create
- **Edit Permissions**: Click "Edit Permissions" on any role
- Check/uncheck boxes for each permission
- Click Save to apply changes
- See role position in the hierarchy

#### 🔑 ADMIN TAB
- Coming in the next update!

## Examples

### Example: Add an Admin Role to Someone

1. Create the role (Roles tab → Create New Role → "Server Admin")
2. Go to Members tab
3. Find the person
4. Click "➕ Add Role"
5. Select "Server Admin"
6. Click "✓ Assign Role"

Done! Now that person has all permissions you configured for the "Server Admin" role.

### Example: Create a Moderator Role

1. Go to Roles tab
2. Type in "Moderator"
3. Click Create
4. Click "Edit Permissions" on the new Moderator role
5. Check these boxes:
   - ✓ KICK_MEMBERS
   - ✓ BAN_MEMBERS
   - ✓ MUTE_MEMBERS
6. (Optional) Check MANAGE_MESSAGES, MANAGE_CHANNELS, etc.
7. Click Save

Now you can assign the "Moderator" role to anyone and they'll have those powers!

## Permission Reference

When editing a role, here's what each permission does:

| Permission | Effect |
|-----------|---------|
| **VIEW_CHANNEL** | Can see and access channels |
| **SEND_MESSAGES** | Can post messages |
| **MANAGE_CHANNELS** | Can create/delete channels, change names |
| **MANAGE_ROLES** | Can create/edit roles (respects hierarchy) |
| **KICK_MEMBERS** | Can remove members from guild |
| **BAN_MEMBERS** | Can permanently ban members |
| **MUTE_MEMBERS** | Can silence members in voice |
| **DEAFEN_MEMBERS** | Can deafen members in voice |
| **MOVE_MEMBERS** | Can move members between voice channels |
| **CONNECT** | Can join voice channels |
| **SPEAK** | Can use microphone in voice |
| **ATTACH_FILES** | Can upload files/media |
| **ADMINISTRATOR** | Bypass all other permissions ⚠️ |

## Important Notes

⚠️ **Role Hierarchy**: You can't edit roles higher than your top role. The @everyone role can't be edited except for permissions.

⚠️ **ADMINISTRATOR**: This permission overrides all others. Use sparingly!

⚠️ **Changes are live**: When you save, changes apply immediately to everyone.

## Troubleshooting

### "Not authenticated" message
- Make sure you're logged into OpenCom first
- Try logging out and back in from the main app

### No servers showing
- You must own at least one server
- Check that your account has the "owner" role

### Settings aren't saving
- Check your internet connection
- Open DevTools (F12) and check the Console tab for errors
- Try refreshing the page

### Guild data won't load
- Make sure the server Node is online
- Check the server base URL is correct
- Try selecting a different guild and back

## Tips & Tricks

💡 **Assign multiple roles**: Members can have multiple roles. A member can be both "Moderator" and "Community Manager"!

💡 **Permissions stack**: If someone has multiple roles, they get all permissions from all roles (highest permission wins)

💡 **Use role colors**: In future versions, roles will have color codes. For now, names are key!

💡 **Backup your config**: If you have important permission setups, take screenshots of role permissions

💡 **Keep organization**: Create roles with clear names like "Moderator", "Trusted", "Bot", etc.

## Need Help?

- Check the full documentation: [SERVER_ADMIN_GUIDE.md](./SERVER_ADMIN_GUIDE.md)
- See what's coming: [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)
- Found a bug? Report it to the OpenCom team

---

**Enjoy managing your server! 🚀**

