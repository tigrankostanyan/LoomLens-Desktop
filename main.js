/**
 * LoomLens Electron Main Process
 * Handles window lifecycle, native desktop capture sources, file saving, and IPC bridges
 */
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LoomLens Screen & Camera Studio',
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows local WebRTC/HTTP streams
    },
    titleBarStyle: 'hiddenInset', // Sleek modern desktop title bar
  });

  // In production or local dev, load the app
  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(startUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    // Packaged build
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Fetch native screen/window sources via desktopCapturer
ipcMain.handle('desktop-capturer-get-sources', async (event, opts = {}) => {
  try {
    const types = opts.types || ['screen', 'window'];
    const sources = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true,
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      display_id: s.display_id,
    }));
  } catch (error) {
    console.error('Failed to get desktop capturer sources:', error);
    return [];
  }
});

// IPC: Save recorded video file to user's local disk
ipcMain.handle('save-recording', async (event, { buffer, defaultName = 'LoomLens-Recording.mp4' }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Recording',
      defaultPath: path.join(app.getPath('videos') || app.getPath('downloads'), defaultName),
      filters: [
        { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
        { name: 'WebM Video (*.webm)', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const uint8Array = new Uint8Array(buffer);
    await fs.promises.writeFile(filePath, uint8Array);

    return {
      success: true,
      filePath,
    };
  } catch (err) {
    console.error('Failed to save recording:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Get local network IPs for mobile connection
ipcMain.handle('get-network-info', async () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return {
    localIps: addresses,
    primaryIp: addresses[0] || '127.0.0.1',
    port: process.env.PORT || 3000,
  };
});

// IPC: Always on top toggle for floating overlay
ipcMain.handle('set-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!flag);
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('open-path', async (event, targetPath) => {
  await shell.showItemInFolder(targetPath);
});

// Electron Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
