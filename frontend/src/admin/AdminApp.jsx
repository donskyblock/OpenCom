import { useEffect, useState } from "react";

const CORE_API = import.meta.env.VITE_CORE_API_URL || "https://openapi.donskyblock.xyz";

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
  const [adminOverview, setAdminOverview] = useState({ founder: null, admins: [] });
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [badgeUserId, setBadgeUserId] = useState("");
  const [badgeName, setBadgeName] = useState("");

  useEffect(() => {
    if (panelPassword) sessionStorage.setItem("opencom_admin_panel_password", panelPassword);
  }, [panelPassword]);

  async function loadOverview() {
    try {
      const data = await api("/v1/admin/overview", token, panelPassword);
      setAdminOverview(data);
      setStatus("Admin overview loaded.");
    } catch (e) {
      setStatus(`Overview failed: ${e.message}`);
    }
  }

  async function searchUsers() {
    try {
      const data = await api(`/v1/admin/users?query=${encodeURIComponent(query)}`, token, panelPassword);
      setUsers(data.users || []);
    } catch (e) {
      setStatus(`Search failed: ${e.message}`);
    }
  }

  async function setAdmin(userId, enabled) {
    try {
      await api(`/v1/admin/users/${userId}/platform-admin`, token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      await loadOverview();
    } catch (e) {
      setStatus(`Update failed: ${e.message}`);
    }
  }

  async function setFounder(userId) {
    try {
      await api(`/v1/admin/founder`, token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ userId })
      });
      await loadOverview();
    } catch (e) {
      setStatus(`Set founder failed: ${e.message}`);
    }
  }

  async function setBadge(enabled) {
    try {
      await api(`/v1/admin/users/${badgeUserId}/badges`, token, panelPassword, {
        method: "POST",
        body: JSON.stringify({ badge: badgeName, enabled })
      });
      setStatus(`Badge ${enabled ? "added" : "removed"}.`);
    } catch (e) {
      setStatus(`Badge failed: ${e.message}`);
    }
  }

  if (!panelPassword) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>OpenCom Admin Panel</h1>
          <p>This panel is gated by the server-side admin panel password.</p>
          <input
            type="password"
            placeholder="Admin panel password"
            value={panelPassword}
            onChange={(e) => setPanelPassword(e.target.value)}
          />
          <button onClick={() => setStatus(panelPassword ? "Password staged." : "Enter password.")}>Continue</button>
          <p className="status">{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ width: "min(920px, 94vw)" }}>
        <h1>OpenCom Admin Panel</h1>
        <p>URL: <code>/admin.html</code></p>
        <input placeholder="Core access token" value={token} onChange={(e) => setToken(e.target.value)} />
        <div className="admin-user-actions">
          <button onClick={loadOverview}>Load Overview</button>
          <button onClick={() => { setPanelPassword(""); sessionStorage.removeItem("opencom_admin_panel_password"); }}>Lock Panel</button>
        </div>

        <p>Founder: <code>{adminOverview.founder?.id || "(unset)"}</code></p>
        <p>Admins: {adminOverview.admins?.length || 0}</p>

        <input placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={searchUsers}>Search</button>

        <div className="admin-users">
          {users.map((u) => (
            <div key={u.id} className="admin-user-row">
              <div><strong>{u.username}</strong> <code>{u.id}</code></div>
              <div className="admin-user-actions">
                <button onClick={() => setAdmin(u.id, true)}>Make Admin</button>
                <button onClick={() => setAdmin(u.id, false)}>Remove Admin</button>
                <button onClick={() => setFounder(u.id)}>Set Founder</button>
              </div>
            </div>
          ))}
        </div>

        <h3>Badge Management</h3>
        <input placeholder="Target userId" value={badgeUserId} onChange={(e) => setBadgeUserId(e.target.value)} />
        <input placeholder="Badge name" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} />
        <div className="admin-user-actions">
          <button onClick={() => setBadge(true)}>Add Badge</button>
          <button onClick={() => setBadge(false)}>Remove Badge</button>
        </div>

        <p className="status">{status}</p>
      </div>
    </div>
  );
}
