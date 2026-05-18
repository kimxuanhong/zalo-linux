'use strict';

const { app } = require('electron');
const { CHROME_UA, PARTITION, ICON_PATH, PRELOAD_PATH } = require('./main/constants');
const { createMainWindow, showAndFocusWindow, hideWindow, minimizeWindow, installCloseToHide } = require('./main/window');
const { createTray, setTrayBadgeTooltip } = require('./main/tray');
const { installPermissionHandlers } = require('./main/permissions');
const { registerIpcHandlers } = require('./main/ipc');
const screenshot = require('./main/screenshot');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;
let tray = null;

app.on('second-instance', () => showAndFocusWindow(win));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  app.userAgentFallback = CHROME_UA;
  installPermissionHandlers({ partition: PARTITION });

  win = createMainWindow({ preloadPath: PRELOAD_PATH, partition: PARTITION, userAgent: CHROME_UA, url: 'https://chat.zalo.me' });
  installCloseToHide({ win, app });

  const trayApi = createTray({
    iconPath: ICON_PATH,
    onOpen: () => showAndFocusWindow(win),
    onRefresh: () => win && !win.isDestroyed() && win.webContents.reload(),
    onExit: () => { app.isQuiting = true; app.quit(); },
    screenshot
  });
  tray = trayApi.tray;
});

registerIpcHandlers({
  getWin: () => win,
  getTray: () => tray,
  iconPath: ICON_PATH,
  showAndFocusWindow: () => showAndFocusWindow(win),
  hideWindow: () => hideWindow(win),
  minimizeWindow: () => minimizeWindow(win),
  setTrayBadgeTooltip,
  screenshot
});
