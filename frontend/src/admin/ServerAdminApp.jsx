import { useEffect, useState } from "react";

const CORE_API = import.meta.env.VITE_CORE_API_URL || "https://openapi.donskyblock.xyz";

async function api(path, token, options = {}) {
  const response = await fetch(`${CORE_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP_${response.status}`);
  }

  return response.json();
}

async function nodeApi(baseUrl, path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP_${response.status}`);
  }

  return response.json();
}

const PERMISSION_FLAGS = {
  VIEW_CHANNEL: { bit: 1n << 0n, name: "View Channels" },
  SEND_MESSAGES: { bit: 1n << 1n, name: "Send Messages" },
  MANAGE_CHANNELS: { bit: 1n << 2n, name: "Manage Channels" },
  MANAGE_ROLES: { bit: 1n << 3n, name: "Manage Roles" },
  KICK_MEMBERS: { bit: 1n << 4n, name: "Kick Members" },
  BAN_MEMBERS: { bit: 1n << 5n, name: "Ban Members" },
  MUTE_MEMBERS: { bit: 1n << 6n, name: "Mute Members" },
  DEAFEN_MEMBERS: { bit: 1n << 7n, name: "Deafen Members" },
  MOVE_MEMBERS: { bit: 1n << 8n, name: "Move Members" },
  CONNECT: { bit: 1n << 9n, name: "Connect (Voice)" },
  SPEAK: { bit: 1n << 10n, name: "Speak (Voice)" },
  ATTACH_FILES: { bit: 1n << 11n, name: "Attach Files" },
  ADMINISTRATOR: { bit: 1n << 60n, name: "Administrator" }
};

function hasPermission(permBits, flag) {
  const bits = BigInt(permBits || "0");
  return (bits & PERMISSION_FLAGS[flag].bit) === PERMISSION_FLAGS[flag].bit;
}

export function ServerAdminApp() {
  const [token, setToken] = useState(localStorage.getItem("opencom_access_token") || "");
  const [status, setStatus] = useState("");
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [guilds, setGuilds] = useState([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [guildState, setGuildState] = useState(null);
  
  // Member management
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRoles, setMemberRoles] = useState([]);
  
  // Role management
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePermissions, setEditRolePermissions] = useState({});
  
  // Admin promotion
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!token) {
      setStatus("Not authenticated. Please log in first.");
      return;
    }
    loadServers();
  }, [token]);

  useEffect(() => {
    loadGuilds();
  }, [selectedServerId, servers]);

  useEffect(() => {
    loadGuildState();
  }, [selectedGuildId, selectedServerId, servers]);

  async function loadServers() {
    try {
      const data = await api("/v1/servers", {}, { headers: { Authorization: `Bearer ${token}` } });
      const ownedServers = data.servers.filter(s => s.roles.includes("owner"));
      setServers(ownedServers);
      if (ownedServers.length > 0) {
        setSelectedServerId(ownedServers[0].id);
      }
      setStatus("Servers loaded.");
    } catch (e) {
      setStatus(`Failed to load servers: ${e.message}`);
    }
  }

  async function loadGuilds() {
    if (!selectedServerId) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      const guildsData = await nodeApi(server.baseUrl, "/v1/guilds", server.membershipToken);
      setGuilds(guildsData || []);
      if (guildsData && guildsData.length > 0) {
        setSelectedGuildId(guildsData[0].id);
      }
      setStatus("Guilds loaded.");
    } catch (e) {
      setStatus(`Failed to load guilds: ${e.message}`);
    }
  }

  async function loadGuildState() {
    if (!selectedServerId || !selectedGuildId) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      const state = await nodeApi(server.baseUrl, `/v1/guilds/${selectedGuildId}/state`, server.membershipToken);
      setGuildState(state);
      setMembers(state.members || []);
      setRoles(state.roles || []);
      setStatus("Guild state loaded.");
    } catch (e) {
      setStatus(`Failed to load guild: ${e.message}`);
    }
  }

  async function createRole() {
    if (!selectedServerId || !selectedGuildId || !newRoleName.trim()) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      await nodeApi(server.baseUrl, `/v1/guilds/${selectedGuildId}/roles`, server.membershipToken, {
        method: "POST",
        body: JSON.stringify({ name: newRoleName.trim(), permissions: "0" })
      });
      setNewRoleName("");
      await loadGuildState();
      setStatus("Role created successfully.");
    } catch (e) {
      setStatus(`Failed to create role: ${e.message}`);
    }
  }

  async function updateRolePermissions() {
    if (!selectedServerId || !editingRoleId) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      
      let permBits = 0n;
      for (const [flag, enabled] of Object.entries(editRolePermissions)) {
        if (enabled) {
          permBits = permBits | PERMISSION_FLAGS[flag].bit;
        }
      }
      
      await nodeApi(server.baseUrl, `/v1/roles/${editingRoleId}`, server.membershipToken, {
        method: "PATCH",
        body: JSON.stringify({ name: editRoleName, permissions: permBits.toString() })
      });
      setEditingRoleId("");
      await loadGuildState();
      setStatus("Role permissions updated.");
    } catch (e) {
      setStatus(`Failed to update role: ${e.message}`);
    }
  }

  function openRoleEditor(role) {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    const perms = {};
    for (const [flag] of Object.entries(PERMISSION_FLAGS)) {
      perms[flag] = hasPermission(role.permissions, flag);
    }
    setEditRolePermissions(perms);
  }

  async function assignRoleToMember() {
    if (!selectedServerId || !selectedGuildId || !selectedMemberId || !memberRoles.length) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      
      // Use the first selected role
      const roleId = memberRoles[0];
      await nodeApi(server.baseUrl, `/v1/guilds/${selectedGuildId}/members/${selectedMemberId}/roles/${roleId}`, server.membershipToken, {
        method: "PUT"
      });
      setMemberRoles([]);
      setSelectedMemberId("");
      await loadGuildState();
      setStatus("Role assigned to member.");
    } catch (e) {
      setStatus(`Failed to assign role: ${e.message}`);
    }
  }

  async function removeRoleFromMember(memberId, roleId) {
    if (!selectedServerId || !selectedGuildId) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      await nodeApi(server.baseUrl, `/v1/guilds/${selectedGuildId}/members/${memberId}/roles/${roleId}`, server.membershipToken, {
        method: "DELETE"
      });
      await loadGuildState();
      setStatus("Role removed from member.");
    } catch (e) {
      setStatus(`Failed to remove role: ${e.message}`);
    }
  }

  async function searchUsers() {
    if (!searchUsername.trim() || !selectedServerId) return;
    try {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) return;
      const data = await api(`/v1/users/search?query=${encodeURIComponent(searchUsername.trim())}`, {
        method: "GET"
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSearchResults(data.users || []);
    } catch (e) {
      setStatus(`Search failed: ${e.message}`);
    }
  }

  const selectedServer = servers.find(s => s.id === selectedServerId);

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Server Admin Panel</h1>
          <p>You need to log in to access the server admin dashboard.</p>
          <p className="hint">Please log in through the main OpenCom app first.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar - Servers List */}
      <aside style={{ width: "280px", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>🔧 Server Admin</h2>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          <p style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "8px" }}>Your Servers</p>
          {servers.length === 0 ? (
            <p style={{ color: "var(--text-dim)" }}>No servers owned</p>
          ) : (
            servers.map(server => (
              <button
                key={server.id}
                onClick={() => {
                  setSelectedServerId(server.id);
                  setSelectedGuildId("");
                  setActiveTab("members");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px",
                  marginBottom: "8px",
                  background: selectedServerId === server.id ? "var(--bg-hover)" : "transparent",
                  border: "1px solid transparent",
                  borderRadius: "var(--radius)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <strong>{server.name}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-dim)" }}>{server.baseUrl}</p>
              </button>
            ))
          )}
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0 }}>{status}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedServer ? (
          <>
            {/* Header */}
            <header style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
              <h1 style={{ margin: "0 0 8px 0" }}>{selectedServer.name}</h1>
              <p style={{ margin: 0, color: "var(--text-dim)" }}>Manage members, roles, and permissions</p>
              {guilds.length > 0 && (
                <select value={selectedGuildId} onChange={e => setSelectedGuildId(e.target.value)} style={{ marginTop: "8px", padding: "6px 8px", borderRadius: "4px", background: "var(--bg-input)", color: "var(--text-main)", border: "1px solid var(--border-subtle)" }}>
                  {guilds.map(guild => (
                    <option key={guild.id} value={guild.id}>{guild.name}</option>
                  ))}
                </select>
              )}
            </header>

            {/* Content */}
            {!selectedGuildId ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
                <p>Select a guild to manage</p>
              </div>
            ) : guildState ? (
              <>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: "8px" }}>
                  <button onClick={() => setActiveTab("members")} style={{ flex: 1, padding: "8px 12px", background: activeTab === "members" ? "var(--bg-accent)" : "transparent", border: "1px solid transparent", borderRadius: "var(--radius)", color: "var(--text-main)", cursor: "pointer" }}>
                    👥 Members ({members.length})
                  </button>
                  <button onClick={() => setActiveTab("roles")} style={{ flex: 1, padding: "8px 12px", background: activeTab === "roles" ? "var(--bg-accent)" : "transparent", border: "1px solid transparent", borderRadius: "var(--radius)", color: "var(--text-main)", cursor: "pointer" }}>
                    📋 Roles ({roles.filter(r => !r.is_everyone).length})
                  </button>
                  <button onClick={() => setActiveTab("admins")} style={{ flex: 1, padding: "8px 12px", background: activeTab === "admins" ? "var(--bg-accent)" : "transparent", border: "1px solid transparent", borderRadius: "var(--radius)", color: "var(--text-main)", cursor: "pointer" }}>
                    🔑 Admins
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                  {/* Members Tab */}
                  {activeTab === "members" && (
                    <section style={{ maxWidth: "1200px" }}>
                      <h2>Members ({members.length})</h2>
                      {members.length === 0 ? (
                        <p style={{ color: "var(--text-dim)" }}>No members in this guild</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
                          {members.map(member => {
                            // Find roles for this member from the state
                            const memberData = guildState?.members?.find(m => m.id === member.id);
                            return (
                              <div key={member.id} style={{ background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                                  {member.pfp_url ? (
                                    <img src={member.pfp_url} alt={member.username} style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                                  ) : (
                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bg-hover)", display: "grid", placeItems: "center", fontWeight: "bold" }}>
                                      {member.username[0]?.toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 600 }}>{member.username}</p>
                                    <p style={{ margin: 0, fontSize: "11px", color: "var(--text-dim)" }}>{member.id}</p>
                                  </div>
                                </div>

                                <div style={{ marginBottom: "12px" }}>
                                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 500 }}>Roles:</p>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                    {roles
                                      .filter(r => guildState?.me?.roleIds?.includes(r.id))
                                      .map(role => (
                                        <span key={role.id} style={{ background: `rgb(100, 150, 200)`, padding: "4px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", color: "white", userSelect: "none" }} onClick={() => removeRoleFromMember(member.id, role.id)} title="Click to remove">
                                          {role.name} ×
                                        </span>
                                      ))}
                                    {roles.filter(r => guildState?.me?.roleIds?.includes(r.id)).length === 0 && (
                                      <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>None</span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => setSelectedMemberId(selectedMemberId === member.id ? "" : member.id)}
                                  style={{
                                    width: "100%",
                                    padding: "6px 12px",
                                    background: selectedMemberId === member.id ? "var(--green)" : "var(--bg-accent)",
                                    border: "none",
                                    borderRadius: "4px",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                  }}
                                >
                                  {selectedMemberId === member.id ? "❌ Close" : "➕ Add Role"}
                                </button>

                                {selectedMemberId === member.id && (
                                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                                    <select
                                      value={memberRoles[0] || ""}
                                      onChange={e => setMemberRoles([e.target.value])}
                                      style={{ width: "100%", padding: "6px", marginBottom: "8px", borderRadius: "4px", background: "var(--bg-input)", color: "var(--text-main)", border: "1px solid var(--border-subtle)" }}
                                    >
                                      <option value="">Choose a role...</option>
                                      {roles.filter(r => !r.is_everyone).map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                      ))}
                                    </select>
                                    <button onClick={assignRoleToMember} style={{ width: "100%", padding: "6px 12px", background: "var(--green)", border: "none", borderRadius: "4px", color: "white", cursor: "pointer", fontSize: "12px" }}>
                                      ✓ Assign Role
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Roles Tab */}
                  {activeTab === "roles" && (
                    <section style={{ maxWidth: "1200px" }}>
                      <div style={{ marginBottom: "24px" }}>
                        <h2>Create New Role</h2>
                        <div style={{ display: "flex", gap: "8px", maxWidth: "400px" }}>
                          <input
                            type="text"
                            placeholder="Role name"
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", background: "var(--bg-input)", color: "var(--text-main)", border: "1px solid var(--border-subtle)" }}
                          />
                          <button onClick={createRole} style={{ padding: "8px 16px", background: "var(--bg-accent)", border: "none", borderRadius: "4px", color: "white", cursor: "pointer", fontWeight: "500" }}>
                            Create
                          </button>
                        </div>
                      </div>

                      <h2>Manage Roles</h2>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "12px" }}>
                        {roles.map(role => (
                          <div key={role.id} style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}>
                            {editingRoleId === role.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editRoleName}
                                  onChange={e => setEditRoleName(e.target.value)}
                                  disabled={role.is_everyone}
                                  style={{ width: "100%", padding: "8px 12px", marginBottom: "12px", borderRadius: "4px", background: "var(--bg-input)", color: "var(--text-main)", border: "1px solid var(--border-subtle)", opacity: role.is_everyone ? 0.5 : 1, cursor: role.is_everyone ? "not-allowed" : "text" }}
                                />
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "12px", maxHeight: "300px", overflowY: "auto" }}>
                                  {Object.entries(PERMISSION_FLAGS).map(([flag, { name }]) => (
                                    <label key={flag} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
                                      <input
                                        type="checkbox"
                                        checked={editRolePermissions[flag] || false}
                                        onChange={e => setEditRolePermissions({ ...editRolePermissions, [flag]: e.target.checked })}
                                        disabled={role.is_everyone}
                                        style={{ cursor: role.is_everyone ? "not-allowed" : "pointer" }}
                                      />
                                      <span>{name}</span>
                                    </label>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button onClick={updateRolePermissions} style={{ flex: 1, padding: "6px 12px", background: "var(--green)", border: "none", borderRadius: "4px", color: "white", cursor: "pointer", fontSize: "12px" }}>
                                    Save
                                  </button>
                                  <button onClick={() => setEditingRoleId("")} style={{ flex: 1, padding: "6px 12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-main)", cursor: "pointer", fontSize: "12px" }}>
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600 }}>
                                  {role.name}
                                  {role.is_everyone && <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "6px" }}>(Everyone)</span>}
                                </h3>
                                <p style={{ margin: "0 0 12px 0", fontSize: "11px", color: "var(--text-dim)" }}>Position: {role.position}</p>
                                <button onClick={() => openRoleEditor(role)} disabled={role.is_everyone} style={{ width: "100%", padding: "6px 12px", background: role.is_everyone ? "var(--text-dim)" : "var(--bg-accent)", border: "none", borderRadius: "4px", color: "white", cursor: role.is_everyone ? "not-allowed" : "pointer", fontSize: "12px", opacity: role.is_everyone ? 0.5 : 1 }}>
                                  Edit Permissions
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Admins Tab */}
                  {activeTab === "admins" && (
                    <section style={{ maxWidth: "800px" }}>
                      <h2>Server Admins</h2>
                      <div style={{ background: "rgba(125, 164, 255, 0.1)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid rgba(125, 164, 255, 0.2)", marginBottom: "24px" }}>
                        <p style={{ margin: "0 0 8px 0", fontWeight: 500 }}>💡 About Server Admins</p>
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>Server admins can manage roles, members, and guild settings. Use the Role Manager to assign admin roles to trusted members.</p>
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
                <p>Loading guild data...</p>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
            <p>Select a server to manage</p>
          </div>
        )}
      </main>
    </div>
  );
}
