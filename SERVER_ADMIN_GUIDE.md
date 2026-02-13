# 🔧 OpenCom Server Admin Panel

A comprehensive web UI for self-hosted OpenCom server owners to manage their guilds, members, and role-based permissions.

## Features

### 👥 Member Management
- **View all guild members** with profile pictures and usernames
- **Assign roles** to members
- **Remove roles** from members with one click
- **Member cards** showing current roles and status

### 📋 Role Management
- **Create new roles** with custom names
- **Edit role permissions** with granular controls
- **Permission editor** with 13 different permission flags:
  - VIEW_CHANNEL
  - SEND_MESSAGES
  - MANAGE_CHANNELS
  - MANAGE_ROLES
  - KICK_MEMBERS
  - BAN_MEMBERS
  - MUTE_MEMBERS
  - DEAFEN_MEMBERS
  - MOVE_MEMBERS
  - CONNECT (Voice)
  - SPEAK (Voice)
  - ATTACH_FILES
  - ADMINISTRATOR (Override)

### 🔑 Server Admins (Coming Soon)
- Promote trusted members to admin roles
- Manage admin permissions separately

## Usage

### Accessing the Server Admin Panel

1. **From the main app**: Open Settings (⚙️) → Scroll to bottom → Click "🔧 Server Admin Panel" (only visible if you own servers)
2. **Direct URL**: Visit `/server-admin.html` in your OpenCom instance

### Prerequisites
- You must be logged in with an account that owns at least one server
- Your account must have the "owner" role on the server

### Getting Started

1. **Select a Server**: Choose from your owned servers in the left sidebar
2. **Select a Guild**: Pick which guild on that server you want to manage
3. **Navigate Tabs**: Switch between Members, Roles, and Admin tabs

## Technical Details

### Architecture

```
frontend/
├── server-admin.html            # HTML entry point
├── src/
│   ├── server-admin-main.jsx   # Vite entry point
│   └── admin/
│       └── ServerAdminApp.jsx   # Main React component
└── logo.png                     # Server logo
```

### API Integration

The admin panel integrates with:

- **Core API** (`/v1/servers`) - List owned servers
- **Node API** (`/v1/guilds/*`) - Guild and role management
  - `GET /v1/guilds` - List all guilds on a server
  - `GET /v1/guilds/:guildId/state` - Get detailed guild state
  - `POST /v1/guilds/:guildId/roles` - Create roles
  - `PATCH /v1/roles/:roleId` - Update role permissions
  - `PUT /v1/guilds/:guildId/members/:memberId/roles/:roleId` - Assign role
  - `DELETE /v1/guilds/:guildId/members/:memberId/roles/:roleId` - Remove role

### Permission Bits

Permissions are stored as 64-bit bigints following Discord-style permission structure:
- Bits 0-11: Basic permissions
- Bit 60: Administrator (override flag)

### State Management

Uses React hooks for state management:
- `useState` for UI state and data
- `useEffect` for loading data on server/guild selection
- Refs for API calls and data caching

## Styling

Uses the existing OpenCom stylesheet (`src/styles.css`) with custom inline styles for:
- Two-column layout (sidebar + main)
- Card-based UI for members and roles
- Grid layouts for responsive design
- Dark theme with OpenCom color scheme

## Security

- **Authentication**: All requests require valid JWT token
- **Authorization**: Only server owners can access the admin panel
- **CORS**: Node API requests go through the membership token system
- **Input Validation**: All user inputs validated before API calls

## Future Enhancements

- [ ] Bulk member management (multi-select)
- [ ] Role templates
- [ ] Permission presets
- [ ] Audit log viewing
- [ ] Ban/kick management
- [ ] Channel-specific overrides management
- [ ] Server settings (name, icon, etc.)
- [ ] Webhook management
- [ ] Invite creation and management from admin panel

## Troubleshooting

### "Not authenticated message"
- Make sure youre logged into OpenCom first
- Clear browser cache and localStorage
- Log out and back in

### Servers not showing
- Your account must own at least one server
- Check that your server membership includes the "owner" role

### Guilds not loading
- Ensure the server Node is running
- Check network tab in DevTools for errors
- Verify baseUrl of the server

### Permission changes not applying
- Refresh the guild state (select different guild then back)
- Wait a few seconds for websocket updates to propagate

