const { screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const WINDOW_STATE_PATH = path.join(os.homedir(), "talko-window-state.json");

function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(WINDOW_STATE_PATH, "utf8"));
      const displays = screen.getAllDisplays();
      const onScreen = displays.some(
        (d) =>
          state.x >= d.bounds.x &&
          state.y >= d.bounds.y &&
          state.x < d.bounds.x + d.bounds.width &&
          state.y < d.bounds.y + d.bounds.height,
      );
      if (onScreen) return state;
    }
  } catch {}
  return { width: 1100, height: 750 };
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(WINDOW_STATE_PATH, JSON.stringify(bounds));
  } catch {}
}

module.exports = { loadWindowState, saveWindowState };
