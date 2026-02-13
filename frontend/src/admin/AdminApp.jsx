import { useEffect, useState } from "react";

const CORE_API = import.meta.env.VITE_CORE_API_URL || "https://openapi.donskyblock.xyz";

const KNOWN_BADGES = ["PLATFORM_ADMIN", "PLATFORM_FOUNDER"];

async function api(path, token, panelPassword, options = {}) {
  const response = await fetch(`${CORE_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-admin-panel-password": panelPassword,
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

export function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem("opencom_access_token") || "");
  const [panelPassword, setPanelPassword] = useState(sessionStorage.getItem("opencom_admin_panel_password") || "");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info"); // info | success | error
  const [adminOverview, setAdminOverview] = useState({ founder: null, admins: [] });
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [badgeUserId, setBadgeUserId] = useState("");
  const [badgeName, setBadgeName] = useState("");
  const [adminStatus, setAdminStatus] = useState(null); // { platformRole, isPlatformAdmin, isPlatformOwner }
  const [unlockInput, setUnlockInput] = useState("");

  function showStatus(message, type = "info") {
    setStatus(message);
    setStatusType(type);
  }

  useEffect(() => {
    if (panelPassword) sessionStorage.setItem("opencom_admin_panel_password", panelPassword);
  }, [panelPassword]);

  useEffect(() => {
    if (!panelPassword || !token) return;
    loadOverview();
    loadAdminStatus();
  }, [panelPassword, token]);

  async function loadAdminStatus() {
    try {
      const data = await api("/v1/me/admin-status", token, panelPassword);
      setAdminStatus(data);
    } catch {
      setAdminStatus(null);
    }
  }

  async function loadOverview() {
    try {
      const data = await api("/v1/admin/overview", token, panelPassword);
      setAdminOverview(data);
      showStatus("Overview loaded.", "success");
    } catch (e) {
      showStatus(`Overview failed: ${e.message}`, "error");
    }
  }

  async function searchUsers() {
    if (!query.trim()) {
      showStatus("Enter a search term (username or email).", "info");
      return;
    }
    setSearching(true);
    try {
      const data = await api(`/v1/admin/users?query=${encodeURIComponent(query.trim())}`, token, panelPassword);
      setUsers(data.users || []);
      showStatus(`Found ${(data.users || []).length} users.`, "success");
    } catch (e) {
      showStatus(`Search failed: ${e.message}`, "error");
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }

  async function setAdmin(userId, enabled) {
    try {
      await api(`/v1/admin/users/${userId}/platform-admin`, token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      await loadOverview();
      await loadAdminStatus();
      showStatus(enabled ? "User is now platform admin." : "Platform admin removed.", "success");
    } catch (e) {
      showStatus(e.message || "Update failed.", "error");
    }
  }

  async function setFounder(userId) {
    try {
      await api("/v1/admin/founder", token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ userId })
      });
      await loadOverview();
      await loadAdminStatus();
      showStatus("Founder updated.", "success");
    } catch (e) {
      showStatus(e.message || "Set founder failed.", "error");
    }
  }

  async function setBadge(enabled) {
    if (!badgeUserId.trim() || !badgeName.trim()) {
      showStatus("Enter user ID and badge name.", "info");
      return;
    }
    try {
      await api(`/v1/admin/users/${badgeUserId.trim()}/badges`, token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ badge: badgeName.trim(), enabled })
      });
      showStatus(`Badge ${enabled ? "added" : "removed"}.`, "success");
    } catch (e) {
      showStatus(e.message || "Badge action failed.", "error");
    }
  }

  if (!panelPassword) {
    return (
      <div className="admin-unlock">
        <div className="admin-unlock-card">
          <h1>OpenCom Platform Admin</h1>
          <p className="admin-unlock-desc">Enter the server-configured admin panel password to continue.</p>
          <input
            type="password"
            placeholder="Admin panel password"
            value={unlockInput}
            onChange={(e) => setUnlockInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlockInput.trim() && setPanelPassword(unlockInput.trim())}
          />
          <button onClick={() => unlockInput.trim() && setPanelPassword(unlockInput.trim())}>Unlock</button>
          <p className="admin-status-msg">{status}</p>
        </div>
      </div>
    );
  }

  const isOwner = adminStatus?.isPlatformOwner === true;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users & admins" },
    { id: "badges", label: "Badges" }
  ];

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h1>OpenCom Platform Admin</h1>
        <div className="admin-header-meta">
          {adminStatus && (
            <span className="admin-role-badge" title="Your platform role">
              {adminStatus.platformRole === "owner" ? "Owner" : adminStatus.platformRole === "admin" ? "Admin" : "—"}
            </span>
          )}
          <a href="/server-admin.html" target="_blank" rel="noopener noreferrer" className="admin-link-out">Server Admin →</a>
          <button type="button" className="admin-lock-btn" onClick={() => { setPanelPassword(""); sessionStorage.removeItem("opencom_admin_panel_password"); showStatus(""); }}>Lock panel</button>
        </div>
      </header>

      <div className="admin-token-row">
        <label>Access token (used for API calls)</label>
        <input type="password" placeholder="Core access token" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>

      <nav className="admin-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <div className="admin-content">
        {tab === "overview" && (
          <section className="admin-section">
            <h2>Platform overview</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Founder</h3>
                {adminOverview.founder?.id ? (
                  <p><strong>{adminOverview.founder.username || "—"}</strong><br /><code>{adminOverview.founder.id}</code></p>
                ) : (
                  <p className="text-dim">Not set. Use Users & admins to set founder.</p>
                )}
              </div>
              <div className="admin-card">
                <h3>Platform admins</h3>
                <p>{adminOverview.admins?.length ?? 0} admin(s)</p>
                {adminOverview.admins?.length > 0 && (
                  <ul className="admin-list">
                    {(adminOverview.admins || []).map((a) => (
                      <li key={a.id}><strong>{a.username}</strong> <code>{a.id}</code></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button type="button" onClick={loadOverview}>Refresh overview</button>
          </section>
        )}

        {tab === "users" && (
          <section className="admin-section">
            <h2>User search & admin actions</h2>
            <p className="admin-hint">Search by username or email, then set founder, add/remove platform admins, or manage badges.</p>
            <div className="admin-search-row">
              <input placeholder="Username or email" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchUsers()} />
              <button type="button" onClick={searchUsers} disabled={searching}>{searching ? "Searching…" : "Search"}</button>
            </div>
            <div className="admin-users-table-wrap">
              {users.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>User ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.username || "—"}</strong></td>
                        <td>{u.email || "—"}</td>
                        <td><code>{u.id}</code></td>
                        <td>
                          {isOwner && <button type="button" className="btn-sm" onClick={() => setFounder(u.id)}>Set founder</button>}
                          {isOwner && <button type="button" className="btn-sm" onClick={() => setAdmin(u.id, true)}>Make admin</button>}
                          {isOwner && <button type="button" className="btn-sm danger" onClick={() => setAdmin(u.id, false)}>Remove admin</button>}
                          <button type="button" className="btn-sm" onClick={() => { setBadgeUserId(u.id); setTab("badges"); }}>Badges</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-dim">Run a search to see users.</p>
              )}
            </div>
          </section>
        )}

        {tab === "badges" && (
          <section className="admin-section">
            <h2>Badge management</h2>
            <p className="admin-hint">Add or remove badges for a user. Founder/Owner can set PLATFORM_FOUNDER; any platform admin can set others.</p>
            <div className="admin-badge-form">
              <input placeholder="User ID" value={badgeUserId} onChange={(e) => setBadgeUserId(e.target.value)} />
              <input placeholder="Badge name (e.g. PLATFORM_ADMIN)" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} list="known-badges" />
              <datalist id="known-badges">
                {KNOWN_BADGES.map((b) => <option key={b} value={b} />)}
              </datalist>
              <div className="admin-badge-actions">
                <button type="button" onClick={() => setBadge(true)}>Add badge</button>
                <button type="button" className="danger" onClick={() => setBadge(false)}>Remove badge</button>
              </div>
            </div>
          </section>
        )}
      </div>

      {status && (
        <div className={`admin-status admin-status-${statusType}`} role="status">
          {status}
        </div>
      )}
    </div>
  );
}
