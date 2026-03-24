const { ipcMain, Notification, globalShortcut, desktopCapturer, powerMonitor } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const BG_PATH = path.join(os.homedir(), "talko-bg.jpg");

let currentPttKey = null;

function initIpc(getWin, log) {
  ipcMain.handle("read-file", async (event, filename) => {
    const appPath = require("electron").app.getAppPath();
    const unpackedPath = path.join(appPath.replace("app.asar", "app.asar.unpacked"), "dist", filename);
    const normalPath = path.join(appPath, "dist", filename);
    try {
      return fs.readFileSync(unpackedPath);
    } catch {
      return fs.readFileSync(normalPath);
    }
  });

  ipcMain.handle("get-idle-time", () => {
    return powerMonitor.getSystemIdleTime();
  });

  ipcMain.handle("get-sources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnailDataURL: s.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle("save-bg", async (event, dataUrl) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(BG_PATH, base64, "base64");
      return true;
    } catch (e) {
      log("save-bg error: " + e.message);
      return false;
    }
  });

  ipcMain.handle("load-bg", async () => {
    try {
      if (!fs.existsSync(BG_PATH)) return "";
      const data = fs.readFileSync(BG_PATH);
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    } catch (e) {
      log("load-bg error: " + e.message);
      return "";
    }
  });

  ipcMain.handle("clear-bg", async () => {
    try { fs.unlinkSync(BG_PATH); } catch {}
    return true;
  });

  ipcMain.on("minimize", () => getWin()?.minimize());
  ipcMain.on("maximize", () => getWin()?.isMaximized() ? getWin().unmaximize() : getWin().maximize());
  ipcMain.on("close", () => getWin()?.close());

  ipcMain.on("notify", (event, { title, body }) => {
    const win = getWin();
    if (win && !win.isFocused() && Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show();
    }
  });

  ipcMain.on("ptt-register", (event, key) => {
    if (currentPttKey) {
      globalShortcut.unregister(currentPttKey);
      currentPttKey = null;
    }
    if (!key) return;
    const accelerator = key === "Space" ? "Space" : key;
    try {
      const success = globalShortcut.register(accelerator, () => {
        getWin()?.webContents.send("ptt-keydown");
      });
      if (success) currentPttKey = accelerator;
    } catch (e) {
      log("globalShortcut register failed: " + e.message);
    }
  });

  ipcMain.on("ptt-unregister", () => {
    if (currentPttKey) {
      globalShortcut.unregister(currentPttKey);
      currentPttKey = null;
    }
  });
}

module.exports = { initIpc };