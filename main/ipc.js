'use strict';

const { ipcMain, Notification } = require('electron');

function registerIpcHandlers({
  getWin,
  getTray,
  iconPath,
  showAndFocusWindow,
  hideWindow,
  minimizeWindow,
  setTrayBadgeTooltip,
  screenshot
}) {
  ipcMain.on('notify', (_, data) => {
    const notif = new Notification({ title: data.title, body: data.body, icon: iconPath });
    notif.on('click', () => showAndFocusWindow());
    notif.show();
  });

  ipcMain.on('badge', (_, count) => setTrayBadgeTooltip(getTray(), count));
  ipcMain.on('hide-window-for-screenshot', () => hideWindow());
  ipcMain.on('show-window-after-screenshot', () => showAndFocusWindow());

  ipcMain.handle('minimize-window-for-screenshot-and-wait', async () => {
    const win = getWin();
    if (!win || win.isDestroyed()) return false;
    if (win.isMinimized && win.isMinimized()) return true;

    return new Promise(resolve => {
      let settled = false;
      const cleanup = () => win?.removeListener('minimize', onMinimize);
      const onMinimize = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      win.on('minimize', onMinimize);
      minimizeWindow();

      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(!win.isDestroyed() && win.isMinimized?.());
      }, 1200);
    });
  });

  ipcMain.handle('trigger-screenshot', async (_, options = {}) => {
    return screenshot.triggerScreenshotScript({
      onWindowMinimize: options.hideWindow ? minimizeWindow : null,
      onWindowRestore: options.hideWindow ? showAndFocusWindow : null,
      findLatest: ({ afterMs, withinMs, sendEvent }) =>
        screenshot.findLatestScreenshot({ win: getWin(), afterMs, withinMs, sendEvent })
    });
  });

  ipcMain.on('attach-image-to-chat', (_, imagePath) => screenshot.attachImageToChat({ win: getWin(), imagePath }));
  ipcMain.handle('read-file-for-upload', async (_, filePath) => screenshot.readFileForUpload(filePath));
}

module.exports = { registerIpcHandlers };
