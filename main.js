const { app, BrowserWindow, Tray, ipcMain, Notification, Menu, session } = require('electron')
const path = require('path')

let win = null
let tray = null

// User Agent giống Chrome Linux
const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Ngăn chặn mở nhiều instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Nếu đã có instance khác đang chạy, thoát ngay
  app.quit()
} else {
  // Khi có instance thứ 2 cố mở, focus vào instance đầu tiên
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })

  app.disableHardwareAcceleration()

  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-background-timer-throttling')

  function createWindow() {
    win = new BrowserWindow({
      width: 1100,
      height: 750,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:zalo'
      }
    })

    win.setMenu(null)

    win.webContents.setUserAgent(CHROME_UA)
    win.loadURL('https://chat.zalo.me')

    // Inject notification interceptor vào page context mỗi khi page load
    win.webContents.on('did-finish-load', () => {
      injectNotificationInterceptor()
    })

    // Re-inject khi navigate trong page (SPA)
    win.webContents.on('did-navigate-in-page', () => {
      injectNotificationInterceptor()
    })

    win.once('ready-to-show', () => {
      win.show()
    })

    // Hide khi bấm nút X (không thoát)
    win.on('close', (e) => {
      if (!app.isQuiting) {
        e.preventDefault()
        win.hide()
      }
    })
  }

  /**
   * Inject script để override Notification constructor
   * Dùng contextBridge expose từ preload để gọi notify
   */
  function injectNotificationInterceptor() {
    if (!win || win.isDestroyed()) return

    const script = `
      (function() {
        if (window.__zaloNotifInjected) return;
        window.__zaloNotifInjected = true;

        var OrigNotification = window.Notification;

        function ZaloNotification(title, options) {
          options = options || {};
          
          // Gửi notification qua contextBridge API
          if (window.zaloLinux) {
            window.zaloLinux.notify(title, options.body || '');
          }

          // Trả về fake notification object để Zalo không crash
          var self = this;
          self.title = title;
          self.body = options.body || '';
          self.icon = options.icon || '';
          self.tag = options.tag || '';
          self.close = function(){};
          self.addEventListener = function(){};
          self.removeEventListener = function(){};
          self.onclick = null;
          self.onclose = null;
          self.onerror = null;
          self.onshow = null;
          
          // Fire onshow callback nếu Zalo set
          setTimeout(function() {
            if (typeof self.onshow === 'function') self.onshow();
          }, 10);
        }

        ZaloNotification.permission = 'granted';
        ZaloNotification.requestPermission = function(cb) {
          var p = Promise.resolve('granted');
          if (cb) cb('granted');
          return p;
        };
        ZaloNotification.maxActions = 0;

        Object.defineProperty(window, 'Notification', {
          value: ZaloNotification,
          writable: true,
          configurable: true
        });

        // Intercept ServiceWorker showNotification (push notifications)
        if (navigator.serviceWorker) {
          var origGetReg = navigator.serviceWorker.getRegistration;
          if (origGetReg) {
            navigator.serviceWorker.getRegistration = function() {
              return origGetReg.apply(this, arguments).then(function(reg) {
                if (reg && reg.showNotification) {
                  var origShow = reg.showNotification.bind(reg);
                  reg.showNotification = function(title, opts) {
                    opts = opts || {};
                    if (window.zaloLinux) {
                      window.zaloLinux.notify(title, opts.body || '');
                    }
                    return origShow(title, opts);
                  };
                }
                return reg;
              });
            };
          }
        }

      })();
    `

    win.webContents.executeJavaScript(script).catch((err) => {
      console.error('[Zalo] Failed to inject:', err)
    })
  }

  function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'))
    tray.setToolTip('Zalo')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          if (win) {
            win.show()
            win.focus()
          }
        }
      },
      {
        label: 'Refresh',
        click: () => {
          if (win && !win.isDestroyed()) {
            win.webContents.reload()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)

    // Click trái → mở app
    tray.on('click', () => {
      if (win) {
        win.show()
        win.focus()
      }
    })
  }

  app.whenReady().then(() => {
    app.userAgentFallback = CHROME_UA

    // Auto-grant notification permission cho Zalo
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'notifications') {
        callback(true)
      } else {
        callback(true)
      }
    })

    session.fromPartition('persist:zalo').setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true)
    })

    createWindow()
    createTray()
  })

  app.on('window-all-closed', (e) => {
    e.preventDefault()
  })
}

function showAndFocusWindow() {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

ipcMain.on('notify', (event, data) => {
  const notif = new Notification({
    title: data.title,
    body: data.body,
    icon: path.join(__dirname, 'icon.png')
  })

  notif.on('click', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })

  notif.show()
})

ipcMain.on('badge', (event, count) => {
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(
      count > 0 ? `Zalo (${count})` : 'Zalo'
    )
  }
})
