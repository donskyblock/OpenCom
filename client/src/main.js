import { app, BrowserWindow, shell, ipcMain } from "electron";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import log from "electron-log";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REMOTE_FALLBACK_URL = process.env.OPENCOM_APP_URL || "https://opencom.online";
const CORE_API_URL = process.env.OPENCOM_CORE_API_URL || "https://api.opencom.online";
const LOCAL_INDEX = path.join(__dirname, "web", "index.html");
const LOCAL_ICON = path.join(__dirname, "web", "logo.png");
const RPC_HOST = process.env.OPENCOM_RPC_HOST || "127.0.0.1";
const RPC_PORT = Number(process.env.OPENCOM_RPC_PORT || 6483);

let rpcServer = null;
const rpcAuthState = {
  accessToken: "",
  coreApi: ""
};

const SESSION_FILE_NAME = "data.json";

function getSessionFilePath() {
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, SESSION_FILE_NAME);
}

function getSessionKey() {
  return crypto
    .createHash("sha256")
    .update(`${app.getName()}::${app.getPath("userData")}::opencom-session`)
    .digest();
}

function obfuscateSession(payload) {
  const json = JSON.stringify(payload || {});
  const input = Buffer.from(json, "utf8");
  const key = getSessionKey();
  const out = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = input[i] ^ key[i % key.length];
  return out.toString("base64");
}

function deobfuscateSession(raw) {
  const input = Buffer.from(String(raw || ""), "base64");
  if (!input.length) return {};
  const key = getSessionKey();
  const out = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = input[i] ^ key[i % key.length];
  return JSON.parse(out.toString("utf8"));
}

function readDesktopSession() {
  try {
    const filePath = getSessionFilePath();
    if (!fs.existsSync(filePath)) return {};
    const encoded = fs.readFileSync(filePath, "utf8").trim();
    if (!encoded) return {};
    return deobfuscateSession(encoded);
  } catch (error) {
    log.warn("Failed reading desktop session", error);
    return {};
  }
}

function writeDesktopSession(session) {
  try {
    const filePath = getSessionFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const encoded = obfuscateSession(session || {});
    fs.writeFileSync(filePath, encoded, "utf8");
    return true;
  } catch (error) {
    log.error("Failed writing desktop session", error);
    return false;
  }
}

function showPromptWindow(promptText = "", defaultValue = "", title = "OpenCom") {
  return new Promise((resolve) => {
    const parentWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const promptWindow = new BrowserWindow({
      width: 420,
      height: 180,
      parent: parentWindow || undefined,
      modal: Boolean(parentWindow),
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      title,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
      }
    });

    let settled = false;
    const onSubmit = (_event, value) => finish(value);
    const onCancel = () => finish(null);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener("desktop:prompt:submit", onSubmit);
      ipcMain.removeListener("desktop:prompt:cancel", onCancel);
      resolve(typeof value === "string" ? value : null);
      if (!promptWindow.isDestroyed()) promptWindow.close();
    };

    promptWindow.on("closed", () => finish(null));
    promptWindow.webContents.on("did-finish-load", () => promptWindow.show());
    promptWindow.webContents.on("will-navigate", (event) => event.preventDefault());
    promptWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    ipcMain.on("desktop:prompt:submit", onSubmit);
    ipcMain.on("desktop:prompt:cancel", onCancel);

    const safeText = String(promptText || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeDefault = String(defaultValue || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#121a2f;color:#e9efff;margin:0;padding:16px}
      p{margin:0 0 12px 0;font-size:14px;line-height:1.35}
      input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #3a4d72;background:#0d1426;color:#e9efff}
      .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
      button{padding:8px 12px;border-radius:8px;border:1px solid #4f6ca1;background:#2d6cdf;color:white;cursor:pointer}
      button.ghost{background:transparent;color:#c5d4ff}
    </style></head><body>
      <p>${safeText}</p>
      <input id="v" />
      <div class="actions"><button class="ghost" id="cancel">Cancel</button><button id="ok">OK</button></div>
      <script>
        const { ipcRenderer } = require("electron");
        const input = document.getElementById("v");
        input.value = \`${safeDefault}\`;
        input.focus();
        input.select();
        document.getElementById("ok").addEventListener("click", () => ipcRenderer.send("desktop:prompt:submit", input.value));
        document.getElementById("cancel").addEventListener("click", () => ipcRenderer.send("desktop:prompt:cancel"));
        window.addEventListener("keydown", (event) => {
          if (event.key === "Enter") ipcRenderer.send("desktop:prompt:submit", input.value);
          if (event.key === "Escape") ipcRenderer.send("desktop:prompt:cancel");
        });
      </script>
    </body></html>`;
    promptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

log.initialize();
log.transports.file.level = "info";

// Vesktop-style approach: thin shell that runs the web client with minimal desktop glue.
app.commandLine.appendSwitch("disable-features", "WidgetLayering");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#141621",
    ...(fs.existsSync(LOCAL_ICON) ? { icon: LOCAL_ICON } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  const desktopSearch = new URLSearchParams({
    desktop: "1",
    route: "/app",
    coreApi: CORE_API_URL
  }).toString();

  if (fs.existsSync(LOCAL_INDEX)) {
    mainWindow.loadFile(LOCAL_INDEX, { search: desktopSearch });
  } else {
    const url = new URL(REMOTE_FALLBACK_URL);
    url.pathname = "/app";
    url.searchParams.set("desktop", "1");
    url.searchParams.set("coreApi", CORE_API_URL);
    mainWindow.loadURL(url.toString());
  }

  mainWindow.webContents.on("did-finish-load", () => {
    log.info("Renderer finished load", { url: mainWindow.webContents.getURL() });
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedUrl, isMainFrame) => {
    log.error("Renderer failed to load", { code, description, validatedUrl, isMainFrame });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log.error("Renderer process gone", details);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      log.warn("Renderer console", { level, message, line, sourceId });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const next = new URL(targetUrl);
    const isLocalApp = next.protocol === "file:";
    const isFallbackOrigin = (() => {
      try {
        return next.origin === new URL(REMOTE_FALLBACK_URL).origin;
      } catch {
        return false;
      }
    })();
    if (!isLocalApp && !isFallbackOrigin) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
}

function writeJson(rep, code, payload) {
  rep.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  rep.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function forwardPresenceRpc(pathname, method, body = null) {
  if (!rpcAuthState.accessToken || !rpcAuthState.coreApi) return { ok: false, code: 503, payload: { error: "RPC_NOT_READY" } };
  const base = rpcAuthState.coreApi.replace(/\/$/, "");
  const url = `${base}${pathname}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${rpcAuthState.accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, code: response.status, payload: data || { error: `HTTP_${response.status}` } };
  return { ok: true, code: 200, payload: data };
}

function startLocalRpcBridge() {
  rpcServer = createServer(async (req, rep) => {
    try {
      const url = new URL(req.url || "/", `http://${RPC_HOST}:${RPC_PORT}`);

      if (req.method === "OPTIONS") {
        rep.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        rep.end();
        return;
      }

      if (url.pathname === "/rpc/health" && req.method === "GET") {
        writeJson(rep, 200, {
          ok: true,
          service: "opencom-rpc-bridge",
          ready: Boolean(rpcAuthState.accessToken && rpcAuthState.coreApi),
          coreApi: rpcAuthState.coreApi || null
        });
        return;
      }

      if (url.pathname === "/rpc/activity" && req.method === "POST") {
        const body = await readJson(req).catch(() => ({}));
        const result = await forwardPresenceRpc("/v1/presence/rpc", "POST", { activity: body?.activity ?? null });
        writeJson(rep, result.code, result.payload);
        return;
      }

      if (url.pathname === "/rpc/activity" && req.method === "DELETE") {
        const result = await forwardPresenceRpc("/v1/presence/rpc", "DELETE");
        writeJson(rep, result.code, result.payload);
        return;
      }

      writeJson(rep, 404, { error: "NOT_FOUND" });
    } catch (error) {
      log.error("RPC bridge error", error);
      writeJson(rep, 500, { error: "RPC_BRIDGE_ERROR" });
    }
  });

  rpcServer.listen(RPC_PORT, RPC_HOST, () => {
    log.info(`OpenCom RPC bridge listening on http://${RPC_HOST}:${RPC_PORT}`);
  });
}

ipcMain.on("rpc:auth", (_event, payload = {}) => {
  const accessToken = typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
  const coreApi = typeof payload.coreApi === "string" ? payload.coreApi.trim() : "";
  rpcAuthState.accessToken = accessToken;
  rpcAuthState.coreApi = coreApi;
});

ipcMain.handle("rpc:info", () => ({
  host: RPC_HOST,
  port: RPC_PORT,
  ready: Boolean(rpcAuthState.accessToken && rpcAuthState.coreApi)
}));

ipcMain.handle("desktop:session:get", () => {
  const current = readDesktopSession();
  return {
    accessToken: typeof current.accessToken === "string" ? current.accessToken : "",
    refreshToken: typeof current.refreshToken === "string" ? current.refreshToken : ""
  };
});

ipcMain.handle("desktop:session:set", (_event, payload = {}) => {
  const next = {
    accessToken: typeof payload.accessToken === "string" ? payload.accessToken : "",
    refreshToken: typeof payload.refreshToken === "string" ? payload.refreshToken : ""
  };
  return { ok: writeDesktopSession(next) };
});

ipcMain.handle("desktop:prompt", async (_event, payload = {}) => {
  const text = typeof payload.text === "string" ? payload.text : "";
  const defaultValue = typeof payload.defaultValue === "string" ? payload.defaultValue : "";
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "OpenCom";
  const value = await showPromptWindow(text, defaultValue, title);
  return { value };
});

app.whenReady().then(() => {
  startLocalRpcBridge();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (rpcServer) {
    try { rpcServer.close(); } catch {}
    rpcServer = null;
  }
});
