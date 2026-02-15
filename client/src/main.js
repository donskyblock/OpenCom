import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import log from "electron-log";
import { getLatestOfficialBuild } from "./latestBuild.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENCOM_WEB_URL = process.env.OPENCOM_APP_URL || "https://opencom.online";

log.initialize();
log.transports.file.level = "info";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#141621",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const url = new URL(OPENCOM_WEB_URL);
  url.searchParams.set("desktop", "1");
  mainWindow.loadURL(url.toString());

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const allowedOrigin = new URL(url.toString()).origin;
    const nextOrigin = new URL(targetUrl).origin;
    if (nextOrigin !== allowedOrigin) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("build:get-latest", async (_event, opts = {}) => getLatestOfficialBuild(opts));
