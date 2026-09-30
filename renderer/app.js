/**
 * LoomLens Renderer Process Application Logic
 * Canvas Compositor, WebRTC Smartphone Receiver, Audio Mixing, and MediaRecorder
 */

// Configuration State
const state = {
  screenStream: null,
  cameraStream: null,
  cameraSourceType: 'phone', // 'phone' or 'local'
  
  // Camera Overlay Geometry & Styling
  maskShape: 'squircle', // 'squircle', 'circle', 'rect', 'portrait'
  frameStyle: 'amber', // 'amber', 'neon', 'purple', 'none'
  position: 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'custom'
  x: 1460,
  y: 60,
  width: 380,
  height: 380,
  cornerRadius: 44,
  isMirrored: true,

  // Dragging state
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,

  // Recording State
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  recordStartTime: 0,
  recordTimerInterval: null,

  // Audio Processing
  audioCtx: null,
  audioDestination: null,
  analyser: null,
  micGainNode: null,
};

// DOM References
const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');
const screenVideo = document.getElementById('screenVideo');
const cameraVideo = document.getElementById('cameraVideo');
const toggleRecordBtn = document.getElementById('toggleRecordBtn');
const recordingIndicator = document.getElementById('recordingIndicator');
const recTimerText = document.getElementById('recTimerText');
const selectScreenBtn = document.getElementById('selectScreenBtn');
const screenStatusBadge = document.getElementById('screenStatusBadge');
const camStatusBadge = document.getElementById('camStatusBadge');
const phoneWebRTCStatus = document.getElementById('phoneWebRTCStatus');
const phoneLinkText = document.getElementById('phoneLinkText');
const usePhoneCamBtn = document.getElementById('usePhoneCamBtn');
const useLocalCamBtn = document.getElementById('useLocalCamBtn');
const camSizeSlider = document.getElementById('camSizeSlider');
const camRadiusSlider = document.getElementById('camRadiusSlider');
const camFlipToggle = document.getElementById('camFlipToggle');
const audioMeterBar = document.getElementById('audioMeterBar');

// Initialize Web Audio Context
function initAudioPipeline() {
  if (!state.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContextClass();
    state.audioDestination = state.audioCtx.createMediaStreamDestination();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;
    state.micGainNode = state.audioCtx.createGain();
    state.micGainNode.connect(state.analyser);
    state.micGainNode.connect(state.audioDestination);
  }
}

// ----------------------------------------------------
// 1. SCREEN CAPTURE (Electron or Web getDisplayMedia)
// ----------------------------------------------------
async function selectScreenSource() {
  try {
    // If running inside Electron, we can use the desktopCapturer IPC bridge
    if (window.electronAPI && window.electronAPI.getDesktopSources) {
      const sources = await window.electronAPI.getDesktopSources({ types: ['screen', 'window'] });
      if (sources.length > 0) {
        // In Electron, pass sourceId into getUserMedia chromeMediaSourceId
        const chosenSource = sources[0];
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: chosenSource.id,
              minWidth: 1920,
              maxWidth: 1920,
              minHeight: 1080,
              maxHeight: 1080,
              maxFrameRate: 60,
            }
          }
        });
        setScreenStream(stream, chosenSource.name);
        return;
      }
    }

    // Standard Browser Display Media fallback
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 }
      },
      audio: true
    });

    setScreenStream(stream, 'Display Capture Active');
  } catch (err) {
    console.error('Failed to capture screen:', err);
  }
}

function setScreenStream(stream, label) {
  state.screenStream = stream;
  screenVideo.srcObject = stream;
  screenVideo.play();
  screenStatusBadge.textContent = 'Active (60fps)';
  screenStatusBadge.style.color = '#10b981';
  selectScreenBtn.textContent = `🖥️ Screen: ${label.substring(0, 20)}`;

  // Pipe audio from screen if present
  if (stream.getAudioTracks().length > 0) {
    initAudioPipeline();
    const sourceNode = state.audioCtx.createMediaStreamSource(stream);
    sourceNode.connect(state.audioDestination);
  }

  stream.getVideoTracks()[0].onended = () => {
    state.screenStream = null;
    screenStatusBadge.textContent = 'Idle';
    screenStatusBadge.style.color = '#94a3b8';
    selectScreenBtn.textContent = '🖥️ Select Screen / Window';
  };
}

selectScreenBtn.addEventListener('click', selectScreenSource);

// ----------------------------------------------------
// 2. REMOTE SMARTPHONE CAMERA (WebRTC & Socket.io)
// ----------------------------------------------------
const socket = io();
const roomId = 'loom-studio-room';
let peerConnection = null;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function setupWebRTCSignaling() {
  socket.emit('join-room', roomId, 'desktop');

  socket.on('peer-joined', ({ peerId, role }) => {
    if (role === 'mobile') {
      phoneWebRTCStatus.textContent = 'Phone connected! Initializing stream...';
      phoneWebRTCStatus.style.color = '#38bdf8';
    }
  });

  socket.on('offer', async ({ sender, sdp }) => {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
      console.log('Received remote track from phone:', event.track.kind);
      if (event.streams && event.streams[0]) {
        attachCameraStream(event.streams[0], 'Remote Smartphone');
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          target: sender,
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const connState = peerConnection.connectionState;
      if (connState === 'connected') {
        phoneWebRTCStatus.textContent = 'Live (60fps Low Latency)';
        phoneWebRTCStatus.style.color = '#10b981';
        camStatusBadge.textContent = 'Phone Live';
        camStatusBadge.style.color = '#10b981';
      } else if (connState === 'disconnected') {
        phoneWebRTCStatus.textContent = 'Phone disconnected';
        phoneWebRTCStatus.style.color = '#f59e0b';
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', {
      target: sender,
      sdp: answer
    });
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  });
}

setupWebRTCSignaling();

// Switch between Phone Cam and Local Cam
usePhoneCamBtn.addEventListener('click', () => {
  state.cameraSourceType = 'phone';
  usePhoneCamBtn.classList.add('active');
  useLocalCamBtn.classList.remove('active');
  document.getElementById('phoneCamDetails').style.display = 'block';
});

useLocalCamBtn.addEventListener('click', async () => {
  state.cameraSourceType = 'local';
  useLocalCamBtn.classList.add('active');
  usePhoneCamBtn.classList.remove('active');
  document.getElementById('phoneCamDetails').style.display = 'none';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    attachCameraStream(stream, 'Local Webcam');
  } catch (err) {
    console.error('Failed to get local webcam:', err);
  }
});

function attachCameraStream(stream, label) {
  state.cameraStream = stream;
  cameraVideo.srcObject = stream;
  cameraVideo.play();
  camStatusBadge.textContent = label;
  camStatusBadge.style.color = '#10b981';

  // Hook audio to analyser for visual meter
  if (stream.getAudioTracks().length > 0) {
    initAudioPipeline();
    const source = state.audioCtx.createMediaStreamSource(stream);
    source.connect(state.micGainNode);
  }
}

// Fetch network IP info for display
fetch('/api/network-info')
  .then(res => res.json())
  .then(data => {
    if (data.localCamUrl) {
      phoneLinkText.textContent = data.localCamUrl;
    }
  })
  .catch(() => {});

// ----------------------------------------------------
// 3. SHAPE MASKS & GEOMETRY
// ----------------------------------------------------
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.maskShape = btn.dataset.shape;
    updateCornerPosition(state.position);
  });
});

document.querySelectorAll('.frame-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.frame-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.frameStyle = btn.dataset.frame;
  });
});

document.querySelectorAll('.pos-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.position = btn.dataset.pos;
    updateCornerPosition(btn.dataset.pos);
  });
});

camSizeSlider.addEventListener('input', (e) => {
  const size = parseInt(e.target.value, 10);
  state.width = size;
  state.height = state.maskShape === 'portrait' ? Math.round(size * (16 / 9)) : size;
  updateCornerPosition(state.position);
});

camRadiusSlider.addEventListener('input', (e) => {
  state.cornerRadius = parseInt(e.target.value, 10);
});

camFlipToggle.addEventListener('change', (e) => {
  state.isMirrored = e.target.checked;
});

function updateCornerPosition(pos) {
  const padding = 50;
  const cw = canvas.width;
  const ch = canvas.height;
  const w = state.width;
  const h = state.height;

  switch (pos) {
    case 'top-right':
      state.x = cw - w - padding;
      state.y = padding;
      break;
    case 'top-left':
      state.x = padding;
      state.y = padding;
      break;
    case 'bottom-right':
      state.x = cw - w - padding;
      state.y = ch - h - padding;
      break;
    case 'bottom-left':
      state.x = padding;
      state.y = ch - h - padding;
      break;
  }
}

// Canvas Dragging
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  // Check if click is inside camera bounds
  if (
    mouseX >= state.x &&
    mouseX <= state.x + state.width &&
    mouseY >= state.y &&
    mouseY <= state.y + state.height
  ) {
    state.isDragging = true;
    state.dragOffsetX = mouseX - state.x;
    state.dragOffsetY = mouseY - state.y;
    state.position = 'custom';
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
  }
});

window.addEventListener('mousemove', (e) => {
  if (!state.isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  state.x = Math.max(10, Math.min(canvas.width - state.width - 10, mouseX - state.dragOffsetX));
  state.y = Math.max(10, Math.min(canvas.height - state.height - 10, mouseY - state.dragOffsetY));
});

window.addEventListener('mouseup', () => {
  state.isDragging = false;
});

// ----------------------------------------------------
// 4. REAL-TIME 60 FPS CANVAS COMPOSITOR
// ----------------------------------------------------
function drawRoundedRectPath(c, x, y, width, height, radius) {
  c.beginPath();
  c.moveTo(x + radius, y);
  c.lineTo(x + width - radius, y);
  c.arcTo(x + width, y, x + width, y + radius, radius);
  c.lineTo(x + width, y + height - radius);
  c.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  c.lineTo(x + radius, y + height);
  c.arcTo(x, y + height, x, y + height - radius, radius);
  c.lineTo(x, y + radius);
  c.arcTo(x, y, x + radius, y, radius);
  c.closePath();
}

function renderFrame() {
  const cw = canvas.width;
  const ch = canvas.height;

  // 1. Draw Background: Screen Capture or Modern Dark Canvas Background
  if (state.screenStream && screenVideo.readyState >= 2) {
    ctx.drawImage(screenVideo, 0, 0, cw, ch);
  } else {
    // Elegant workspace test background if screen is not yet selected
    const grad = ctx.createRadialGradient(cw / 2, ch / 2, 50, cw / 2, ch / 2, cw * 0.7);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle modern grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Centered helper text
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '600 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click "Select Screen / Window" to pipe desktop feed', cw / 2, ch / 2);
  }

  // 2. Camera Overlay Layer
  const { x, y, width, height, cornerRadius, maskShape, frameStyle, isMirrored } = state;

  ctx.save();

  // Create clipping path for chosen mask shape
  if (maskShape === 'circle') {
    const radius = Math.min(width, height) / 2;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    // Squircle / Rounded Rect / Portrait
    const effectiveRadius = maskShape === 'circle' ? width / 2 : Math.min(cornerRadius, width / 2, height / 2);
    drawRoundedRectPath(ctx, x, y, width, height, effectiveRadius);
  }

  // Apply clip
  ctx.save();
  ctx.clip();

  // Draw Camera Video Feed
  if (state.cameraStream && cameraVideo.readyState >= 2) {
    ctx.save();
    if (isMirrored) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(cameraVideo, 0, 0, width, height);
    } else {
      ctx.drawImage(cameraVideo, x, y, width, height);
    }
    ctx.restore();
  } else {
    // Placeholder talking head if camera is waiting
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Camera Feed Waiting...', x + width / 2, y + height / 2);
  }

  ctx.restore(); // restore clip

  // 3. Render Sleek Frame Overlay / Border Glow (as seen in user screenshot!)
  if (frameStyle !== 'none') {
    const borderWidth = 6;
    ctx.lineWidth = borderWidth;

    if (frameStyle === 'amber') {
      // Warm amber/gold modern halo from user screenshot
      const grad = ctx.createLinearGradient(x, y, x + width, y + height);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(0.5, '#fbbf24');
      grad.addColorStop(1, '#d97706');
      ctx.strokeStyle = grad;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
      ctx.shadowBlur = 18;
    } else if (frameStyle === 'neon') {
      ctx.strokeStyle = '#06b6d4';
      ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
      ctx.shadowBlur = 20;
    } else if (frameStyle === 'purple') {
      ctx.strokeStyle = '#a855f7';
      ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
      ctx.shadowBlur = 18;
    }

    if (maskShape === 'circle') {
      const radius = Math.min(width, height) / 2;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const effectiveRadius = Math.min(cornerRadius, width / 2, height / 2);
      drawRoundedRectPath(ctx, x, y, width, height, effectiveRadius);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Audio meter polling
  if (state.analyser) {
    const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    const pct = Math.min(100, Math.round((avg / 128) * 100));
    audioMeterBar.style.width = `${pct}%`;
  }

  requestAnimationFrame(renderFrame);
}

// Start 60fps loop
requestAnimationFrame(renderFrame);

// ----------------------------------------------------
// 5. SYNCHRONIZED RECORDING (MediaRecorder & MP4/WebM)
// ----------------------------------------------------
toggleRecordBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  initAudioPipeline();
  state.recordedChunks = [];

  // Capture canvas video stream at 60 FPS
  const canvasStream = canvas.captureStream(60);

  // Combine with mixed audio track if available
  const mixedAudioTracks = state.audioDestination ? state.audioDestination.stream.getAudioTracks() : [];
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...mixedAudioTracks
  ]);

  // Codec selection
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : 'video/webm';

  try {
    state.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps High Quality 1080p
    });

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        state.recordedChunks.push(e.data);
      }
    };

    state.mediaRecorder.onstop = handleRecordingComplete;

    state.mediaRecorder.start(1000); // 1-second chunks
    state.isRecording = true;
    state.recordStartTime = Date.now();

    // UI Updates
    toggleRecordBtn.classList.remove('btn-primary');
    toggleRecordBtn.classList.add('btn-danger');
    toggleRecordBtn.innerHTML = '<span>⏹</span> Stop Recording';
    recordingIndicator.style.display = 'flex';

    state.recordTimerInterval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - state.recordStartTime) / 1000);
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      recTimerText.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    console.error('Failed to start MediaRecorder:', err);
    alert('Recording failed: ' + err.message);
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    clearInterval(state.recordTimerInterval);

    toggleRecordBtn.classList.remove('btn-danger');
    toggleRecordBtn.classList.add('btn-primary');
    toggleRecordBtn.innerHTML = '<span>⏺</span> Start Recording';
    recordingIndicator.style.display = 'none';
  }
}

async function handleRecordingComplete() {
  const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
  const filename = `LoomLens-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

  // If in Electron, save directly to user's disk via native dialog
  if (window.electronAPI && window.electronAPI.saveRecording) {
    const arrayBuffer = await blob.arrayBuffer();
    const result = await window.electronAPI.saveRecording(arrayBuffer, filename);
    if (result.success) {
      alert(`Recording saved to: ${result.filePath}`);
      return;
    }
  }

  // Web download fallback
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
