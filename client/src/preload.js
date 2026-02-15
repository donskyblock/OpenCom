import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("opencomDesktop", {
  getLatestOfficialBuild: (options) => ipcRenderer.invoke("build:get-latest", options)
});
