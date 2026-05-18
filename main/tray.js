'use strict';

const { Tray, Menu } = require('electron');

function createTray({ iconPath, onOpen, onRefresh, onExit, screenshot }) {
  const tray = new Tray(iconPath);
  tray.setToolTip('Zalo');

  const updateMenu = () => {
    if (!tray || tray.isDestroyed()) return;
    
    const menuTemplate = [
      { label: 'Open', click: onOpen },
      { label: 'Refresh', click: onRefresh },
      { type: 'separator' }
    ];

    // Thêm menu Screenshot Tool nếu có screenshot module
    if (screenshot) {
      const availableTools = screenshot.getAvailableTools();
      const defaultTool = screenshot.getDefaultTool();

      if (availableTools.length > 0) {
        const screenshotMenuItems = availableTools.map(tool => ({
          label: tool.name,
          type: 'radio',
          checked: tool.name === defaultTool,
          click: () => {
            screenshot.setDefaultTool(tool.name);
            updateMenu();
          }
        }));

        menuTemplate.push({
          label: 'Screenshot Tool',
          submenu: screenshotMenuItems
        });
        menuTemplate.push({ type: 'separator' });
      }
    }

    menuTemplate.push({ label: 'Exit', click: onExit });

    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
  };

  updateMenu();
  tray.on('click', () => typeof onOpen === 'function' && onOpen());

  return { tray, updateMenu };
}

function setTrayBadgeTooltip(tray, count) {
  if (!tray || tray.isDestroyed()) return;
  tray.setToolTip(count > 0 ? `Zalo (${count})` : 'Zalo');
}

module.exports = { createTray, setTrayBadgeTooltip };
