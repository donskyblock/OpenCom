"use client";

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type View = "landing" | "login" | "dashboard" | "create-app" | "app-detail";

interface User {
  id: string;
  email: string;
  username: string;
}

interface OAuthApp {
  app_id: string;
  app_name: string;
  client_secret?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API = "https://api.opencom.online";
const OAUTH_API = "https://oauth.opencom.online";

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icon = {
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="#5865F2" />
      <path
        d="M8 14a6 6 0 0 1 12 0 6 6 0 0 1-12 0Z"
        fill="white"
        fillOpacity=".2"
      />
      <circle cx="14" cy="14" r="4" fill="white" />
    </svg>
  ),
  Apps: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fillOpacity=".4" />
    </svg>
  ),
  Key: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10 1a5 5 0 0 1 1 9.9V12l1 1-1 1-1-1-1 1-1-1 1-1v-1.1A5 5 0 0 1 10 1Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M5 2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H5Zm-3 2a1 1 0 0 1 1-1h.5v1H3v6h5v-.5h1V11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" />
    </svg>
  ),
  Eye: ({ open }: { open: boolean }) =>
    open ? (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 3C4 3 1.5 5.5 1 7c.5 1.5 3 4 6 4s5.5-2.5 6-4c-.5-1.5-3-4-6-4Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path
          d="M2 2l10 10M5.5 5.6A2 2 0 0 0 9 9M7 3C4 3 1.5 5.5 1 7c.3.9 1 2 2 3M10 4.5c1.2.8 2.3 1.9 3 2.5-.5 1.5-3 4-6 4-.7 0-1.4-.1-2-.4"
          strokeWidth="1.2"
          stroke="currentColor"
          fill="none"
        />
      </svg>
    ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M5.5 1h3l.5 1H10v1H4V2h1l.5-1ZM4 4h6l-.5 7h-5L4 4Zm2 1v5h1V5H6Zm2 0v5h1V5H8Z" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path
        d="M6.5 1v12M1 6.5h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  Back: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path
        d="M9 2L4 7l5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 7l3.5 3.5 5.5-6"
        stroke="#23A55A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "#b5bac1",
        }}
      >
        {label}
      </label>
      <input
        {...props}
        style={{
          background: "#1e1f22",
          border: "1px solid #1e1f22",
          borderRadius: 4,
          padding: "10px 12px",
          color: "#f2f3f5",
          fontSize: 15,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color .15s",
          fontFamily: "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#5865f2")}
        onBlur={(e) => (e.target.style.borderColor = "#1e1f22")}
      />
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  loading,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const colors = {
    primary: { bg: "#5865f2", hover: "#4752c4", text: "#fff" },
    secondary: { bg: "#4e5058", hover: "#6d6f78", text: "#fff" },
    danger: { bg: "#da373c", hover: "#a12d31", text: "#fff" },
    ghost: { bg: "transparent", hover: "#2b2d31", text: "#b5bac1" },
  }[variant];
  const [hovered, setHovered] = useState(false);
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.hover : colors.bg,
        color: colors.text,
        border: "none",
        borderRadius: 4,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        cursor: loading || props.disabled ? "not-allowed" : "pointer",
        opacity: loading || props.disabled ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "background .15s",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: "2px solid rgba(255,255,255,.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }}
    />
  );
}

function Tag({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
      }}
    >
      {children}
    </span>
  );
}

function CopyField({
  value,
  label,
  secret,
}: {
  value: string;
  label: string;
  secret?: boolean;
}) {
  const [show, setShow] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "#b5bac1",
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#1e1f22",
          borderRadius: 4,
          padding: "10px 12px",
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: "#f2f3f5",
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {show ? value : "•".repeat(Math.min(value.length, 40))}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {secret && (
            <button
              onClick={() => setShow((s) => !s)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#b5bac1",
                padding: 2,
              }}
            >
              <Icon.Eye open={show} />
            </button>
          )}
          <button
            onClick={copy}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: copied ? "#23a55a" : "#b5bac1",
              padding: 2,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            {copied ? (
              <>
                <Icon.Check /> Copied
              </>
            ) : (
              <Icon.Copy />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 999,
        background: type === "success" ? "#23a55a" : "#da373c",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 4px 24px rgba(0,0,0,.4)",
        animation: "slideUp .25s ease",
      }}
    >
      {msg}
    </div>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function LoginView({
  onLogin,
}: {
  onLogin: (user: User, secret: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${OAUTH_API}/v1/oauth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.secret)
        throw new Error(data.error || "Login failed");
      onLogin(data.user, data.secret);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#313338",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Icon.Logo />
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#f2f3f5",
              letterSpacing: "-.02em",
            }}
          >
            OpenCom
          </span>
          <Tag color="#5865f2">Developer</Tag>
        </div>
        <div style={{ background: "#2b2d31", borderRadius: 8, padding: 32 }}>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 24,
              fontWeight: 700,
              color: "#f2f3f5",
            }}
          >
            Welcome back
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: "#949ba4" }}>
            Sign in to manage your applications.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#f23f42",
                  fontWeight: 500,
                }}
              >
                {error}
              </p>
            )}
            <Button
              loading={loading}
              onClick={submit}
              style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            >
              Log In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAppView({
  secret,
  onCreated,
  onBack,
}: {
  secret: string;
  onCreated: (app: OAuthApp) => void;
  onBack: () => void;
}) {
  const [appId, setAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/v1/manager/create-app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          app_name: appName,
          secret_code: secret,
          user_id: userId,
          redirect_url: redirectUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.app_id)
        throw new Error(data.error || "Failed to create app");
      onCreated(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 600,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#b5bac1",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        >
          <Icon.Back /> Back
        </button>
      </div>
      <div>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 20,
            fontWeight: 700,
            color: "#f2f3f5",
          }}
        >
          New Application
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#949ba4" }}>
          Register a new OAuth app to get your client credentials.
        </p>
      </div>
      <div
        style={{
          background: "#2b2d31",
          borderRadius: 8,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Input
          label="App ID (must be an email-like ID)"
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="myapp@opencom.online"
        />
        <Input
          label="App Name"
          type="text"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="My Awesome App"
        />
        <Input
          label="User ID"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="your-user-id"
        />
        <Input
          label="Redirect URLs (comma-separated)"
          type="text"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          placeholder="https://myapp.com/callback,https://localhost:3000/callback"
        />
        {error && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "#f23f42",
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button loading={loading} onClick={submit}>
            Create Application
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppDetail({
  app,
  secret,
  onBack,
  onDeleted,
}: {
  app: OAuthApp;
  secret: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const deleteApp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/oauth-app`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: app.app_id, secret_code: secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      showToast("Application deleted.", "success");
      setTimeout(onDeleted, 1200);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 680,
      }}
    >
      {toast && <Toast {...toast} />}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#b5bac1",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        >
          <Icon.Back /> Back to Apps
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: 22,
              fontWeight: 700,
              color: "#f2f3f5",
            }}
          >
            {app.app_name}
          </h2>
          <span
            style={{ fontSize: 13, color: "#949ba4", fontFamily: "monospace" }}
          >
            {app.app_id}
          </span>
        </div>
        <Tag color="#5865f2">OAuth App</Tag>
      </div>

      <div
        style={{
          background: "#2b2d31",
          borderRadius: 8,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".05em",
            color: "#949ba4",
          }}
        >
          Credentials
        </h3>
        <CopyField label="Client ID (App ID)" value={app.app_id} />
        {app.client_secret && (
          <>
            <div style={{ borderTop: "1px solid #1e1f22", paddingTop: 20 }}>
              <div
                style={{
                  background: "#faa61a22",
                  border: "1px solid #faa61a44",
                  borderRadius: 6,
                  padding: "10px 14px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#faa61a",
                }}
              >
                ⚠️ Copy your client secret now — it won't be shown again.
              </div>
              <CopyField
                label="Client Secret"
                value={app.client_secret}
                secret
              />
            </div>
          </>
        )}
      </div>

      <div style={{ background: "#2b2d31", borderRadius: 8, padding: 28 }}>
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".05em",
            color: "#949ba4",
          }}
        >
          Danger Zone
        </h3>
        {!confirmDelete ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 2px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#f2f3f5",
                }}
              >
                Delete this application
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#949ba4" }}>
                This action is permanent and cannot be undone.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Icon.Trash /> Delete App
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "#f23f42",
                fontWeight: 600,
              }}
            >
              Are you sure? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="danger" loading={loading} onClick={deleteApp}>
                Yes, Delete It
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({
  user,
  secret,
  onLogout,
}: {
  user: User;
  secret: string;
  onLogout: () => void;
}) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<OAuthApp | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreated = (app: OAuthApp) => {
    setApps((prev) => [...prev, app]);
    setSelectedApp(app);
    setView("detail");
    showToast("Application created!", "success");
  };

  const sidebarItems = [
    { label: "Applications", icon: <Icon.Apps />, id: "list" as const },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#313338",
        display: "flex",
        fontFamily: "inherit",
      }}
    >
      {toast && <Toast {...toast} />}

      {/* Sidebar */}
      <div
        style={{
          width: 240,
          background: "#2b2d31",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: "1px solid #1e1f22",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.Logo />
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#f2f3f5",
                  lineHeight: 1.2,
                }}
              >
                OpenCom
              </div>
              <div style={{ fontSize: 11, color: "#949ba4" }}>
                Developer Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "8px 8px", flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".06em",
              color: "#949ba4",
              padding: "8px 8px 4px",
            }}
          >
            Developer
          </div>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView("list");
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background:
                  view !== "create" && view !== "detail"
                    ? "#404249"
                    : "transparent",
                color:
                  view !== "create" && view !== "detail"
                    ? "#f2f3f5"
                    : "#949ba4",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "inherit",
                textAlign: "left",
                transition: "background .1s",
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div
          style={{
            padding: "12px 12px",
            borderTop: "1px solid #1e1f22",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#5865f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {user.username[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#f2f3f5",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.username}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#949ba4",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.email}
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#949ba4",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          >
            Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "40px 48px", overflowY: "auto" }}>
        {view === "create" && (
          <CreateAppView
            secret={secret}
            onCreated={handleCreated}
            onBack={() => setView("list")}
          />
        )}

        {view === "detail" && selectedApp && (
          <AppDetail
            app={selectedApp}
            secret={secret}
            onBack={() => setView("list")}
            onDeleted={() => {
              setApps((prev) =>
                prev.filter((a) => a.app_id !== selectedApp.app_id),
              );
              setView("list");
            }}
          />
        )}

        {view === "list" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 720,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h1
                  style={{
                    margin: "0 0 4px",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#f2f3f5",
                  }}
                >
                  Applications
                </h1>
                <p style={{ margin: 0, fontSize: 14, color: "#949ba4" }}>
                  {apps.length === 0
                    ? "You haven't created any applications yet."
                    : `You have ${apps.length} application${apps.length !== 1 ? "s" : ""}.`}
                </p>
              </div>
              <Button onClick={() => setView("create")}>
                <Icon.Plus /> New Application
              </Button>
            </div>

            {/* Session token info */}
            <div
              style={{
                background: "#2b2d31",
                borderRadius: 8,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.Key />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    color: "#949ba4",
                  }}
                >
                  Session Token
                </span>
              </div>
              <CopyField label="OAuth Secret" value={secret} secret />
              <p style={{ margin: 0, fontSize: 12, color: "#949ba4" }}>
                This is your session secret — use it to authorize API calls to{" "}
                <code
                  style={{
                    background: "#1e1f22",
                    borderRadius: 3,
                    padding: "1px 5px",
                    fontSize: 11,
                  }}
                >
                  api.opencom.online
                </code>{" "}
                and{" "}
                <code
                  style={{
                    background: "#1e1f22",
                    borderRadius: 3,
                    padding: "1px 5px",
                    fontSize: 11,
                  }}
                >
                  oauth.opencom.online
                </code>
                .
              </p>
            </div>

            {/* Apps list */}
            {apps.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {apps.map((app) => (
                  <button
                    key={app.app_id}
                    onClick={() => {
                      setSelectedApp(app);
                      setView("detail");
                    }}
                    style={{
                      background: "#2b2d31",
                      border: "1px solid #1e1f22",
                      borderRadius: 8,
                      padding: "18px 22px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "border-color .15s",
                      width: "100%",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#5865f2")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#1e1f22")
                    }
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#f2f3f5",
                          marginBottom: 2,
                        }}
                      >
                        {app.app_name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#949ba4",
                          fontFamily: "monospace",
                        }}
                      >
                        {app.app_id}
                      </div>
                    </div>
                    <Tag color="#5865f2">OAuth</Tag>
                  </button>
                ))}
              </div>
            )}

            {apps.length === 0 && (
              <div
                style={{
                  background: "#2b2d31",
                  borderRadius: 8,
                  padding: "48px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  border: "2px dashed #1e1f22",
                }}
              >
                <div style={{ fontSize: 40 }}>🧩</div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#f2f3f5",
                    }}
                  >
                    No applications yet
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "#949ba4" }}>
                    Create your first OAuth app to get started.
                  </p>
                </div>
                <Button onClick={() => setView("create")}>
                  <Icon.Plus /> Create Application
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [secret, setSecret] = useState("");

  const handleLogin = (u: User, s: string) => {
    setUser(u);
    setSecret(s);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #313338; font-family: 'gg sans', 'Noto Sans', Whitney, 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e1f22; border-radius: 4px; }
        input::placeholder { color: #4e5058; }
      `}</style>

      {!user ? (
        <LoginView onLogin={handleLogin} />
      ) : (
        <Dashboard
          user={user}
          secret={secret}
          onLogout={() => {
            setUser(null);
            setSecret("");
          }}
        />
      )}
    </>
  );
}
