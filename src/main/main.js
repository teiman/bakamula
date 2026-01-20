import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Register the custom protocol as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'quake-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// Force Hardware Acceleration & WebGL Support
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('use-gl', 'desktop');
app.commandLine.appendSwitch('enable-features', 'Vulkan,VaapiVideoDecoder,CanvasOopRasterization');

import started from 'electron-squirrel-startup';
import Store from 'electron-store';

if (started) {
  app.quit();
}

const store = new Store();
let mainWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webgl: true,
      enableExperimentalFeatures: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.whenReady().then(() => {
  // Register protocol handler for local Quake assets
  protocol.handle('quake-file', (request) => {
    const url = request.url.replace('quake-file://', '');
    const quakePath = store.get('bakamula')?.quakePath;

    if (!quakePath) {
      return new Response('Quake path not configured', { status: 404 });
    }

    const filePath = path.join(quakePath, decodeURIComponent(url));

    // Security check: ensure file is within quakePath
    if (!filePath.startsWith(path.resolve(quakePath))) {
      return new Response('Access denied', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('config:get', (_, key) => store.get(key));
ipcMain.handle('config:set', (_, key, value) => store.set(key, value));
ipcMain.handle('gpu:getStatus', () => app.getGPUFeatureStatus());

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:listSubfolders', (_, dirPath) => {
  try {
    const entries = readdirSync(dirPath);
    return entries.filter(entry => {
      try {
        return statSync(path.join(dirPath, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
});
ipcMain.handle('fs:readFile', (_, filePath) => {
  try {
    const { readFileSync, existsSync } = require('node:fs');

    // 1. Try absolute or direct relative path
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf8');
    }

    // 2. Try relative to resources path (Production)
    const resourcePath = path.join(process.resourcesPath, filePath);
    if (existsSync(resourcePath)) {
      return readFileSync(resourcePath, 'utf8');
    }

    // 3. Try relative to app root (Development)
    const rootPath = path.join(app.getAppPath(), filePath);
    if (existsSync(rootPath)) {
      return readFileSync(rootPath, 'utf8');
    }

    throw new Error(`File not found: ${filePath}`);
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    throw err;
  }
});
