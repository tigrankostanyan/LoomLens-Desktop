/**
 * server.js - Local Node.js server for LoomLens
 * Discovers local WiFi IP addresses, serves mobile streaming interface,
 * generates connection QR codes, and relays WebRTC SDP offer/answer signaling via Socket.io.
 */

const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// Helper: Query local IPv4 network adapters
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

// Network info and QR code endpoint
app.get('/api/network-info', async (req, res) => {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0] || '127.0.0.1';
  const hostHeader = req.headers.host || `${primaryIp}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';

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

// Standalone smartphone camera client endpoint
app.get('/cam', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile.html'));
});

// Serve static build if available
app.use(express.static(path.join(__dirname, 'dist')));

// WebRTC Signaling via Socket.io
io.on('connection', (socket) => {
  console.log(`[Signaling] Peer connected: ${socket.id}`);

  socket.on('join-room', (roomId, role) => {
    socket.join(roomId);
    socket.data.role = role;
    socket.data.roomId = roomId;
    console.log(`[Signaling] ${role} (${socket.id}) joined ${roomId}`);
    socket.to(roomId).emit('peer-joined', { peerId: socket.id, role });

    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      const existingPeers = [];
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

  socket.on('offer', (data) => {
    io.to(data.target).emit('offer', {
      sender: socket.id,
      sdp: data.sdp,
    });
  });

  socket.on('answer', (data) => {
    io.to(data.target).emit('answer', {
      sender: socket.id,
      sdp: data.sdp,
    });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.target).emit('ice-candidate', {
      sender: socket.id,
      candidate: data.candidate,
    });
  });

  socket.on('camera-telemetry', (telemetry) => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('camera-telemetry', telemetry);
    }
  });

  socket.on('remote-camera-control', (command) => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('remote-camera-control', command);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('peer-disconnected', {
        peerId: socket.id,
        role: socket.data.role,
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`LoomLens Server running at http://localhost:${PORT}`);
  console.log(`Local network IP: http://${ips[0]}:${PORT}/cam`);
});
