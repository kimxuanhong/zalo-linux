'use strict';

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  CHROME_UA: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  PARTITION: 'persist:zalo',
  ICON_PATH: path.join(ROOT_DIR, 'icon.png'),
  PRELOAD_PATH: path.join(ROOT_DIR, 'preload.js')
};
