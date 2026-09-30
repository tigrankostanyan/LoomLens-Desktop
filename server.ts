import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import os from 'os';
import path from 'path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for WebRTC signaling
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// Helper to get local network IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // IPv4 and non-internal
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

// API to get local network & connection URLs
app.get('/api/network-info', async (req, res) => {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0] || '127.0.0.1';
  
  // Use host header if available, or fall back to primary local IP
  const hostHeader = req.headers.host || `${primaryIp}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  
  // App URL / Local URL
  const baseUrl = `${protocol}://${hostHeader}`;
  const localCamUrl = `http://${primaryIp}:${PORT}/cam`;
  const cloudCamUrl = `${baseUrl}/cam`;

  try {
    const qrDataUrl = await QRCode.toDataURL(cloudCamUrl, {
      margin: 2,
      width: 280,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    res.json({
      localIps,
      port: PORT,
      primaryIp,
      localCamUrl,
      cloudCamUrl,
      qrDataUrl,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Dedicated standalone Mobile Camera page route
app.get('/cam', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile.html'));
});

// WebRTC Signaling via Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join a room (default 'loom-studio-room')
  socket.on('join-room', (roomId: string, role: 'desktop' | 'mobile') => {
    socket.join(roomId);
    socket.data.role = role;
    socket.data.roomId = roomId;
    console.log(`[Socket.io] ${role} ${socket.id} joined room ${roomId}`);

    // Notify other peers in room that a new peer joined
    socket.to(roomId).emit('peer-joined', { peerId: socket.id, role });

    // Send existing peers in this room back to the newly joined socket
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      const existingPeers: Array<{ peerId: string; role: string }> = [];
      room.forEach((peerId) => {
        if (peerId !== socket.id) {
          const peerSocket = io.sockets.sockets.get(peerId);
          existingPeers.push({
            peerId,
            role: peerSocket?.data?.role || 'desktop',
          });
        }
      });
      socket.emit('room-peers', existingPeers);
    }
  });

  // WebRTC Offer
  socket.on('offer', (data: { target: string; sdp: RTCSessionDescriptionInit }) => {
    io.to(data.target).emit('offer', {
      sender: socket.id,
      sdp: data.sdp,
    });
  });

  // WebRTC Answer
  socket.on('answer', (data: { target: string; sdp: RTCSessionDescriptionInit }) => {
    io.to(data.target).emit('answer', {
      sender: socket.id,
      sdp: data.sdp,
    });
  });

  // ICE Candidate
  socket.on('ice-candidate', (data: { target: string; candidate: RTCIceCandidateInit }) => {
    io.to(data.target).emit('ice-candidate', {
      sender: socket.id,
      candidate: data.candidate,
    });
  });

  // Camera telemetry (resolution, fps, battery, torch status)
  socket.on('camera-telemetry', (telemetry: Record<string, unknown>) => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('camera-telemetry', telemetry);
    }
  });

  // Remote camera controls sent from desktop to phone (e.g. switch front/back camera, toggle torch)
  socket.on('remote-camera-control', (command: { action: string; payload?: unknown }) => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('remote-camera-control', command);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-disconnected', { peerId: socket.id, role: socket.data.role });
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIpAddresses();
    console.log(`====================================================`);
    console.log(`🚀 LoomLens Studio Server running on:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${ips[0] || '127.0.0.1'}:${PORT}`);
    console.log(`   Phone Cam: http://${ips[0] || '127.0.0.1'}:${PORT}/cam`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
