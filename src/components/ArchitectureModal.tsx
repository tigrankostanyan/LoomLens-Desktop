import React, { useState } from 'react';
import { Code, Copy, Check, X, Terminal, Cpu, Layers, HardDrive, Smartphone, Monitor } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'diagram' | 'package' | 'main' | 'server' | 'mobile' | 'renderer'>('diagram');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Desktop & WebRTC Architecture Inspector
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-semibold border border-indigo-500/30 uppercase tracking-wider">
                  Production Grade
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Electron.js + WebRTC Signaling + 60 FPS HTML5 Canvas Compositor + MediaRecorder
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'diagram'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            System Architecture
          </button>
          <button
            onClick={() => setActiveTab('main')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'main'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            main.js (Electron)
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'server'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            server.ts (Node/WebRTC)
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'mobile'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            mobile.html (Phone Node)
          </button>
          <button
            onClick={() => setActiveTab('renderer')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'renderer'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            renderer/app.js (Canvas)
          </button>
          <button
            onClick={() => setActiveTab('package')}
            className={`px-3.5 py-2.5 rounded-t-lg font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'package'
                ? 'bg-slate-800/90 text-blue-400 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            package.json
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-sans">
          {activeTab === 'diagram' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Mobile Camera Node */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-2">
                      <Smartphone className="w-4 h-4" /> Node 1: Mobile Cam
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Smartphone navigates to local IP (e.g. <code>http://192.168.1.15:3000/cam</code> via QR code). Captures 1080p rear/front camera + mic at 60 FPS and establishes a direct P2P WebRTC data/media pipe.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    Protocols: <code>WebRTC / ICE / STUN / Socket.io</code>
                  </div>
                </div>

                {/* Signaling Server */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                      <Cpu className="w-4 h-4" /> Node 2: Local Server
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Express + Socket.io gateway discovers local WiFi IPv4 addresses, serves the mobile client, generates QR codes, and relays SDP Offer/Answer signaling for peer connection.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    Engine: <code>Node.js + Express + Socket.IO</code>
                  </div>
                </div>

                {/* Electron Desktop Studio */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                      <Monitor className="w-4 h-4" /> Node 3: Desktop App
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Electron main process manages window lifecycle, uses <code>desktopCapturer</code> for screen/window stream, renders custom squircle/circle masks with gradient glows on a 60 FPS Canvas, and records via MediaRecorder.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    Stack: <code>Electron + Canvas2D + Web Audio API</code>
                  </div>
                </div>
              </div>

              {/* Data Flow Diagram Card */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Real-Time Compositing Pipeline Flow
                </h3>
                <div className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-lg border border-slate-800/80 leading-relaxed whitespace-pre overflow-x-auto">
{`[ Smartphone Camera ] ────( WebRTC RTP Video/Audio )────┐
                                                         ▼
[ Desktop Screen Capture (desktopCapturer) ] ───► [ HTML5 Canvas Compositor (60 FPS) ]
                                                         │
                                               ├─ Layer 0: Screen Feed (1920x1080)
                                               ├─ Layer 1: Custom Squircle / Circle Mask
                                               ├─ Layer 2: Camera Stream (Zoomed/Mirrored)
                                               ├─ Layer 3: Neon / Amber Border Glow & PNG
                                               └─ Layer 4: Voice-Reactive Audio Halo
                                                         │
                                                         ▼
[ Web Audio API Mixer (Mic + System Audio) ] ───► [ MediaRecorder API ]
                                                         │
                                                         ▼
                                          [ High-Quality MP4 / WebM File ]`}
                </div>
              </div>

              {/* Step by step local terminal instructions */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Step-by-Step Local Desktop Execution
                </h3>
                <div className="text-xs text-slate-300 space-y-2">
                  <p>To run this exact application as a standalone desktop app on macOS, Windows, or Linux:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-400 font-mono bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    <li><span className="text-white">npm install</span> <span className="text-slate-500"># Install dependencies</span></li>
                    <li><span className="text-white">npm run dev</span> <span className="text-slate-500"># Start local server with WebRTC signaling</span></li>
                    <li><span className="text-white">npx electron .</span> <span className="text-slate-500"># Launch native desktop Electron window</span></li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'diagram' && (
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => {
                    const content = activeTab === 'main' ? mainJsContent :
                                    activeTab === 'server' ? serverTsContent :
                                    activeTab === 'mobile' ? mobileHtmlContent :
                                    activeTab === 'renderer' ? rendererJsContent : packageJsonContent;
                    copyCode(content);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg flex items-center gap-1.5 border border-slate-700 shadow-md transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
                <code>
                  {activeTab === 'main' && mainJsContent}
                  {activeTab === 'server' && serverTsContent}
                  {activeTab === 'mobile' && mobileHtmlContent}
                  {activeTab === 'renderer' && rendererJsContent}
                  {activeTab === 'package' && packageJsonContent}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Static code references for inspection
const mainJsContent = `// main.js - Electron Main Process
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
      webSecurity: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  mainWindow.loadURL(startUrl);
}

// IPC: Fetch native desktop/window capture sources
ipcMain.handle('desktop-capturer-get-sources', async (event, opts = {}) => {
  const sources = await desktopCapturer.getSources({
    types: opts.types || ['screen', 'window'],
    thumbnailSize: { width: 480, height: 270 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    display_id: s.display_id,
  }));
});

// IPC: Save recorded video buffer directly to local disk
ipcMain.handle('save-recording', async (event, { buffer, defaultName = 'LoomLens-Recording.mp4' }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Recording',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [
      { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
      { name: 'WebM Video (*.webm)', extensions: ['webm'] },
    ],
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  await fs.promises.writeFile(filePath, new Uint8Array(buffer));
  return { success: true, filePath };
});

app.whenReady().then(createWindow);`;

const serverTsContent = `// server.ts - Local IP discovery & WebRTC Signaling
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import os from 'os';
import path from 'path';
import QRCode from 'qrcode';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

// WebRTC Signaling Relay
io.on('connection', (socket) => {
  socket.on('join-room', (roomId, role) => {
    socket.join(roomId);
    socket.to(roomId).emit('peer-joined', { peerId: socket.id, role });
  });

  socket.on('offer', (data) => io.to(data.target).emit('offer', { sender: socket.id, sdp: data.sdp }));
  socket.on('answer', (data) => io.to(data.target).emit('answer', { sender: socket.id, sdp: data.sdp }));
  socket.on('ice-candidate', (data) => io.to(data.target).emit('ice-candidate', { sender: socket.id, candidate: data.candidate }));
  socket.on('remote-camera-control', (cmd) => socket.broadcast.emit('remote-camera-control', cmd));
});

server.listen(PORT, '0.0.0.0');`;

const mobileHtmlContent = `<!-- mobile.html - Dedicated Smartphone WebRTC Camera Node -->
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body>
  <video id="preview" playsinline autoplay muted></video>
  <button id="flipBtn">Flip Camera</button>
  <button id="torchBtn">Torch</button>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    socket.emit('join-room', 'loom-studio-room', 'mobile');
    // Initializes getUserMedia 1080p & streams via RTCPeerConnection to desktop
  </script>
</body>
</html>`;

const rendererJsContent = `// renderer/app.js - 60 FPS HTML5 Canvas Compositor
function renderFrame() {
  // 1. Draw screen capture background
  if (state.screenStream) ctx.drawImage(screenVideo, 0, 0, 1920, 1080);

  // 2. Apply chosen mask path (Circle / Squircle)
  ctx.save();
  drawRoundedRectPath(ctx, state.x, state.y, state.width, state.height, state.cornerRadius);
  ctx.clip();
  if (state.isMirrored) {
    ctx.translate(state.x + state.width, state.y);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraVideo, 0, 0, state.width, state.height);
  }
  ctx.restore();

  // 3. Draw Warm Amber Glow / Neon Frame
  ctx.strokeStyle = '#f59e0b';
  ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
  ctx.shadowBlur = 18;
  drawRoundedRectPath(ctx, state.x, state.y, state.width, state.height, state.cornerRadius);
  ctx.stroke();

  requestAnimationFrame(renderFrame);
}`;

const packageJsonContent = `{
  "name": "loomlens-studio",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "dev": "tsx server.ts",
    "electron": "electron .",
    "build": "vite build"
  },
  "dependencies": {
    "express": "^4.21.2",
    "socket.io": "^4.8.4",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "electron": "^33.0.0"
  }
}`;
