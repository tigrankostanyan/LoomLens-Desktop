/**
 * Preload script for Electron renderer process
 * Bridges native desktop APIs securely via contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Get screen and window capture sources from desktopCapturer
  getDesktopSources: (options) => ipcRenderer.invoke('desktop-capturer-get-sources', options),

  // Save recorded video buffer to user's disk
  saveRecording: (buffer, defaultName) => ipcRenderer.invoke('save-recording', { buffer, defaultName }),

  // Get local network IP addresses
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),

  // Floating overlay controls
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),

  // Minimize / Maximize / Close window
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Open file or folder in OS file explorer
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
});
