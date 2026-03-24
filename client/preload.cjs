const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("minimize"),
  maximize: () => ipcRenderer.send("maximize"),
  close: () => ipcRenderer.send("close"),
  notify: (title, body) => ipcRenderer.send("notify", { title, body }),
  readFile: (filename) => ipcRenderer.invoke("read-file", filename),
  pttRegister: (key) => ipcRenderer.send("ptt-register", key),
  pttUnregister: () => ipcRenderer.send("ptt-unregister"),
  onPttKeydown: (cb) => ipcRenderer.on("ptt-keydown", cb),
  offPttKeydown: (cb) => ipcRenderer.removeListener("ptt-keydown", cb),
  onPttKeyup: (cb) => ipcRenderer.on("ptt-keyup", cb),
  offPttKeyup: (cb) => ipcRenderer.removeListener("ptt-keyup", cb),
  getSources: () => ipcRenderer.invoke("get-sources"),
  saveBg: (dataUrl) => ipcRenderer.invoke("save-bg", dataUrl),
  loadBg: () => ipcRenderer.invoke("load-bg"),
  clearBg: () => ipcRenderer.invoke("clear-bg"),
  getIdleTime: () => ipcRenderer.invoke("get-idle-time"),
});