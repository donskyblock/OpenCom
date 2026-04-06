"use client";

import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";

type View = "overview" | "create" | "detail";

interface User {
  id: string;
  email: string;
  username: string;
}

interface OAuthApp {
  app_id: string;
  app_name: string;
  description?: string | null;
  client_secret?: string;
  redirect_uris?: string[] | string;
}

interface StoredSession {
  user: User;
  secret: string;
  apps: OAuthApp[];
}

const CORE_API =
  process.env.NEXT_PUBLIC_CORE_API_URL?.trim() || "https://api.opencom.online";
const OAUTH_API =
  process.env.NEXT_PUBLIC_OAUTH_API_URL?.trim() ||
  "https://oauth.opencom.online";
const STORAGE_KEY = "opencom.oauth.portal.session";

const Icon = {
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill="url(#logoGradient)" />
      <path
        d="M8.5 14a5.5 5.5 0 0 1 11 0 5.5 5.5 0 0 1-11 0Z"
        fill="rgba(255,255,255,.18)"
      />
      <circle cx="14" cy="14" r="3.8" fill="white" />
      <defs>
        <linearGradient id="logoGradient" x1="3" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F76945" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Spark: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5 9.7 6.3 14.5 8 9.7 9.7 8 14.5 6.3 9.7 1.5 8l4.8-1.7L8 1.5Z" fill="currentColor" />
    </svg>
  ),
  Apps: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.25" y="1.25" width="5.5" height="5.5" rx="1.2" />
      <rect x="9.25" y="1.25" width="5.5" height="5.5" rx="1.2" />
      <rect x="1.25" y="9.25" width="5.5" height="5.5" rx="1.2" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1.2" fillOpacity=".35" />
    </svg>
  ),
  Arrow: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3.5 7.5h8m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Back: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M10 3.5 5.5 7.5 10 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Copy: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
      <path d="M5.25 2A2.25 2.25 0 0 0 3 4.25v5.5A2.25 2.25 0 0 0 5.25 12h5.5A2.25 2.25 0 0 0 13 9.75v-5.5A2.25 2.25 0 0 0 10.75 2h-5.5Zm-3 2a2.25 2.25 0 0 1 2.25-2.25H5v1.5h-.5a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75v-.5h1.5v.75A2.25 2.25 0 0 1 10.5 13.5h-6A2.25 2.25 0 0 1 2.25 11.25V4Z" />
    </svg>
  ),
  Check: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3.25 7.75 6.2 10.7 11.8 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Trash: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
      <path d="M5.5 1.75h4l.65 1.1h2.1v1.4h-9v-1.4h2.1l.65-1.1ZM4.4 5.25h6.2l-.55 7.1A1.25 1.25 0 0 1 8.8 13.5H6.2a1.25 1.25 0 0 1-1.25-1.15l-.55-7.1Zm2 .9v5.1h1.2v-5.1H6.4Zm2.2 0v5.1h1.2v-5.1H8.6Z" />
    </svg>
  ),
  Link: () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M5.8 9.2 9.2 5.8M5.4 5.4l-1.6 1.6a2 2 0 1 0 2.8 2.8l1.1-1.1m1.2-2.4 1.1-1.1a2 2 0 0 1 2.8 2.8l-1.6 1.6a2 2 0 0 1-2.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Secret: ({ visible }: { visible: boolean }) => (
    visible ? (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
        <path d="M7.5 3c-3.1 0-5.7 2.5-6.2 4.5C1.8 9.5 4.4 12 7.5 12s5.7-2.5 6.2-4.5C13.2 5.5 10.6 3 7.5 3Zm0 6.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
      </svg>
    ) : (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M2.5 2.5 12.5 12.5M6.4 6.4a1.6 1.6 0 0 0 2.2 2.2M4.1 4.5A7.2 7.2 0 0 0 1.4 7.5C1.9 9.4 4.4 12 7.5 12c1 0 2-.3 2.8-.7m1.7-1.4a8 8 0 0 0 1.6-2.4C13.1 5.6 10.6 3 7.5 3c-.8 0-1.6.2-2.4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  ),
};

function safeParseSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.user?.id || !parsed.secret) return null;
    return {
      user: parsed.user,
      secret: parsed.secret,
      apps: Array.isArray(parsed.apps) ? parsed.apps : [],
    };
  } catch {
    return null;
  }
}

function persistSession(user: User | null, secret: string, apps: OAuthApp[]) {
  if (typeof window === "undefined") return;
  if (!user || !secret) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, secret, apps }),
  );
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeRedirectUris(value: OAuthApp["redirect_uris"]): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
    } catch {
      return value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  }
  return [];
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="oauth-field">
      <span className="oauth-field__label">{label}</span>
      {hint ? <span className="oauth-field__hint">{hint}</span> : null}
      {children}
    </label>
  );
}

function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input {...props} className={classNames("oauth-input", className)} />;
}

function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea {...props} className={classNames("oauth-input oauth-input--textarea", className)} />;
}

function Button({
  children,
  variant = "primary",
  loading,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={classNames("oauth-button", `oauth-button--${variant}`, className)}
    >
      {loading ? <span className="oauth-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warm" | "success" }) {
  return <span className={classNames("oauth-pill", `oauth-pill--${tone}`)}>{children}</span>;
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article className="oauth-stat-card">
      <span className="oauth-stat-card__label">{label}</span>
      <strong className="oauth-stat-card__value">{value}</strong>
      <p className="oauth-stat-card__meta">{meta}</p>
    </article>
  );
}

function CopyField({
  label,
  value,
  secret,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [visible, setVisible] = useState(!secret);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="oauth-copy-field">
      <div className="oauth-copy-field__header">
        <span className="oauth-copy-field__label">{label}</span>
        <div className="oauth-copy-field__actions">
          {secret ? (
            <button
              type="button"
              className="oauth-icon-button"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? "Hide value" : "Show value"}
            >
              <Icon.Secret visible={visible} />
            </button>
          ) : null}
          <button type="button" className="oauth-icon-button" onClick={copy}>
            {copied ? <Icon.Check /> : <Icon.Copy />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <div className="oauth-copy-field__body">
        {visible ? value : "\u2022".repeat(Math.min(value.length, 42))}
      </div>
    </div>
  );
}

function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timeout);
  }, [onClose]);

  return (
    <div className={classNames("oauth-toast", `oauth-toast--${tone}`)}>
      {tone === "success" ? <Icon.Check /> : <Icon.Trash />}
      <span>{message}</span>
    </div>
  );
}

function LoginView({
  onLogin,
}: {
  onLogin: (user: User, secret: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${CORE_API}/v1/oauth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.secret) {
        throw new Error(String(data.error || "Unable to sign in."));
      }
      onLogin(data.user, data.secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="oauth-shell">
      <section className="oauth-hero">
        <div className="oauth-hero__intro">
          <Pill tone="warm">OAuth Developer Portal</Pill>
          <h1>Build apps that feel first-party from day one.</h1>
          <p>
            Register OAuth clients, manage callback URLs, and generate sign-in
            handoff links from one focused dashboard.
          </p>
          <div className="oauth-hero__highlights">
            <div>
              <strong>Faster setup</strong>
              <span>Start with a cleaner app creation flow and sane defaults.</span>
            </div>
            <div>
              <strong>Safer handoff</strong>
              <span>Copy secrets once, keep redirect URLs visible, and review link state clearly.</span>
            </div>
            <div>
              <strong>Less guesswork</strong>
              <span>See exactly what to call next after creating an OAuth app.</span>
            </div>
          </div>
        </div>

        <div className="oauth-auth-card">
          <div className="oauth-brand">
            <Icon.Logo />
            <div>
              <strong>OpenCom</strong>
              <span>Developer dashboard</span>
            </div>
          </div>

          <div className="oauth-auth-copy">
            <h2>Sign in</h2>
            <p>Use your OpenCom account to create or manage OAuth clients.</p>
          </div>

          <div className="oauth-form-grid">
            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
              />
            </Field>
          </div>

          {error ? <p className="oauth-error">{error}</p> : null}

          <Button className="oauth-button--full" onClick={() => void submit()} loading={loading}>
            Continue to dashboard
            <Icon.Arrow />
          </Button>
        </div>
      </section>
    </main>
  );
}

function CreateAppView({
  user,
  secret,
  onCreated,
  onCancel,
}: {
  user: User;
  secret: string;
  onCreated: (app: OAuthApp) => void;
  onCancel: () => void;
}) {
  const [appId, setAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [description, setDescription] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([
    "http://localhost:3000/callback",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateRedirect(index: number, value: string) {
    setRedirectUris((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
    );
  }

  function addRedirect() {
    setRedirectUris((current) => [...current, ""]);
  }

  function removeRedirect(index: number) {
    setRedirectUris((current) =>
      current.length === 1 ? current : current.filter((_, entryIndex) => entryIndex !== index),
    );
  }

  async function submit() {
    setLoading(true);
    setError("");
    const cleanedRedirects = redirectUris.map((value) => value.trim()).filter(Boolean);

    if (!cleanedRedirects.length) {
      setError("Add at least one redirect URI before creating the app.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${OAUTH_API}/v1/apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId.trim(),
          app_name: appName.trim(),
          description: description.trim(),
          secret_code: secret,
          user_id: user.id,
          redirect_url: cleanedRedirects.join(","),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.app_id) {
        throw new Error(String(data.error || "Failed to create application."));
      }
      onCreated({
        ...data,
        description: description.trim(),
        redirect_uris: cleanedRedirects,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create application.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="oauth-panel oauth-panel--wide">
      <div className="oauth-panel__heading">
        <button type="button" className="oauth-back-button" onClick={onCancel}>
          <Icon.Back />
          Back to apps
        </button>
        <Pill tone="warm">New client</Pill>
        <h2>Create a new OAuth application</h2>
        <p>
          Set up the basic identity for your app now. You can refine callback
          URLs and credentials after creation.
        </p>
      </div>

      <div className="oauth-create-layout">
        <div className="oauth-card">
          <div className="oauth-card__header">
            <h3>App details</h3>
            <p>Use a stable app ID and a name developers will recognize.</p>
          </div>

          <div className="oauth-form-grid">
            <Field label="App ID" hint="The API currently expects an email-like identifier.">
              <TextInput
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
                placeholder="my-app@opencom.online"
              />
            </Field>
            <Field label="Display name">
              <TextInput
                value={appName}
                onChange={(event) => setAppName(event.target.value)}
                placeholder="My OpenCom Integration"
              />
            </Field>
            <Field label="Description" hint="Optional, but useful once you have multiple apps.">
              <TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this app does and who it is for."
                rows={4}
              />
            </Field>
          </div>
        </div>

        <div className="oauth-card">
          <div className="oauth-card__header">
            <h3>Redirect URIs</h3>
            <p>
              Add every callback URL you intend to use in local dev and production.
            </p>
          </div>

          <div className="oauth-redirect-list">
            {redirectUris.map((uri, index) => (
              <div key={`${index}-${uri}`} className="oauth-redirect-row">
                <TextInput
                  value={uri}
                  onChange={(event) => updateRedirect(index, event.target.value)}
                  placeholder={index === 0 ? "https://example.com/oauth/callback" : "Add another redirect URI"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="oauth-button--compact"
                  onClick={() => removeRedirect(index)}
                  disabled={redirectUris.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="oauth-card__footer">
            <Button type="button" variant="secondary" onClick={addRedirect}>
              Add redirect URI
            </Button>
          </div>
        </div>

        <aside className="oauth-card oauth-card--accent">
          <div className="oauth-card__header">
            <h3>Creation checklist</h3>
          </div>
          <ul className="oauth-checklist">
            <li>Your app ID should stay stable once clients start using it.</li>
            <li>Include localhost callbacks now if you plan to test locally.</li>
            <li>The client secret will be shown once, so copy it somewhere safe.</li>
            <li>Your account ID is filled automatically from the current session.</li>
          </ul>
        </aside>
      </div>

      {error ? <p className="oauth-error">{error}</p> : null}

      <div className="oauth-action-row">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} loading={loading}>
          Create application
          <Icon.Arrow />
        </Button>
      </div>
    </section>
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
  onDeleted: (appId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const redirectUris = useMemo(
    () => normalizeRedirectUris(app.redirect_uris),
    [app.redirect_uris],
  );

  async function deleteApp() {
    setLoading(true);
    try {
      const response = await fetch(`${OAUTH_API}/v1/apps/${encodeURIComponent(app.app_id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_code: secret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data.error || "Unable to delete application."));
      }
      setToast({ message: "Application deleted.", tone: "success" });
      window.setTimeout(() => onDeleted(app.app_id), 700);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to delete application.";
      setToast({ message, tone: "error" });
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  async function generateLink() {
    setLinkLoading(true);
    try {
      const response = await fetch(`${OAUTH_API}/v1/oauth/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, app_id: app.app_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.oauth_link) {
        throw new Error(String(data.message || data.error || "Unable to generate OAuth link."));
      }
      setGeneratedLink(String(data.oauth_link));
      setToast({ message: "Fresh OAuth login link generated.", tone: "success" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to generate OAuth link.";
      setToast({ message, tone: "error" });
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <section className="oauth-panel oauth-panel--wide">
      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}

      <div className="oauth-panel__heading">
        <button type="button" className="oauth-back-button" onClick={onBack}>
          <Icon.Back />
          Back to apps
        </button>
        <Pill>OAuth application</Pill>
        <h2>{app.app_name}</h2>
        <p>{app.description || "Credentials, redirect URLs, and OAuth handoff tools for this application."}</p>
      </div>

      <div className="oauth-detail-grid">
        <div className="oauth-card">
          <div className="oauth-card__header">
            <h3>Credentials</h3>
            <p>Keep the client secret safe. It may not be shown again after this session.</p>
          </div>
          <CopyField label="Client ID" value={app.app_id} />
          {app.client_secret ? (
            <CopyField label="Client secret" value={app.client_secret} secret />
          ) : (
            <p className="oauth-note">
              This app was restored from your local session, so only the app ID is available here.
            </p>
          )}
        </div>

        <div className="oauth-card">
          <div className="oauth-card__header">
            <h3>Redirect URIs</h3>
            <p>These are the callback URLs currently attached to this app in the dashboard state.</p>
          </div>
          {redirectUris.length ? (
            <ul className="oauth-uri-list">
              {redirectUris.map((uri) => (
                <li key={uri}>
                  <code>{uri}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="oauth-note">No redirect URIs are stored for this app yet.</p>
          )}
        </div>

        <div className="oauth-card oauth-card--span-2">
          <div className="oauth-card__header">
            <h3>OAuth sign-in handoff</h3>
            <p>Generate a temporary link tied to your current OAuth session to test user authorization.</p>
          </div>

          <div className="oauth-inline-actions">
            <Button type="button" variant="secondary" onClick={() => void generateLink()} loading={linkLoading}>
              <Icon.Link />
              Generate test login link
            </Button>
          </div>

          {generatedLink ? (
            <CopyField label="Generated login link" value={generatedLink} />
          ) : (
            <p className="oauth-note">
              Generate a link when you want to test the login handoff route for this app.
            </p>
          )}

          <div className="oauth-code-block">
            <span className="oauth-code-block__label">Next call</span>
            <code>{`POST ${OAUTH_API}/v1/oauth/links`}</code>
            <pre>{JSON.stringify({ secret: "YOUR_SESSION_SECRET", app_id: app.app_id }, null, 2)}</pre>
          </div>
        </div>

        <div className="oauth-card oauth-card--danger oauth-card--span-2">
          <div className="oauth-card__header">
            <h3>Danger zone</h3>
            <p>Deleting an app removes its dashboard entry and OAuth client record.</p>
          </div>

          {!confirmDelete ? (
            <div className="oauth-danger-row">
              <div>
                <strong>Delete this application</strong>
                <p>This action cannot be undone.</p>
              </div>
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                <Icon.Trash />
                Delete app
              </Button>
            </div>
          ) : (
            <div className="oauth-confirm-box">
              <p>Delete <strong>{app.app_name}</strong> permanently?</p>
              <div className="oauth-inline-actions">
                <Button type="button" variant="danger" onClick={() => void deleteApp()} loading={loading}>
                  Confirm delete
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  user,
  secret,
  apps,
  onAppsChange,
  onLogout,
}: {
  user: User;
  secret: string;
  apps: OAuthApp[];
  onAppsChange: (apps: OAuthApp[]) => void;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("overview");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "created">("created");
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");

  const selectedApp = apps.find((entry) => entry.app_id === selectedAppId) ?? null;
  const sortedApps = useMemo(() => {
    const next = [...apps];
    if (sortBy === "name") {
      next.sort((a, b) => a.app_name.localeCompare(b.app_name));
      return next;
    }
    return next.reverse();
  }, [apps, sortBy]);

  function openDetail(app: OAuthApp) {
    setSelectedAppId(app.app_id);
    setView("detail");
  }

  function handleCreated(app: OAuthApp) {
    const nextApps = [app, ...apps.filter((entry) => entry.app_id !== app.app_id)];
    onAppsChange(nextApps);
    setSelectedAppId(app.app_id);
    setView("detail");
    setToast({ message: "Application created successfully.", tone: "success" });
  }

  function handleDeleted(appId: string) {
    const nextApps = apps.filter((entry) => entry.app_id !== appId);
    onAppsChange(nextApps);
    setSelectedAppId(null);
    setView("overview");
  }

  return (
    <main className="oauth-dashboard">
      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}

      <aside className="oauth-sidebar">
        <div className="oauth-sidebar__brand">
          <Icon.Logo />
          <div>
            <strong>OpenCom</strong>
            <span>Developer portal</span>
          </div>
        </div>

        <div className="oauth-sidebar__nav">
          <div className="oauth-sidebar__section-title">Manage</div>
          <button
            type="button"
            className={classNames("oauth-nav-button", view !== "create" && view !== "detail" && "is-active")}
            onClick={() => setView("overview")}
          >
            <Icon.Apps />
            Applications
          </button>
          <button
            type="button"
            className={classNames("oauth-nav-button", view === "create" && "is-active")}
            onClick={() => setView("create")}
          >
            <Icon.Spark />
            New application
          </button>
          <div className="oauth-sidebar__section-title">Explore</div>
          <button type="button" className="oauth-nav-button oauth-nav-button--muted" disabled>
            Teams
          </button>
          <button type="button" className="oauth-nav-button oauth-nav-button--muted" disabled>
            Documentation
          </button>
        </div>

        <div className="oauth-session-card">
          <span className="oauth-session-card__label">Current OAuth session</span>
          <CopyField label="Session secret" value={secret} secret />
          <p>
            This secret is used by the app manager and link generation routes
            during your current dashboard session.
          </p>
        </div>

        <div className="oauth-sidebar-promo">
          <span className="oauth-sidebar-promo__eyebrow">Developer notes</span>
          <strong>Build faster with cleaner app setup.</strong>
          <p>
            Use one application per surface while you are iterating, then split
            production clients once the auth flow is stable.
          </p>
        </div>

        <div className="oauth-sidebar__user">
          <div className="oauth-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.username}</strong>
            <span>{user.email}</span>
          </div>
          <Button type="button" variant="ghost" className="oauth-button--compact" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      <section className="oauth-main">
        {view === "create" ? (
          <CreateAppView
            user={user}
            secret={secret}
            onCreated={handleCreated}
            onCancel={() => setView("overview")}
          />
        ) : null}

        {view === "detail" && selectedApp ? (
          <AppDetail
            app={selectedApp}
            secret={secret}
            onBack={() => setView("overview")}
            onDeleted={handleDeleted}
          />
        ) : null}

        {view === "overview" ? (
          <section className="oauth-panel">
            <div className="oauth-panel__heading">
              <h1>Applications</h1>
              <p>
                Create and manage OpenCom OAuth applications for local development,
                staging, and production handoff flows.
              </p>
            </div>

            <div className="oauth-top-actions">
              <Button type="button" onClick={() => setView("create")}>
                <Icon.Spark />
                New application
              </Button>
            </div>

            <div className="oauth-stat-grid">
              <StatCard
                label="Applications"
                value={String(apps.length)}
                meta={apps.length ? "Stored in this browser session" : "Create your first app to get started"}
              />
              <StatCard
                label="Account ID"
                value={user.id}
                meta="Filled automatically during app creation"
              />
              <StatCard
                label="API targets"
                value="2"
                meta="Core API for login, OAuth API for app management"
              />
            </div>

            <div className="oauth-overview-head">
              <div>
                <h2>My Applications</h2>
                <p>
                  {apps.length
                    ? "Open an app to see credentials, redirect URIs, and quick test tools."
                    : "No apps yet. Create one and this dashboard will keep it handy for the rest of your session."}
                </p>
              </div>
            </div>

            <div className="oauth-toolbar">
              <label className="oauth-toolbar__group">
                <span>Sort by</span>
                <select
                  className="oauth-select"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "name" | "created")}
                >
                  <option value="created">Date created</option>
                  <option value="name">Name</option>
                </select>
              </label>

              <div className="oauth-toolbar__toggle">
                <button
                  type="button"
                  className={classNames("oauth-toggle-button", density === "compact" && "is-active")}
                  onClick={() => setDensity("compact")}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={classNames("oauth-toggle-button", density === "comfortable" && "is-active")}
                  onClick={() => setDensity("comfortable")}
                >
                  Large
                </button>
              </div>
            </div>

            {sortedApps.length ? (
              <div className={classNames("oauth-app-grid", density === "comfortable" && "oauth-app-grid--comfortable")}>
                {sortedApps.map((app) => (
                  <button
                    type="button"
                    key={app.app_id}
                    className="oauth-app-card"
                    onClick={() => openDetail(app)}
                  >
                    <div className="oauth-app-card__top">
                      <Pill>{app.client_secret ? "New secret" : "Saved app"}</Pill>
                    </div>
                    <div className="oauth-app-card__body">
                      <h3>{app.app_name}</h3>
                      <code>{app.app_id}</code>
                      <p>{app.description || "No description yet for this OAuth application."}</p>
                    </div>
                    <div className="oauth-app-card__footer">
                      <span>Open details</span>
                      <Icon.Arrow />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="oauth-empty-state">
                <div className="oauth-empty-state__art" aria-hidden="true">
                  <div className="oauth-empty-state__monitor" />
                  <div className="oauth-empty-state__panel" />
                  <div className="oauth-empty-state__orb oauth-empty-state__orb--lg" />
                  <div className="oauth-empty-state__orb oauth-empty-state__orb--sm" />
                </div>
                <h3>No applications yet</h3>
                <p>
                  Click New Application above to register your first OAuth client.
                </p>
                <Button type="button" onClick={() => setView("create")}>
                  Create your first app
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [secret, setSecret] = useState("");
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = safeParseSession();
    if (stored) {
      setUser(stored.user);
      setSecret(stored.secret);
      setApps(stored.apps);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistSession(user, secret, apps);
  }, [user, secret, apps, hydrated]);

  if (!hydrated) {
    return <main className="oauth-loading-screen">Loading developer portal…</main>;
  }

  return user && secret ? (
    <Dashboard
      user={user}
      secret={secret}
      apps={apps}
      onAppsChange={setApps}
      onLogout={() => {
        setUser(null);
        setSecret("");
        setApps([]);
      }}
    />
  ) : (
    <LoginView
      onLogin={(nextUser, nextSecret) => {
        setUser(nextUser);
        setSecret(nextSecret);
      }}
    />
  );
}
