const { dialog, shell } = require("electron");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

const GITHUB_REPO = "Sneakyweasel90/Talko";

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
  if (process.platform === "win32")
    return assets?.find((a) => a.name.endsWith(".exe"));
  if (process.platform === "linux")
    return assets?.find((a) => a.name.endsWith(".AppImage"));
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
        Accept: "application/vnd.github+json",
      },
    };
    https
      .get(options, (res) => {
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
      })
      .on("error", reject);
  });
}

function downloadFile(
  url,
  destPath,
  version,
  createProgressWindow,
  progressWinRef,
  log,
) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl) => {
      https
        .get(currentUrl, { headers: { "User-Agent": "Talko-App" } }, (res) => {
          if (res.statusCode === 302 || res.statusCode === 301)
            return attempt(res.headers.location);
          if (res.statusCode !== 200)
            return reject(new Error(`HTTP ${res.statusCode}`));

          const totalSize = parseInt(res.headers["content-length"] || "0", 10);
          let downloaded = 0;
          let lastTime = Date.now();
          let lastBytes = 0;

          createProgressWindow();
          const pw = progressWinRef();
          if (pw) {
            pw.webContents.once("did-finish-load", () => {
              pw.webContents.send("download-version", version);
            });
          }

          const file = fs.createWriteStream(destPath);
          res.on("data", (chunk) => {
            downloaded += chunk.length;
            file.write(chunk);
            const pw = progressWinRef();
            if (pw && totalSize > 0) {
              const now = Date.now();
              const elapsed = (now - lastTime) / 1000;
              let mbps = "";
              if (elapsed >= 0.5) {
                const speed = (
                  (downloaded - lastBytes) /
                  elapsed /
                  1024 /
                  1024
                ).toFixed(1);
                mbps = speed + " MB/s";
                lastTime = now;
                lastBytes = downloaded;
              }
              pw.webContents.send("download-progress", {
                percent: Math.min((downloaded / totalSize) * 100, 99),
                mbps,
              });
            }
          });
          res.on("end", () => {
            file.end(() => {
              progressWinRef()?.webContents.send("download-progress", {
                percent: 100,
                mbps: "",
              });
              log("Download complete: " + destPath);
              resolve();
            });
          });
          res.on("error", (e) => reject(e));
          file.on("error", (e) => reject(e));
        })
        .on("error", (e) => reject(e));
    };
    attempt(url);
  });
}

async function installUpdate(destPath) {
  if (process.platform === "win32") {
    shell.openPath(destPath).then(() => {
      setTimeout(() => {
        try {
          fs.unlinkSync(destPath);
        } catch {}
      }, 5000);
    });
  } else if (process.platform === "linux") {
    fs.chmodSync(destPath, "755");
    shell.openPath(destPath);
  }
}

async function checkForUpdates(app, createProgressWindow, progressWinRef, log) {
  log("checkForUpdates started");
  if (process.env.NODE_ENV === "development") {
    log("Dev mode, skipping");
    return true;
  }

  try {
    const release = await getLatestRelease();
    const latestVersion = release.tag_name;
    const currentVersion = `v${app.getVersion()}`;
    log(`Current: ${currentVersion}, Latest: ${latestVersion}`);

    if (isNewerVersion(latestVersion, currentVersion)) {
      const asset = getPlatformAsset(release.assets);
      const downloadUrl = asset?.browser_download_url;

      const { response } = await dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: "A new version of Talko is available!",
        detail: `Current: ${currentVersion}\nNew: ${latestVersion}\n\nYou must update to continue. Download now?`,
        buttons: ["Download & Install", "Close"],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0 && downloadUrl) {
        try {
          const destPath = path.join(
            os.homedir(),
            "Downloads",
            getDownloadFileName(),
          );
          await downloadFile(
            downloadUrl,
            destPath,
            latestVersion,
            createProgressWindow,
            progressWinRef,
            log,
          );
          const pw = progressWinRef();
          if (pw) {
            pw.close();
          }
          await installUpdate(destPath);
          await new Promise((r) => setTimeout(r, 3000));
          app.quit();
          return false;
        } catch (err) {
          log("Download error: " + err.message);
          const pw = progressWinRef();
          if (pw) {
            pw.close();
          }
          await dialog
            .showMessageBox({
              type: "error",
              title: "Download Failed",
              message: "Could not download update.",
              detail: `Error: ${err.message}\n\nPlease visit GitHub to download manually.`,
              buttons: ["Open GitHub", "Close"],
            })
            .then(({ response: r }) => {
              if (r === 0)
                shell.openExternal(
                  `https://github.com/Sneakyweasel90/Talko/releases`,
                );
            });
          app.quit();
          return false;
        }
      }

      app.quit();
      return false;
    }

    log("No update needed");
  } catch (err) {
    log("checkForUpdates error: " + err.message);
  }
  return true;
}

module.exports = { checkForUpdates };
