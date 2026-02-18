import { useEffect, useState } from "react";

const CORE_API = import.meta.env.VITE_CORE_API_URL || "https://api.opencom.online";

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
  const [memberQuery, setMemberQuery] = useState("");
  
  // Role management
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePermissions, setEditRolePermissions] = useState({});
  const [roleQuery, setRoleQuery] = useState("");
  
  // Admin promotion
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Extensions
  const [extensionCatalog, setExtensionCatalog] = useState({ clientExtensions: [], serverExtensions: [] });
  const [installedExtensions, setInstalledExtensions] = useState([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedServerId || !token) return;
    loadExtensionCatalog();
    loadInstalledExtensions(selectedServerId);
  }, [selectedServerId, token]);

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
        method: "PUT",
        body: "{}"
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


  async function loadExtensionCatalog() {
    try {
      const data = await api("/v1/extensions/catalog", token);
      setExtensionCatalog({
        clientExtensions: data.clientExtensions || [],
        serverExtensions: data.serverExtensions || []
      });
    } catch (e) {
      setStatus(`Failed to load extension catalog: ${e.message}`);
    }
  }

  async function loadInstalledExtensions(serverId) {
    setExtensionsLoading(true);
    try {
      const data = await api(`/v1/servers/${serverId}/extensions`, token);
      setInstalledExtensions(data.extensions || []);
    } catch (e) {
      setStatus(`Failed to load installed extensions: ${e.message}`);
      setInstalledExtensions([]);
    } finally {
      setExtensionsLoading(false);
    }
  }

  async function toggleExtension(extensionId, enabled) {
    if (!selectedServerId) return;
    try {
      await api(`/v1/servers/${selectedServerId}/extensions/${encodeURIComponent(extensionId)}`, token, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      await loadInstalledExtensions(selectedServerId);
      setStatus(`${enabled ? "Enabled" : "Disabled"} extension ${extensionId}.`);
    } catch (e) {
      setStatus(`Extension update failed: ${e.message}`);
    }
  }

  function isExtensionEnabled(extensionId) {
    return installedExtensions.some((ext) => ext.extensionId === extensionId && ext.enabled);
  }

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const selectedGuild = guilds.find((guild) => guild.id === selectedGuildId);
  const visibleMembers = members.filter((member) => {
    if (!memberQuery.trim()) return true;
    const query = memberQuery.trim().toLowerCase();
    return member.username?.toLowerCase().includes(query) || member.id?.toLowerCase().includes(query);
  });
  const visibleRoles = roles.filter((role) => {
    if (role.is_everyone) return true;
    if (!roleQuery.trim()) return true;
    return role.name?.toLowerCase().includes(roleQuery.trim().toLowerCase());
  });

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
    <div className="server-admin-layout">
      <aside className="server-admin-sidebar">
        <div className="server-admin-brand">
          <h2>Server Admin</h2>
          <p>Manage your communities with clearer controls.</p>
        </div>

        <div className="server-admin-sidebar-body">
          <div className="server-admin-sidebar-head">
            <p>Your Servers</p>
            <span>{servers.length}</span>
          </div>
          {servers.length === 0 ? (
            <p className="server-admin-empty-inline">No servers owned yet.</p>
          ) : (
            servers.map((server) => (
              <button
                key={server.id}
                className={`server-admin-server-btn ${selectedServerId === server.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedServerId(server.id);
                  setSelectedGuildId("");
                  setActiveTab("members");
                  setMemberQuery("");
                  setRoleQuery("");
                }}
              >
                <strong>{server.name}</strong>
                <span>{server.baseUrl}</span>
              </button>
            ))
          )}
        </div>

        <div className="server-admin-sidebar-status">{status || "Ready."}</div>
      </aside>

      <main className="server-admin-main">
        {!selectedServer ? (
          <div className="server-admin-empty">Select a server to manage.</div>
        ) : (
          <>
            <header className="server-admin-top">
              <div className="server-admin-top-meta">
                <h1>{selectedServer.name}</h1>
                <p>Member and role administration for your selected guild.</p>
              </div>
              <div className="server-admin-guild-pick">
                <label htmlFor="server-admin-guild-select">Guild</label>
                <select
                  id="server-admin-guild-select"
                  value={selectedGuildId}
                  onChange={(e) => setSelectedGuildId(e.target.value)}
                  disabled={guilds.length === 0}
                >
                  {guilds.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            {!selectedGuildId ? (
              <div className="server-admin-empty">Select a guild to start managing this server.</div>
            ) : !guildState ? (
              <div className="server-admin-empty">Loading guild data...</div>
            ) : (
              <>
                <div className="server-admin-stats">
                  <article className="server-admin-stat">
                    <p>Guild</p>
                    <strong>{selectedGuild?.name || "Unknown"}</strong>
                  </article>
                  <article className="server-admin-stat">
                    <p>Members</p>
                    <strong>{members.length}</strong>
                  </article>
                  <article className="server-admin-stat">
                    <p>Roles</p>
                    <strong>{roles.filter((role) => !role.is_everyone).length}</strong>
                  </article>
                  <article className="server-admin-stat">
                    <p>Server Extensions</p>
                    <strong>{extensionCatalog.serverExtensions.length}</strong>
                  </article>
                </div>

                <div className="server-admin-tabs">
                  <button className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}>
                    Members
                  </button>
                  <button className={activeTab === "roles" ? "active" : ""} onClick={() => setActiveTab("roles")}>
                    Roles
                  </button>
                  <button className={activeTab === "admins" ? "active" : ""} onClick={() => setActiveTab("admins")}>
                    Admins
                  </button>
                  <button className={activeTab === "extensions" ? "active" : ""} onClick={() => setActiveTab("extensions")}>
                    Extensions
                  </button>
                </div>

                <section className="server-admin-content">
                  {activeTab === "members" && (
                    <div className="server-admin-section">
                      <div className="server-admin-section-head">
                        <h2>Members</h2>
                        <input
                          type="search"
                          placeholder="Search by username or user id"
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                        />
                      </div>
                      {visibleMembers.length === 0 ? (
                        <p className="server-admin-empty-inline">No matching members found.</p>
                      ) : (
                        <div className="server-admin-member-grid">
                          {visibleMembers.map((member) => {
                            const memberData = guildState?.members?.find((entry) => entry.id === member.id);
                            const assignedRoles = roles.filter((role) => memberData?.roleIds?.includes(role.id));
                            return (
                              <article key={member.id} className="server-admin-member-card">
                                <div className="server-admin-member-head">
                                  {member.pfp_url ? (
                                    <img src={member.pfp_url} alt={member.username} />
                                  ) : (
                                    <div className="server-admin-member-fallback">{member.username?.[0]?.toUpperCase() || "?"}</div>
                                  )}
                                  <div>
                                    <strong>{member.username}</strong>
                                    <p>{member.id}</p>
                                  </div>
                                </div>

                                <div className="server-admin-role-pills">
                                  {assignedRoles.length === 0 ? (
                                    <span className="server-admin-pill-muted">No roles</span>
                                  ) : (
                                    assignedRoles.map((role) => (
                                      <button
                                        key={role.id}
                                        className="server-admin-role-pill"
                                        onClick={() => removeRoleFromMember(member.id, role.id)}
                                        title="Remove role"
                                      >
                                        {role.name} x
                                      </button>
                                    ))
                                  )}
                                </div>

                                <button
                                  className={`server-admin-action-btn ${selectedMemberId === member.id ? "active" : ""}`}
                                  onClick={() => setSelectedMemberId(selectedMemberId === member.id ? "" : member.id)}
                                >
                                  {selectedMemberId === member.id ? "Close role picker" : "Assign role"}
                                </button>

                                {selectedMemberId === member.id && (
                                  <div className="server-admin-member-edit">
                                    <select value={memberRoles[0] || ""} onChange={(e) => setMemberRoles([e.target.value])}>
                                      <option value="">Choose a role...</option>
                                      {roles.filter((role) => !role.is_everyone).map((role) => (
                                        <option key={role.id} value={role.id}>
                                          {role.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button className="server-admin-confirm-btn" onClick={assignRoleToMember}>
                                      Assign
                                    </button>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "roles" && (
                    <div className="server-admin-section">
                      <div className="server-admin-role-toolbar">
                        <div className="server-admin-create-role">
                          <h3>Create Role</h3>
                          <div>
                            <input
                              type="text"
                              placeholder="Role name"
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.target.value)}
                            />
                            <button onClick={createRole}>Create</button>
                          </div>
                        </div>
                        <input
                          type="search"
                          placeholder="Filter roles"
                          value={roleQuery}
                          onChange={(e) => setRoleQuery(e.target.value)}
                        />
                      </div>

                      <div className="server-admin-role-grid">
                        {visibleRoles.map((role) => (
                          <article key={role.id} className="server-admin-role-card">
                            {editingRoleId === role.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editRoleName}
                                  onChange={(e) => setEditRoleName(e.target.value)}
                                  disabled={role.is_everyone}
                                />
                                <div className="server-admin-perm-grid">
                                  {Object.entries(PERMISSION_FLAGS).map(([flag, { name }]) => (
                                    <label key={flag}>
                                      <input
                                        type="checkbox"
                                        checked={editRolePermissions[flag] || false}
                                        onChange={(e) => setEditRolePermissions({ ...editRolePermissions, [flag]: e.target.checked })}
                                        disabled={role.is_everyone}
                                      />
                                      <span>{name}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="server-admin-row-actions">
                                  <button className="server-admin-confirm-btn" onClick={updateRolePermissions}>
                                    Save
                                  </button>
                                  <button className="server-admin-action-btn" onClick={() => setEditingRoleId("")}>
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="server-admin-role-header">
                                  <h3>{role.name}</h3>
                                  {role.is_everyone && <span>@everyone</span>}
                                </div>
                                <p>Position {role.position}</p>
                                <p>{Object.keys(PERMISSION_FLAGS).filter((flag) => hasPermission(role.permissions, flag)).length} permissions</p>
                                <button
                                  className="server-admin-action-btn"
                                  onClick={() => openRoleEditor(role)}
                                  disabled={role.is_everyone}
                                >
                                  Edit permissions
                                </button>
                              </>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "admins" && (
                    <div className="server-admin-section">
                      <h2>Admin Roles</h2>
                      <p className="server-admin-help">Roles with the Administrator permission are shown below.</p>
                      <div className="server-admin-admin-list">
                        {roles.filter((role) => hasPermission(role.permissions, "ADMINISTRATOR")).length === 0 ? (
                          <p className="server-admin-empty-inline">No administrator roles configured.</p>
                        ) : (
                          roles
                            .filter((role) => hasPermission(role.permissions, "ADMINISTRATOR"))
                            .map((role) => (
                              <article key={role.id} className="server-admin-admin-card">
                                <strong>{role.name}</strong>
                                <span>Position {role.position}</span>
                                <button className="server-admin-action-btn" onClick={() => openRoleEditor(role)}>
                                  Review permissions
                                </button>
                              </article>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "extensions" && (
                    <div className="server-admin-section">
                      <h2>Extensions</h2>
                      <p className="server-admin-help">
                        Enable reviewed extensions for this server node. Changes apply in realtime.
                      </p>

                      <div className="server-admin-extension-list">
                        {extensionsLoading ? (
                          <p className="server-admin-empty-inline">Loading installed extension state...</p>
                        ) : extensionCatalog.serverExtensions.length === 0 ? (
                          <p className="server-admin-empty-inline">No server extensions found in <code>Extensions/Server</code>.</p>
                        ) : (
                          extensionCatalog.serverExtensions.map((ext) => {
                            const enabled = isExtensionEnabled(ext.id);
                            return (
                              <article key={ext.id} className="server-admin-extension-card">
                                <div>
                                  <strong>{ext.name}</strong>
                                  <p>{ext.description || "No description available."}</p>
                                  <code>{ext.id}</code>
                                </div>
                                <button
                                  className={`server-admin-action-btn ${enabled ? "danger" : "success"}`}
                                  onClick={() => toggleExtension(ext.id, !enabled)}
                                >
                                  {enabled ? "Disable" : "Enable"}
                                </button>
                              </article>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
