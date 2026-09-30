/**
 * LoomLens Screen & Camera Studio
 * Professional Desktop & Smartphone WebRTC Recorder with 60 FPS HTML5 Canvas Compositor
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Video,
  Monitor,
  Smartphone,
  Mic,
  MicOff,
  CircleDot,
  Square,
  Pause,
  Play,
  Download,
  Settings,
  QrCode,
  Layers,
  Sparkles,
  Sliders,
  Volume2,
  RotateCw,
  Zap,
  HardDrive,
  Cpu,
  Info,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Palette,
  SquareDashedBottom,
  CheckCircle,
} from 'lucide-react';

import {
  CameraGeometry,
  CameraSourceType,
  MaskShape,
  FrameStyle,
  NetworkInfo,
  RemotePhoneTelemetry,
  RecordedVideoData,
} from './types';
import { CanvasCompositor } from './components/CanvasCompositor';
import { PhoneConnectModal } from './components/PhoneConnectModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { RecordingReviewModal } from './components/RecordingReviewModal';

export default function App() {
  // ----------------------------------------------------
  // State
  // ----------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraSource, setCameraSource] = useState<CameraSourceType>('phone');

  // Geometry & Styling state (matching the user's reference image with top-right amber squircle)
  const [geometry, setGeometry] = useState<CameraGeometry>({
    x: 1450,
    y: 50,
    width: 400,
    height: 400,
    cornerRadius: 48,
    maskShape: 'squircle',
    frameStyle: 'amber',
    borderWidth: 6,
    glowIntensity: 22,
    isMirrored: true,
    zoom: 1.0,
    audioReactiveGlow: true,
  });

  // Audio Processing State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [recordedVideoData, setRecordedVideoData] = useState<RecordedVideoData | null>(null);

  // Networking & Remote Phone WebRTC
  const socketRef = useRef<Socket | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [phoneTelemetry, setPhoneTelemetry] = useState<RemotePhoneTelemetry>({
    connected: false,
    role: 'desktop',
  });

  // Modals
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'screen' | 'framing' | 'audio'>('camera');

  // ----------------------------------------------------
  // Audio Pipeline Setup
  // ----------------------------------------------------
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const gain = ctx.createGain();

      gain.connect(analyser);
      gain.connect(dest);

      audioCtxRef.current = ctx;
      audioDestRef.current = dest;
      analyserRef.current = analyser;
      micGainRef.current = gain;

      // Start VU meter loop
      const updateMeter = () => {
        if (analyserRef.current) {
          const pcm = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(pcm);
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) sum += pcm[i];
          const avg = sum / pcm.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        }
        requestAnimationFrame(updateMeter);
      };
      requestAnimationFrame(updateMeter);
    }
  }, []);

  // ----------------------------------------------------
  // Socket.io & WebRTC Initialization
  // ----------------------------------------------------
  const fetchNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      setNetworkInfo(data);
    } catch (err) {
      console.warn('Could not fetch network info:', err);
    }
  }, []);

  useEffect(() => {
    fetchNetworkInfo();

    const socket = io();
    socketRef.current = socket;
    const roomId = 'loom-studio-room';

    socket.emit('join-room', roomId, 'desktop');

    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    socket.on('peer-joined', ({ peerId, role }) => {
      if (role === 'mobile') {
        setPhoneTelemetry((prev) => ({ ...prev, connected: true }));
      }
    });

    socket.on('offer', async ({ sender, sdp }) => {
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnRef.current = pc;

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          setCameraStream(remoteStream);
          setCameraSource('phone');

          // Wire audio track
          if (remoteStream.getAudioTracks().length > 0) {
            initAudio();
            if (audioCtxRef.current && micGainRef.current) {
              const src = audioCtxRef.current.createMediaStreamSource(remoteStream);
              src.connect(micGainRef.current);
            }
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { target: sender, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setPhoneTelemetry((prev) => ({
          ...prev,
          connected: state === 'connected',
        }));
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer', { target: sender, sdp: answer });
    });

    socket.on('answer', async ({ sdp }) => {
      if (peerConnRef.current) {
        await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (peerConnRef.current && candidate) {
        try {
          await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    socket.on('camera-telemetry', (telemetry: Partial<RemotePhoneTelemetry>) => {
      setPhoneTelemetry((prev) => ({ ...prev, ...telemetry, connected: true }));
    });

    socket.on('peer-disconnected', () => {
      setPhoneTelemetry((prev) => ({ ...prev, connected: false }));
    });

    return () => {
      socket.disconnect();
      if (peerConnRef.current) peerConnRef.current.close();
    };
  }, [fetchNetworkInfo, initAudio]);

  // Send control command to remote phone
  const sendPhoneCommand = (action: string, payload?: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit('remote-camera-control', { action, payload });
    }
  };

  // ----------------------------------------------------
  // Screen Capture Handlers
  // ----------------------------------------------------
  const handleSelectScreen = async () => {
    try {
      // Check for Electron IPC desktopCapturer first
      if (window.electronAPI && window.electronAPI.getDesktopSources) {
        const sources = await window.electronAPI.getDesktopSources({ types: ['screen', 'window'] });
        if (sources.length > 0) {
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
              },
            } as MediaTrackConstraints,
          });
          setScreenStream(stream);
          return;
        }
      }

      // Browser standard Display Media API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });

      setScreenStream(stream);

      // Pipe system audio if available
      if (stream.getAudioTracks().length > 0) {
        initAudio();
        if (audioCtxRef.current && audioDestRef.current) {
          const sysSource = audioCtxRef.current.createMediaStreamSource(stream);
          sysSource.connect(audioDestRef.current);
        }
      }

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };
    } catch (err) {
      console.warn('Screen selection cancelled or failed:', err);
    }
  };

  // ----------------------------------------------------
  // Local Webcam Fallback
  // ----------------------------------------------------
  const handleUseWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: true,
      });

      setCameraStream(stream);
      setCameraSource('webcam');

      if (stream.getAudioTracks().length > 0) {
        initAudio();
        if (audioCtxRef.current && micGainRef.current) {
          const micSource = audioCtxRef.current.createMediaStreamSource(stream);
          micSource.connect(micGainRef.current);
        }
      }
    } catch (err) {
      console.error('Failed to get webcam stream:', err);
      alert('Կամերային միանալ չհաջողվեց: Խնդրում ենք բրաուզերում թույլատրել կամերայի հասանելիությունը: ' + (err as Error).message);
    }
  };

  // ----------------------------------------------------
  // Virtual Test Stream
  // ----------------------------------------------------
  const handleUseVirtual = () => {
    // Generate a high quality animated canvas stream for virtual demo
    const vCanvas = document.createElement('canvas');
    vCanvas.width = 1280;
    vCanvas.height = 720;
    const vCtx = vCanvas.getContext('2d');
    if (!vCtx) return;

    let t = 0;
    const loop = () => {
      t += 0.03;
      vCtx.fillStyle = '#0f172a';
      vCtx.fillRect(0, 0, 1280, 720);

      // Gradient background
      const grad = vCtx.createRadialGradient(640, 360, 50, 640, 360, 600);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#020617');
      vCtx.fillStyle = grad;
      vCtx.fillRect(0, 0, 1280, 720);

      // Presenter talking head avatar animation
      const headY = 320 + Math.sin(t) * 12;
      vCtx.fillStyle = '#f59e0b';
      vCtx.beginPath();
      vCtx.arc(640, headY, 90, 0, Math.PI * 2);
      vCtx.fill();

      // Beard / feature style
      vCtx.fillStyle = '#78350f';
      vCtx.beginPath();
      vCtx.arc(640, headY + 30, 70, 0, Math.PI);
      vCtx.fill();

      // Eyes
      vCtx.fillStyle = '#0f172a';
      vCtx.beginPath();
      vCtx.arc(610, headY - 10, 8, 0, Math.PI * 2);
      vCtx.arc(670, headY - 10, 8, 0, Math.PI * 2);
      vCtx.fill();

      // Torso
      vCtx.fillStyle = '#1e293b';
      vCtx.beginPath();
      vCtx.arc(640, headY + 360, 260, Math.PI, 0);
      vCtx.fill();

      // HUD Text
      vCtx.fillStyle = '#38bdf8';
      vCtx.font = '700 24px monospace';
      vCtx.textAlign = 'center';
      vCtx.fillText('VIRTUAL TALKING HEAD (60 FPS)', 640, 620);
      vCtx.fillStyle = '#94a3b8';
      vCtx.font = '500 16px monospace';
      vCtx.fillText(`TIME: ${new Date().toLocaleTimeString()} // SYNC ACTIVE`, 640, 655);

      requestAnimationFrame(loop);
    };
    loop();

    const stream = vCanvas.captureStream(60);
    setCameraStream(stream);
    setCameraSource('virtual');
  };

  // ----------------------------------------------------
  // MediaRecorder Synchronized Recording Pipeline
  // ----------------------------------------------------
  const handleStartRecording = () => {
    initAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;

    recordedChunksRef.current = [];

    // Capture 60 FPS video stream from HTML5 canvas
    const canvasStream = canvas.captureStream(60);

    // Combine canvas video track + mixed audio tracks
    const audioTracks = audioDestRef.current ? audioDestRef.current.stream.getAudioTracks() : [];
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);

    // Choose optimal codec
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else {
        mimeType = 'video/webm';
      }
    }

    try {
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 10000000, // 10 Mbps Ultra Quality
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const filename = `LoomLens-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;

        setRecordedVideoData({
          blob,
          url,
          durationSec: recordingSeconds,
          sizeBytes: blob.size,
          timestamp: new Date().toLocaleTimeString(),
          filename,
        });

        setIsReviewModalOpen(true);
      };

      recorder.start(1000); // 1-second timeslices
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      alert('Could not start recording: ' + (err as Error).message);
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Toggle Mute
  const toggleMute = () => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = isMuted ? 1 : 0;
      setIsMuted(!isMuted);
    }
  };

  // Quick corner snap
  const snapToCorner = (corner: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') => {
    const padding = 50;
    const cw = 1920;
    const ch = 1080;
    const w = geometry.width;
    const h = geometry.height;

    let nx = 0;
    let ny = 0;

    if (corner === 'top-right') { nx = cw - w - padding; ny = padding; }
    else if (corner === 'top-left') { nx = padding; ny = padding; }
    else if (corner === 'bottom-right') { nx = cw - w - padding; ny = ch - h - padding; }
    else if (corner === 'bottom-left') { nx = padding; ny = ch - h - padding; }

    setGeometry((prev) => ({ ...prev, x: nx, y: ny }));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP HEADER / APP BAR                              */}
      {/* ---------------------------------------------------- */}
      <header className="h-16 px-5 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xl flex items-center justify-between z-20 flex-shrink-0">
        {/* Brand & Indicators */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white">LoomLens Studio</h1>
              <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                60 FPS COMPOSITOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Desktop Screen & Remote Cam Node</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                WebRTC Engine
              </span>
            </p>
          </div>
        </div>

        {/* Center: Live Recording Controls & Timer */}
        <div className="flex items-center gap-3">
          {isRecording ? (
            <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-red-500/40 shadow-lg shadow-red-500/10">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-mono text-sm font-bold text-red-400 tracking-wider">
                {formatTime(recordingSeconds)}
              </span>

              <button
                onClick={handlePauseRecording}
                className="ml-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleStopRecording}
                className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Square className="w-3 h-3 fill-current" />
                Finish
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartRecording}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold tracking-wide flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all transform active:scale-95"
            >
              <CircleDot className="w-4 h-4 text-white" />
              Start Recording
            </button>
          )}

          {/* Audio VU Meter Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-blue-400" />}
            </button>
            <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-75"
                style={{ width: `${isMuted ? 0 : audioLevel}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Right Header Navigation & Modals */}
        <div className="flex items-center gap-2">
          {/* Remote Smartphone Hub button */}
          <button
            onClick={() => setIsPhoneModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              phoneTelemetry.connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Phone Cam:</span>
            {phoneTelemetry.connected ? 'Connected' : 'Pair Phone'}
          </button>

          {/* Architecture & Code Deliverables Guide */}
          <button
            onClick={() => setIsArchModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Electron & Architecture</span>
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN WORKSPACE: CANVAS + DOCK SIDEBAR             */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Stage Canvas Viewport */}
        <main className="flex-1 relative bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
          {/* Quick status & activation banner above canvas */}
          {!cameraStream ? (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900/95 border border-amber-500/50 shadow-2xl px-4 py-2 rounded-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>Կամերան դեռ միացված չէ:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUseWebcam}
                  className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Video className="w-3.5 h-3.5" />
                  Միացնել համակարգչի կամերան
                </button>
                <button
                  onClick={() => setIsPhoneModalOpen(true)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  Միացնել հեռախոսով (QR)
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-emerald-950/85 border border-emerald-500/50 shadow-xl px-4 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold text-emerald-300 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Կամերան ակտիվ է ({cameraSource === 'phone' ? 'Հեռախոս P2P' : cameraSource === 'webcam' ? 'Վեբկամերա' : 'Virtual HD'})</span>
              <button
                onClick={() => {
                  cameraStream.getTracks().forEach((t) => t.stop());
                  setCameraStream(null);
                }}
                className="ml-2 text-slate-400 hover:text-red-400 text-[11px] underline transition-colors"
              >
                Անջատել
              </button>
            </div>
          )}

          <CanvasCompositor
            canvasRef={canvasRef}
            screenStream={screenStream}
            cameraStream={cameraStream}
            geometry={geometry}
            onUpdateGeometry={(newGeo) => setGeometry((prev) => ({ ...prev, ...newGeo }))}
            analyserNode={analyserRef.current}
            isRecording={isRecording}
          />
        </main>

        {/* Right: Studio Control Sidebar */}
        <aside className="w-80 lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-hidden shadow-2xl">
          {/* Sidebar Tab Navigation */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/40 text-xs">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-3 font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Camera Node
            </button>

            <button
              onClick={() => setActiveTab('framing')}
              className={`flex-1 py-3 font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'framing'
                  ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              Framing & Glow
            </button>

            <button
              onClick={() => setActiveTab('screen')}
              className={`flex-1 py-3 font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'screen'
                  ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Screen
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 p-5 overflow-y-auto space-y-6">
            {/* TAB 1: CAMERA SOURCE & POSITIONING */}
            {activeTab === 'camera' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Source Selection Buttons */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Camera Input Stream
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setCameraSource('phone');
                        setIsPhoneModalOpen(true);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        cameraSource === 'phone'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-blue-400" />
                      <span>Remote Phone</span>
                    </button>

                    <button
                      onClick={handleUseWebcam}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        cameraSource === 'webcam'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Video className="w-4 h-4 text-emerald-400" />
                      <span>Local Webcam</span>
                    </button>

                    <button
                      onClick={handleUseVirtual}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        cameraSource === 'virtual'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Virtual HD</span>
                    </button>
                  </div>
                </div>

                {/* Remote Phone Status Card */}
                {cameraSource === 'phone' && (
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Smartphone WebRTC Node</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                          phoneTelemetry.connected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {phoneTelemetry.connected ? 'Streaming 60fps' : 'Standby / QR Pairing'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Open <code className="text-slate-300 font-mono">/cam</code> on your phone or scan QR code.
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setIsPhoneModalOpen(true)}
                        className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Show QR Code
                      </button>

                      <button
                        onClick={() => sendPhoneCommand('flip')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                        title="Remote Flip Phone Camera"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => sendPhoneCommand('toggle-torch')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs rounded-lg transition-colors"
                        title="Remote Flashlight Torch"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Corner Snap Buttons */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Corner Positioning
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => snapToCorner('top-right')}
                      className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Top-Right (Default)
                    </button>
                    <button
                      onClick={() => snapToCorner('top-left')}
                      className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Top-Left
                    </button>
                    <button
                      onClick={() => snapToCorner('bottom-right')}
                      className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Bottom-Right
                    </button>
                    <button
                      onClick={() => snapToCorner('bottom-left')}
                      className="p-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Bottom-Left
                    </button>
                  </div>
                </div>

                {/* Size & Scale Sliders */}
                <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Camera Overlay Size</span>
                    <span className="font-mono text-blue-400 font-bold">{geometry.width} px</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="650"
                    step="10"
                    value={geometry.width}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGeometry((prev) => ({
                        ...prev,
                        width: val,
                        height: prev.maskShape === 'portrait' ? Math.round(val * (16 / 9)) : val,
                      }));
                    }}
                    className="w-full accent-blue-500 cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-slate-300 font-medium">Digital Zoom (In-Mask)</span>
                    <span className="font-mono text-blue-400 font-bold">{geometry.zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.1"
                    value={geometry.zoom}
                    onChange={(e) => setGeometry((prev) => ({ ...prev, zoom: Number(e.target.value) }))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-slate-300 font-medium">Mirror / Flip Camera</span>
                    <input
                      type="checkbox"
                      checked={geometry.isMirrored}
                      onChange={(e) => setGeometry((prev) => ({ ...prev, isMirrored: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FRAMING, MASKS & GLOW OVERLAYS */}
            {activeTab === 'framing' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Mask Shapes */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Mask Geometry Shape
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, maskShape: 'squircle', cornerRadius: 48 }))}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                        geometry.maskShape === 'squircle'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-lg border-2 border-current"></div>
                      <span>Squircle (Loom Pro)</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, maskShape: 'circle' }))}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                        geometry.maskShape === 'circle'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-current"></div>
                      <span>Round Talking Head</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, maskShape: 'portrait', height: Math.round(prev.width * (16 / 9)) }))}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                        geometry.maskShape === 'portrait'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-3.5 h-5 rounded border-2 border-current"></div>
                      <span>9:16 Portrait (Mobile)</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, maskShape: 'rect' }))}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                        geometry.maskShape === 'rect'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-5 h-4 rounded border-2 border-current"></div>
                      <span>Rounded Rectangle</span>
                    </button>
                  </div>
                </div>

                {/* Frame Style & Border Halo */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Custom Border & Frame Overlay
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, frameStyle: 'amber' }))}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        geometry.frameStyle === 'amber'
                          ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400"></span>
                      <span>Golden Halo (Ref)</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, frameStyle: 'neon' }))}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        geometry.frameStyle === 'neon'
                          ? 'bg-cyan-500/25 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
                      <span>Cyan Neon</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, frameStyle: 'purple' }))}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        geometry.frameStyle === 'purple'
                          ? 'bg-purple-500/25 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/20'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400"></span>
                      <span>Ultraviolet</span>
                    </button>

                    <button
                      onClick={() => setGeometry((prev) => ({ ...prev, frameStyle: 'minimal' }))}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        geometry.frameStyle === 'minimal'
                          ? 'bg-slate-700/40 border-slate-400 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-500"></span>
                      <span>Frameless</span>
                    </button>
                  </div>
                </div>

                {/* Sliders for Corner Radius & Border Thickness */}
                <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                  {geometry.maskShape !== 'circle' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">Squircle Corner Radius</span>
                        <span className="font-mono text-amber-400 font-bold">{geometry.cornerRadius} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={geometry.cornerRadius}
                        onChange={(e) => setGeometry((prev) => ({ ...prev, cornerRadius: Number(e.target.value) }))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Border Stroke Width</span>
                      <span className="font-mono text-amber-400 font-bold">{geometry.borderWidth} px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="16"
                      value={geometry.borderWidth}
                      onChange={(e) => setGeometry((prev) => ({ ...prev, borderWidth: Number(e.target.value) }))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Glow Intensity (Halo)</span>
                      <span className="font-mono text-amber-400 font-bold">{geometry.glowIntensity} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={geometry.glowIntensity}
                      onChange={(e) => setGeometry((prev) => ({ ...prev, glowIntensity: Number(e.target.value) }))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Voice-reactive dynamic glow */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-200 font-medium block">Voice Reactive Pulse</span>
                      <span className="text-[10px] text-slate-500">Border glow pulses when you talk</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={geometry.audioReactiveGlow}
                      onChange={(e) => setGeometry((prev) => ({ ...prev, audioReactiveGlow: e.target.checked }))}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SCREEN CAPTURE & AUDIO */}
            {activeTab === 'screen' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Desktop Screen Source */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Screen / Window Source
                  </label>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Status:</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                          screenStream ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {screenStream ? 'Screen Active (60 FPS)' : 'Mock Workstation Active'}
                      </span>
                    </div>

                    <button
                      onClick={handleSelectScreen}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors"
                    >
                      <Monitor className="w-4 h-4" />
                      Select Display / Window
                    </button>

                    {screenStream && (
                      <button
                        onClick={() => {
                          screenStream.getTracks().forEach((t) => t.stop());
                          setScreenStream(null);
                        }}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg transition-colors"
                      >
                        Stop Screen Sharing
                      </button>
                    )}
                  </div>
                </div>

                {/* System Audio & Microphone */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Audio Mixing Engine
                  </label>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Microphone Track</span>
                      <span className="text-emerald-400 font-mono text-[11px]">Synced to Compositor</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Audio Meter</span>
                        <span>{audioLevel}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-75"
                          style={{ width: `${audioLevel}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                      Microphone and system desktop audio are synchronized in real-time through the Web Audio API <code>AudioContext</code> destination node.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. MODALS                                            */}
      {/* ---------------------------------------------------- */}
      <PhoneConnectModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        networkInfo={networkInfo}
        telemetry={phoneTelemetry}
        onSendCommand={sendPhoneCommand}
        onRefreshNetwork={fetchNetworkInfo}
      />

      <ArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />

      <RecordingReviewModal
        data={recordedVideoData}
        onClose={() => setIsReviewModalOpen(false)}
      />
    </div>
  );
}
