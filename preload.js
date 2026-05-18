'use strict';

const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('zaloLinux', {
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  badge: (count) => ipcRenderer.send('badge', count),
  triggerScreenshot: (options) => ipcRenderer.invoke('trigger-screenshot', options),
  attachImageToChat: (imagePath) => ipcRenderer.send('attach-image-to-chat', imagePath),
  hideWindow: () => ipcRenderer.send('hide-window-for-screenshot'),
  minimizeWindowAndWait: () => ipcRenderer.invoke('minimize-window-for-screenshot-and-wait'),
  showWindow: () => ipcRenderer.send('show-window-after-screenshot')
});

window.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const tryAttach = () => {
        const target = document.evaluate(
          "/html/body/div/div/div[2]/main/div/article/div[4]/div[2]/div[1]/ul/li[5]",
          document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
        ).singleNodeValue;
        
        if (target) {
          if (target.__screenshotHandlerAttached) return;
          target.__screenshotHandlerAttached = true;
          
          target.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              if (!window.zaloLinux) {
                console.error('[Zalo Bridge] zaloLinux API not available');
                return;
              }
              await window.zaloLinux.minimizeWindowAndWait();
              await new Promise(resolve => setTimeout(resolve, 1500));
              await window.zaloLinux.triggerScreenshot({ hideWindow: true });
            } catch (error) {
              console.error('[Zalo Bridge] Screenshot error:', error);
            }
          }, true);
        } else {
          setTimeout(tryAttach, 1000);
        }
      };
      tryAttach();
    })();
  `;
  document.documentElement.appendChild(script);

  setInterval(() => {
    const match = document.title.match(/\((\d+)\)/);
    ipcRenderer.send('badge', match ? parseInt(match[1], 10) : 0);
  }, 3000);

  ipcRenderer.on('screenshot-taken', async (event, data) => {
    if (data?.imagePath) {
      try {
        const fileData = await ipcRenderer.invoke('read-file-for-upload', data.imagePath);
        if (!fileData) {
          console.error('[Zalo Bridge] Failed to read file');
          return;
        }
        const blob = new Blob([Buffer.from(fileData, 'binary')], { type: 'image/png' });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch (error) {
        console.error('[Zalo Bridge] Clipboard/attach error:', error);
      }
    }
  });
});
