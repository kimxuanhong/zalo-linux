'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
const { clipboard, nativeImage } = require('electron');

// File lưu cấu hình
const CONFIG_DIR = path.join(os.homedir(), '.config', 'zalo-linux');
const CONFIG_FILE = path.join(CONFIG_DIR, 'screenshot-config.json');

// Danh sách các tool chụp màn hình (ImageMagick đầu tiên = mặc định)
const SCREENSHOT_TOOLS = [
  { name: 'imagemagick', cmd: 'import /tmp/zalo-screenshot-$(date +%s).png' },
  { name: 'spectacle', cmd: 'spectacle -rbc' },
  { name: 'flameshot', cmd: 'flameshot gui' },
  { name: 'gnome-screenshot', cmd: 'gnome-screenshot -ac' },
  { name: 'xfce4-screenshooter', cmd: 'xfce4-screenshooter -rc' }
];

// Lấy danh sách tool có sẵn trên hệ thống
function getAvailableTools() {
  const available = [];
  for (const tool of SCREENSHOT_TOOLS) {
    try {
      // Kiểm tra imagemagick bằng lệnh import
      const checkCmd = tool.name === 'imagemagick' ? 'import' : tool.name;
      execSync(`which ${checkCmd}`, { stdio: 'ignore' });
      available.push(tool);
    } catch (e) {
      // Tool không có sẵn
    }
  }
  return available;
}

// Đọc cấu hình
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Screenshot Config] Error loading config:', e.message);
  }
  return {};
}

// Lưu cấu hình
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('[Screenshot Config] Config saved:', config);
  } catch (e) {
    console.error('[Screenshot Config] Error saving config:', e.message);
  }
}

// Lấy tool mặc định
function getDefaultTool() {
  const config = loadConfig();
  if (config.defaultTool) {
    // Kiểm tra xem tool có còn available không
    const available = getAvailableTools();
    if (available.find(t => t.name === config.defaultTool)) {
      return config.defaultTool;
    }
  }
  
  // Nếu chưa có hoặc tool không còn available, trả về tool đầu tiên
  const available = getAvailableTools();
  return available.length > 0 ? available[0].name : null;
}

// Set tool mặc định
function setDefaultTool(toolName) {
  const config = loadConfig();
  config.defaultTool = toolName;
  saveConfig(config);
  console.log('[Screenshot Config] Default tool set to:', toolName);
}

function copyImageToClipboard(imagePath) {
  try {
    if (!imagePath || !fs.existsSync(imagePath)) return false;
    let image = nativeImage.createFromPath(imagePath);
    if (!image || image.isEmpty()) {
      image = nativeImage.createFromBuffer(fs.readFileSync(imagePath));
    }
    if (!image || image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  } catch (error) {
    console.error('[Zalo Bridge] Clipboard copy failed:', error.message);
    return false;
  }
}

function findLatestScreenshot({ win, withinMs = 10000, afterMs = 0, sendEvent = true } = {}) {
  const dirs = [
    path.join(os.homedir(), 'Pictures'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    '/tmp',
    os.tmpdir()
  ];

  let latestFile = null;
  let latestTime = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const file of fs.readdirSync(dir)) {
        if (!/\.(png|jpg|jpeg|bmp)$/i.test(file)) continue;
        if (!file.includes('Zalo-Screenshot') && latestFile?.includes('Zalo-Screenshot')) continue;

        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs >= afterMs && (Date.now() - stats.mtimeMs < withinMs) && stats.mtimeMs > latestTime) {
            latestFile = filePath;
            latestTime = stats.mtimeMs;
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  if (latestFile && win) {
    copyImageToClipboard(latestFile);
    if (sendEvent) win.webContents.send('screenshot-taken', { imagePath: latestFile });
    return latestFile;
  }
  return null;
}

function triggerScreenshotScript({ onWindowMinimize, onWindowRestore, findLatest }) {
  const startedAt = Date.now();
  if (typeof onWindowMinimize === 'function') onWindowMinimize();

  // Lấy tool mặc định
  const defaultToolName = getDefaultTool();
  
  if (!defaultToolName) {
    console.error('[Zalo Bridge] No screenshot tool available');
    if (typeof onWindowRestore === 'function') onWindowRestore();
    return Promise.resolve(false);
  }

  const tool = SCREENSHOT_TOOLS.find(t => t.name === defaultToolName);
  if (!tool) {
    console.error('[Zalo Bridge] Tool not found:', defaultToolName);
    if (typeof onWindowRestore === 'function') onWindowRestore();
    return Promise.resolve(false);
  }

  exec(tool.cmd, (err) => {
    if (err) console.error(`[Zalo Bridge] ${tool.name} error:`, err.message);
  });

  return new Promise((resolve) => {
    const poll = () => {
      if (findLatest({ afterMs: startedAt, withinMs: 10000, sendEvent: true })) {
        if (typeof onWindowRestore === 'function') onWindowRestore();
        return resolve(true);
      }
      if (Date.now() - startedAt >= 20000) {
        if (typeof onWindowRestore === 'function') onWindowRestore();
        return resolve(false);
      }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 800);
  });
}

function attachImageToChat({ win, imagePath }) {
  if (!win || win.isDestroyed()) return;
  if (!imagePath || !fs.existsSync(imagePath)) {
    console.error('[Zalo Bridge] Image file not found:', imagePath);
    return;
  }

  try {
    const base64 = fs.readFileSync(imagePath).toString('base64');
    const fileName = path.basename(imagePath);
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.bmp' ? 'image/bmp' : 'image/png';

    const script = `
      (function() {
        try {
          const fileInput = document.querySelector('input[type="file"]');
          if (!fileInput) {
            console.error('[Zalo Bridge] File input not found');
            return;
          }
          const binary = atob(${JSON.stringify(base64)});
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const file = new File([bytes], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mime)} });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (error) {
          console.error('[Zalo Bridge] Error attaching image:', error);
        }
      })();
    `;
    win.webContents.executeJavaScript(script).catch((err) => console.error('[Zalo Bridge] Failed to execute script:', err));
  } catch (error) {
    console.error('[Zalo Bridge] Failed to read image:', error.message);
  }
}

function readFileForUpload(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`[Zalo Bridge] File not found: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath).toString('binary');
  } catch (error) {
    console.error(`[Zalo Bridge] Error reading file: ${error.message}`);
    return null;
  }
}

module.exports = {
  triggerScreenshotScript,
  findLatestScreenshot,
  attachImageToChat,
  readFileForUpload,
  getAvailableTools,
  getDefaultTool,
  setDefaultTool
};
