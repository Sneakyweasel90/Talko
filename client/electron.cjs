const { app, BrowserWindow, ipcMain, Notification, dialog, shell, protocol, desktopCapturer } = require("electron");
const path = require("path");
const https = require("https");
const fs = require("fs");
const os = require("os");
const { UiohookKey, uIOhook } = require("uiohook-napi");

const GITHUB_REPO = "Sneakyweasel90/Talko";
//PPT key global
const { globalShortcut } = require("electron");


let win;
let progressWin;
let currentPttKey = null;

const logPath = path.join(os.homedir(), "talko-log.txt");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(msg);
}

function isNewerVersion(latest, current) {
  const latestParts = latest.replace(/^v/, "").split(".").map(Number);
  const currentParts = current.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

function getPlatformAsset(assets) {
  if (process.platform === "win32") {
    return assets?.find(a => a.name.endsWith(".exe"));
  } else if (process.platform === "linux") {
    return assets?.find(a => a.name.endsWith(".AppImage"));
  }
  return null;
}

function getDownloadFileName() {
  if (process.platform === "win32") return "TalkoSetup.exe";
  if (process.platform === "linux") return "Talko.AppImage";
  return "Talko";
}

function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        "User-Agent": "Talko-App",
        "Accept": "application/vnd.github+json",
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ tag_name: parsed.tag_name, assets: parsed.assets || [] });
        } catch (e) {
          reject(new Error("Failed to parse release data: " + e.message));
        }
      });
    }).on("error", reject);
  });
}

const KEY_MAP = {
  "Space": UiohookKey.Space,
  "A": UiohookKey.A, "B": UiohookKey.B, "C": UiohookKey.C,
  "D": UiohookKey.D, "E": UiohookKey.E, "F": UiohookKey.F,
  "G": UiohookKey.G, "H": UiohookKey.H, "I": UiohookKey.I,
  "J": UiohookKey.J, "K": UiohookKey.K, "L": UiohookKey.L,
  "M": UiohookKey.M, "N": UiohookKey.N, "O": UiohookKey.O,
  "P": UiohookKey.P, "Q": UiohookKey.Q, "R": UiohookKey.R,
  "S": UiohookKey.S, "T": UiohookKey.T, "U": UiohookKey.U,
  "V": UiohookKey.V, "W": UiohookKey.W, "X": UiohookKey.X,
  "Y": UiohookKey.Y, "Z": UiohookKey.Z,
  "F1": UiohookKey.F1, "F2": UiohookKey.F2, "F3": UiohookKey.F3,
  "F4": UiohookKey.F4, "F5": UiohookKey.F5, "F6": UiohookKey.F6,
  "F7": UiohookKey.F7, "F8": UiohookKey.F8, "F9": UiohookKey.F9,
  "F10": UiohookKey.F10, "F11": UiohookKey.F11, "F12": UiohookKey.F12,
};

let pttKeyCode = null;

uIOhook.on("keydown", (e) => {
  if (pttKeyCode !== null && e.keycode === pttKeyCode) {
    win?.webContents.send("ptt-keydown");
  }
});

uIOhook.on("keyup", (e) => {
  if (pttKeyCode !== null && e.keycode === pttKeyCode) {
    win?.webContents.send("ptt-keyup");
  }
});

uIOhook.start();

ipcMain.on("ptt-register", (event, key) => {
  pttKeyCode = KEY_MAP[key] ?? null;
  log("PTT registered: " + key + " -> " + pttKeyCode);
});

ipcMain.on("ptt-unregister", () => {
  pttKeyCode = null;
});


function createProgressWindow() {
  progressWin = new BrowserWindow({
    width: 420,
    height: 180,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: "#020a06",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #020a06;
          color: #00ff88;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 16px;
          padding: 24px;
          border: 1px solid rgba(0,255,136,0.2);
          user-select: none;
        }
        .title { font-size: 13px; letter-spacing: 0.2em; opacity: 0.7; }
        .version { font-size: 11px; opacity: 0.5; letter-spacing: 0.1em; }
        .bar-track {
          width: 100%;
          height: 6px;
          background: rgba(0,255,136,0.1);
          border-radius: 3px;
          border: 1px solid rgba(0,255,136,0.2);
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: #00ff88;
          border-radius: 3px;
          width: 0%;
          transition: width 0.3s ease;
        }
        .speed { font-size: 10px; opacity: 0.4; letter-spacing: 0.05em; min-height: 14px; }
      </style>
    </head>
    <body>
      <div class="title">DOWNLOADING UPDATE</div>
      <div class="version" id="ver"></div>
      <div class="bar-track"><div class="bar-fill" id="bar"></div></div>
      <div class="speed" id="speed"></div>
      <script>
        const { ipcRenderer } = require("electron");
        ipcRenderer.on("download-version", (_, v) => { document.getElementById("ver").textContent = v; });
        ipcRenderer.on("download-progress", (_, { percent, mbps }) => {
          document.getElementById("bar").style.width = percent + "%";
          document.getElementById("speed").textContent = mbps || "";
        });
      </script>
    </body>
    </html>`;

  progressWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function downloadFile(url, destPath, version) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl) => {
      https.get(currentUrl, { headers: { "User-Agent": "Talko-App" } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return attempt(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const totalSize = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        createProgressWindow();
        if (progressWin) {
          progressWin.webContents.once("did-finish-load", () => {
            progressWin?.webContents.send("download-version", version);
          });
        }

        const file = fs.createWriteStream(destPath);

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);

          if (progressWin && totalSize > 0) {
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            let mbps = "";
            if (elapsed >= 0.5) {
              const speed = ((downloaded - lastBytes) / elapsed / 1024 / 1024).toFixed(1);
              mbps = speed + " MB/s";
              lastTime = now;
              lastBytes = downloaded;
            }
            const percent = (downloaded / totalSize) * 100;
            progressWin.webContents.send("download-progress", {
              percent: Math.min(percent, 99),
              mbps,
            });
          }
        });

        res.on("end", () => {
          file.end(() => {
            if (progressWin) {
              progressWin.webContents.send("download-progress", { percent: 100, mbps: "" });
            }
            log("Download complete: " + destPath);
            resolve();
          });
        });

        res.on("error", (e) => { log("Response error: " + e.message); reject(e); });
        file.on("error", (e) => { log("File write error: " + e.message); reject(e); });
      }).on("error", (e) => { log("HTTPS error: " + e.message); reject(e); });
    };
    attempt(url);
  });
}

async function installUpdate(destPath) {
  if (process.platform === "win32") {
    shell.openPath(destPath).then(() => {
      setTimeout(() => {
        try { fs.unlinkSync(destPath); } catch (e) { log("Could not delete installer: " + e.message); }
      }, 5000);
    });
  } else if (process.platform === "linux") {
    fs.chmodSync(destPath, "755");
    shell.openPath(destPath);
  }
}

async function checkForUpdates() {
  log("checkForUpdates started");
  if (process.env.NODE_ENV === "development") { log("Dev mode, skipping update check"); return true; }

  try {
    log("Fetching latest release...");
    const release = await getLatestRelease();
    const latestVersion = release.tag_name;
    const currentVersion = `v${app.getVersion()}`;
    log(`Current: ${currentVersion}, Latest: ${latestVersion}`);

    if (isNewerVersion(latestVersion, currentVersion)) {
      log("Update available!");
      const asset = getPlatformAsset(release.assets);
      log("Asset found: " + JSON.stringify(asset?.name));
      const downloadUrl = asset?.browser_download_url;
      log("Download URL: " + downloadUrl);

      const { response } = await dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: "A new version of Talko is available!",
        detail: `Current version: ${currentVersion}\nNew version: ${latestVersion}\n\nYou must update to continue. Download now?`,
        buttons: ["Download & Install", "Close"],
        defaultId: 0,
        cancelId: 1,
      });

      log("User response: " + response);

      if (response === 0 && downloadUrl) {
        try {
          const destPath = path.join(os.homedir(), "Downloads", getDownloadFileName());
          log("Saving to: " + destPath);
          await downloadFile(downloadUrl, destPath, latestVersion);
          log("Download finished, launching installer");

          if (progressWin) { progressWin.close(); progressWin = null; }

          await installUpdate(destPath);
          await new Promise(r => setTimeout(r, 3000));
          log("Quitting");
          app.quit();
          return false;
        } catch (err) {
          log("Download/install error: " + err.message);
          if (progressWin) { progressWin.close(); progressWin = null; }
          await dialog.showMessageBox({
            type: "error",
            title: "Download Failed",
            message: "Could not download update.",
            detail: `Error: ${err.message}\n\nPlease visit GitHub to download manually.`,
            buttons: ["Open GitHub", "Close"],
            }).then(({ response: r }) => {
              if (r === 0) shell.openExternal(`https://github.com/Sneakyweasel90/Talko/releases`);
            });
          app.quit();
          return false;
        }
      }

      log("User chose Close, quitting");
      app.quit();
      return false;
    }

    log("No update needed, launching app");
  } catch (err) {
    log("checkForUpdates error: " + err.message);
  }
  return true;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: "#020a06",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.webContents.setVisualZoomLevelLimits(1, 1);

  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);
  });

  win.webContents.on("zoom-changed", (event, direction) => {
    event.preventDefault();
    win.webContents.setZoomFactor(1);
  });

  win.webContents.on("before-input-event", (event, input) => {
    if ((input.control || input.meta) && ["+", "-", "=", "0"].includes(input.key)) {
      event.preventDefault();
    }
  });


  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media") callback(true);
    else callback(false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}
ipcMain.handle("read-file", async (event, filename) => {
  // .wasm and workletProcessor.js are unpacked from asar, others are inside it
  const appPath = app.getAppPath();
  const unpackedPath = path.join(appPath.replace("app.asar", "app.asar.unpacked"), "dist", filename);
  const normalPath = path.join(appPath, "dist", filename);
  try {
    return fs.readFileSync(unpackedPath);
  } catch {
    return fs.readFileSync(normalPath);
  }
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

ipcMain.on("minimize", () => win?.minimize());
ipcMain.on("maximize", () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on("close", () => win?.close());
ipcMain.on("notify", (event, { title, body }) => {
  if (win && !win.isFocused() && Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

ipcMain.on("ptt-register", (event, key) => {
  // Unregister old key if any
  if (currentPttKey) {
    globalShortcut.unregister(currentPttKey);
    currentPttKey = null;
  }
  if (!key) return;

  // Convert our key format to Electron accelerator format
  const accelerator = key === "Space" ? "Space" : key;

  try {
    const success = globalShortcut.register(accelerator, () => {
      win?.webContents.send("ptt-keydown");
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

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION: " + err.message + "\n" + err.stack);
  dialog.showErrorBox("Unexpected Error", err.message);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  uIOhook.stop();
});

app.whenReady().then(async () => {
  log("App ready");

  protocol.interceptFileProtocol("file", (request, callback) => {
    let filePath = decodeURIComponent(request.url.slice("file:///".length));
    filePath = filePath.replace(/\//g, path.sep);
    if (filePath.includes("app.asar") && !filePath.includes("app.asar.unpacked") &&
        (filePath.endsWith(".wasm") || filePath.endsWith("workletProcessor.js"))) {
      const fixed = filePath.replace("app.asar", "app.asar.unpacked");
      log("Redirecting: " + filePath + " -> " + fixed);
      callback({ path: fixed });
    } else {
      callback({ path: filePath });
    }
  });

  const canContinue = await checkForUpdates();
  if (canContinue) createWindow();
});

app.on("window-all-closed", () => app.quit());
