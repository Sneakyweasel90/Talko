const { ipcMain } = require("electron");
const { UiohookKey, uIOhook } = require("uiohook-napi");

const KEY_MAP = {
  Space: UiohookKey.Space,
  A: UiohookKey.A,
  B: UiohookKey.B,
  C: UiohookKey.C,
  D: UiohookKey.D,
  E: UiohookKey.E,
  F: UiohookKey.F,
  G: UiohookKey.G,
  H: UiohookKey.H,
  I: UiohookKey.I,
  J: UiohookKey.J,
  K: UiohookKey.K,
  L: UiohookKey.L,
  M: UiohookKey.M,
  N: UiohookKey.N,
  O: UiohookKey.O,
  P: UiohookKey.P,
  Q: UiohookKey.Q,
  R: UiohookKey.R,
  S: UiohookKey.S,
  T: UiohookKey.T,
  U: UiohookKey.U,
  V: UiohookKey.V,
  W: UiohookKey.W,
  X: UiohookKey.X,
  Y: UiohookKey.Y,
  Z: UiohookKey.Z,
  F1: UiohookKey.F1,
  F2: UiohookKey.F2,
  F3: UiohookKey.F3,
  F4: UiohookKey.F4,
  F5: UiohookKey.F5,
  F6: UiohookKey.F6,
  F7: UiohookKey.F7,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9,
  F10: UiohookKey.F10,
  F11: UiohookKey.F11,
  F12: UiohookKey.F12,
};

let pttKeyCode = null;

function initPtt(getWin) {
  uIOhook.on("keydown", (e) => {
    if (pttKeyCode !== null && e.keycode === pttKeyCode) {
      getWin()?.webContents.send("ptt-keydown");
    }
  });

  uIOhook.on("keyup", (e) => {
    if (pttKeyCode !== null && e.keycode === pttKeyCode) {
      getWin()?.webContents.send("ptt-keyup");
    }
  });

  uIOhook.start();

  ipcMain.on("ptt-register", (event, key) => {
    pttKeyCode = KEY_MAP[key] ?? null;
  });

  ipcMain.on("ptt-unregister", () => {
    pttKeyCode = null;
  });
}

module.exports = { initPtt, uIOhook };
