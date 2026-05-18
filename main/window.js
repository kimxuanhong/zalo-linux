'use strict';

const { BrowserWindow } = require('electron');

function showAndFocusWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

function hideWindow(win) {
  if (!win || win.isDestroyed()) return;
  win.hide();
}

function minimizeWindow(win) {
  if (!win || win.isDestroyed()) return;
  win.minimize();
}

function injectNotificationInterceptor(win) {
  if (!win || win.isDestroyed()) return;

  const script = `
    (function() {
      if (window.__zaloNotifInjected) return;
      window.__zaloNotifInjected = true;

      function ZaloNotification(title, options = {}) {
        if (window.zaloLinux) window.zaloLinux.notify(title, options.body || '');
        this.title = title;
        this.body = options.body || '';
        this.icon = options.icon || '';
        this.tag = options.tag || '';
        this.close = this.addEventListener = this.removeEventListener = function(){};
        this.onclick = this.onclose = this.onerror = this.onshow = null;
        setTimeout(() => { if (typeof this.onshow === 'function') this.onshow(); }, 10);
      }

      ZaloNotification.permission = 'granted';
      ZaloNotification.requestPermission = cb => {
        if (cb) cb('granted');
        return Promise.resolve('granted');
      };
      ZaloNotification.maxActions = 0;

      Object.defineProperty(window, 'Notification', { value: ZaloNotification, writable: true, configurable: true });

      if (navigator.serviceWorker?.getRegistration) {
        const origGetReg = navigator.serviceWorker.getRegistration;
        navigator.serviceWorker.getRegistration = function() {
          return origGetReg.apply(this, arguments).then(reg => {
            if (reg?.showNotification) {
              const origShow = reg.showNotification.bind(reg);
              reg.showNotification = function(title, opts = {}) {
                if (window.zaloLinux) window.zaloLinux.notify(title, opts.body || '');
                return origShow(title, opts);
              };
            }
            return reg;
          });
        };
      }
    })();
  `;

  win.webContents.executeJavaScript(script).catch((err) => {
    console.error('[Zalo] Failed to inject:', err);
  });
}

function createMainWindow({ preloadPath, partition, userAgent, url }) {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    autoHideMenuBar: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      partition
    }
  });

  win.webContents.setUserAgent(userAgent);
  win.loadURL(url);

  win.webContents.on('did-finish-load', () => injectNotificationInterceptor(win));
  win.webContents.on('did-navigate-in-page', () => injectNotificationInterceptor(win));

  win.once('ready-to-show', () => win.show());

  return win;
}

function installCloseToHide({ win, app }) {
  if (!win) return;
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });
}

module.exports = {
  createMainWindow,
  injectNotificationInterceptor,
  showAndFocusWindow,
  hideWindow,
  minimizeWindow,
  installCloseToHide
};
