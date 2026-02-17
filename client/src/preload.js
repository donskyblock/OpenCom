import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("opencomDesktopBridge", {
  setPresenceAuth: (payload) => ipcRenderer.send("rpc:auth", payload || {}),
  rpcInfo: () => ipcRenderer.invoke("rpc:info")
});
