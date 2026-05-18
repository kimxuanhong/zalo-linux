'use strict';

const { session } = require('electron');

function allowAllPermissions(webContents, permission, callback) {
  callback(true);
}

function installPermissionHandlers({ partition }) {
  session.defaultSession.setPermissionRequestHandler(allowAllPermissions);
  session.fromPartition(partition).setPermissionRequestHandler(allowAllPermissions);
}

module.exports = { installPermissionHandlers };
