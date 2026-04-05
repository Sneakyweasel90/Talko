const {
  app,
  BrowserWindow,
  dialog,
  shell,
  protocol,
  globalShortcut,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const {
  loadWindowState,
  saveWindowState,
} = require("./electron/windowState.cjs");
const { initPtt, uIOhook } = require("./electron/ptt.cjs");
const { initIpc } = require("./electron/ipc.cjs");
const { checkForUpdates } = require("./electron/updater.cjs");

let win = null;
let progressWin = null;

const logPath = path.join(os.homedir(), "talko-log.txt");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1024 * 1024) {
      fs.writeFileSync(logPath, line);
    } else {
      fs.appendFileSync(logPath, line);
    }
  } catch {}
  console.log(msg);
}

function createProgressWindow() {
  progressWin = new BrowserWindow({
    width: 420,
    height: 180,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: "#020a06",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const html = `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #020a06; color: #00ff88; font-family: 'Share Tech Mono', monospace;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; gap: 16px; padding: 24px; border: 1px solid rgba(0,255,136,0.2); user-select: none; }
    .title { font-size: 13px; letter-spacing: 0.2em; opacity: 0.7; }
    .version { font-size: 11px; opacity: 0.5; letter-spacing: 0.1em; }
    .bar-track { width: 100%; height: 6px; background: rgba(0,255,136,0.1); border-radius: 3px;
      border: 1px solid rgba(0,255,136,0.2); overflow: hidden; }
    .bar-fill { height: 100%; background: #00ff88; border-radius: 3px; width: 0%; transition: width 0.3s ease; }
    .speed { font-size: 10px; opacity: 0.4; letter-spacing: 0.05em; min-height: 14px; }
  </style></head><body>
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
  </body></html>`;
  progressWin.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html),
  );
}

function createWindow() {
  const windowState = loadWindowState();
  win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
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

  win.on("resize", () => saveWindowState(win));
  win.on("move", () => saveWindowState(win));
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on("did-finish-load", () => win.webContents.setZoomFactor(1));
  win.webContents.on("zoom-changed", (e) => {
    e.preventDefault();
    win.webContents.setZoomFactor(1);
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (
      (input.control || input.meta) &&
      ["+", "-", "=", "0"].includes(input.key)
    )
      event.preventDefault();
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }

  // Allow media (microphone/camera) and notifications. Everything else denied.
  win.webContents.session.setPermissionRequestHandler(
    (wc, permission, callback) => {
      callback(permission === "media" || permission === "notifications");
    },
  );
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

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION: " + err.message);
  dialog.showErrorBox("Unexpected Error", err.message);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  uIOhook.stop();
});

app.whenReady().then(async () => {
  log("App ready");

  initPtt(() => win);
  initIpc(() => win, log);

  protocol.interceptFileProtocol("file", (request, callback) => {
    let filePath = decodeURIComponent(request.url.slice("file:///".length));
    filePath = filePath.replace(/\//g, path.sep);
    if (
      filePath.includes("app.asar") &&
      !filePath.includes("app.asar.unpacked") &&
      (filePath.endsWith(".wasm") || filePath.endsWith("workletProcessor.js"))
    ) {
      callback({ path: filePath.replace("app.asar", "app.asar.unpacked") });
    } else {
      callback({ path: filePath });
    }
  });

  const canContinue = await checkForUpdates(
    app,
    createProgressWindow,
    () => progressWin,
    log,
  );
  if (canContinue) createWindow();
});

app.on("window-all-closed", () => app.quit());
