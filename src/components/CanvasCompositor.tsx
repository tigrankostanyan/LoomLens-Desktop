import React, { useEffect, useRef, useState } from 'react';
import { CameraGeometry, CornerPosition } from '../types';
import { Move, ZoomIn, Eye, Sparkles } from 'lucide-react';

interface CanvasCompositorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
  geometry: CameraGeometry;
  onUpdateGeometry: (newGeo: Partial<CameraGeometry>) => void;
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export const CanvasCompositor: React.FC<CanvasCompositorProps> = ({
  canvasRef,
  screenStream,
  cameraStream,
  geometry,
  onUpdateGeometry,
  analyserNode,
  isRecording,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const cameraVideoRef = useRef<HTMLVideoElement>(document.createElement('video'));

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [fps, setFps] = useState(60);

  // Setup video pipeline sources
  useEffect(() => {
    const sVideo = screenVideoRef.current;
    sVideo.playsInline = true;
    sVideo.autoplay = true;
    sVideo.muted = true;

    if (screenStream) {
      sVideo.srcObject = screenStream;
      sVideo.play().catch(() => {});
    } else {
      sVideo.srcObject = null;
    }
  }, [screenStream]);

  useEffect(() => {
    const cVideo = cameraVideoRef.current;
    cVideo.playsInline = true;
    cVideo.autoplay = true;
    cVideo.muted = true;

    if (cameraStream) {
      cVideo.srcObject = cameraStream;
      cVideo.play().catch(() => {});
    } else {
      cVideo.srcObject = null;
    }
  }, [cameraStream]);

  // Main 60 FPS Canvas Compositor render loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    // Virtual background ticker for mock workstation when no screen capture is selected
    let virtualClock = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = (now: number) => {
      frameCount++;
      if (now - lastFpsUpdate >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      lastTime = now;
      virtualClock += 0.02;

      const cw = canvas.width;
      const ch = canvas.height;
      const sVideo = screenVideoRef.current;
      const cVideo = cameraVideoRef.current;

      // -----------------------------------------------------------------
      // 1. BACKGROUND LAYER: Screen Stream or Benchmark/Code Workstation Mock
      // -----------------------------------------------------------------
      if (screenStream && sVideo.readyState >= 2) {
        ctx.drawImage(sVideo, 0, 0, cw, ch);
      } else {
        // High-tech dark workstation backdrop (resembling the user's benchmark screenshot)
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, cw, ch);

        // Header mock bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, 64);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, cw, 64);

        // Terminal dots
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(30, 32, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(50, 32, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.beginPath(); ctx.arc(70, 32, 6, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.font = '600 14px monospace';
        ctx.fillText('LoomLens Studio // Ready for Screen Capture', 100, 37);

        // Workspace Panels Mockup
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(40, 94, cw - 80, ch - 134);
        ctx.strokeStyle = '#1e293b';
        ctx.strokeRect(40, 94, cw - 80, ch - 134);

        // Card 1
        ctx.fillStyle = '#111c35';
        ctx.fillRect(70, 130, 850, 420);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(70, 130, 850, 420);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText('M3 Ultra 512GB - Active Pipeline', 100, 180);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 15px monospace';
        ctx.fillText(`GPU 4% • GPU POWER 0.1W • RAM 39.0 / 512GB • FPS: ${fps}`, 100, 215);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 64px -apple-system, sans-serif';
        ctx.fillText('1.42s', 100, 310);

        // Card 2
        ctx.fillStyle = '#111c35';
        ctx.fillRect(960, 130, 850, 420);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(960, 130, 850, 420);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText('M5 Ultra 256GB - Neural Engine', 990, 180);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 15px monospace';
        ctx.fillText('GPU 0% • RAM 39.3 / 256GB • RUNNING STATUS: OK', 990, 215);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 64px -apple-system, sans-serif';
        ctx.fillText('1.41s', 990, 310);

        // Hint overlay on canvas center
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(cw / 2 - 320, ch - 240, 640, 80);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(cw / 2 - 320, ch - 240, 640, 80);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 16px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💡 Click "Select Screen / Window" in the sidebar to stream your real screen', cw / 2, ch - 195);
        ctx.textAlign = 'left';
      }

      // -----------------------------------------------------------------
      // 2. AUDIO LEVEL ANALYSIS FOR VOICE-REACTIVE GLOW
      // -----------------------------------------------------------------
      let audioVolume = 0;
      if (analyserNode) {
        const pcmData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
        audioVolume = (sum / pcmData.length) / 255; // 0 to 1
      }

      // -----------------------------------------------------------------
      // 3. FOREGROUND CAMERA OVERLAY LAYER
      // -----------------------------------------------------------------
      const {
        x,
        y,
        width,
        height,
        cornerRadius,
        maskShape,
        frameStyle,
        borderWidth,
        glowIntensity,
        isMirrored,
        zoom,
        audioReactiveGlow,
      } = geometry;

      const dynamicGlow = audioReactiveGlow ? glowIntensity + audioVolume * 25 : glowIntensity;
      const effectiveBorder = audioReactiveGlow ? borderWidth + audioVolume * 4 : borderWidth;

      ctx.save();

      // Path helper for mask
      const makeMaskPath = (context: CanvasRenderingContext2D) => {
        context.beginPath();
        if (maskShape === 'circle') {
          const r = Math.min(width, height) / 2;
          context.arc(x + width / 2, y + height / 2, r, 0, Math.PI * 2);
        } else {
          // Squircle / Rounded Rectangle
          const r = Math.min(cornerRadius, width / 2, height / 2);
          context.moveTo(x + r, y);
          context.lineTo(x + width - r, y);
          context.arcTo(x + width, y, x + width, y + r, r);
          context.lineTo(x + width, y + height - r);
          context.arcTo(x + width, y + height, x + width - r, y + height, r);
          context.lineTo(x + r, y + height);
          context.arcTo(x, y + height, x, y + height - r, r);
          context.lineTo(x, y + r);
          context.arcTo(x, y, x + r, y, r);
        }
        context.closePath();
      };

      // Clip canvas to chosen mask
      ctx.save();
      makeMaskPath(ctx);
      ctx.clip();

      // Render camera stream
      if (cameraStream && cVideo.readyState >= 2) {
        ctx.save();

        // Calculate zoom transformation
        const z = Math.max(1, zoom);
        const zoomedW = width * z;
        const zoomedH = height * z;
        const offsetX = (zoomedW - width) / 2;
        const offsetY = (zoomedH - height) / 2;

        if (isMirrored) {
          ctx.translate(x + width, y);
          ctx.scale(-1, 1);
          ctx.drawImage(cVideo, -offsetX, -offsetY, zoomedW, zoomedH);
        } else {
          ctx.drawImage(cVideo, x - offsetX, y - offsetY, zoomedW, zoomedH);
        }
        ctx.restore();
      } else {
        // High quality camera placeholder avatar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, width, height);

        // Circular background glow inside
        const innerGrad = ctx.createRadialGradient(
          x + width / 2,
          y + height / 2,
          20,
          x + width / 2,
          y + height / 2,
          width / 2
        );
        innerGrad.addColorStop(0, '#1e293b');
        innerGrad.addColorStop(1, '#090d16');
        ctx.fillStyle = innerGrad;
        ctx.fillRect(x, y, width, height);

        // Talking head silhouette icon
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2 - 35, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2 + 75, 75, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 15px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Remote Cam Standing By', x + width / 2, y + height - 35);
        ctx.font = '500 12px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Scan QR or Connect Phone', x + width / 2, y + height - 16);
        ctx.textAlign = 'left';
      }

      ctx.restore(); // restore clip

      // -----------------------------------------------------------------
      // 4. FRAME OVERLAY & GLOW (User Reference Image styling)
      // -----------------------------------------------------------------
      if (frameStyle !== 'minimal') {
        ctx.save();
        ctx.lineWidth = effectiveBorder;

        if (frameStyle === 'amber') {
          // Warm Golden Halo from reference screenshot
          const grad = ctx.createLinearGradient(x, y, x + width, y + height);
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(0.3, '#fbbf24');
          grad.addColorStop(0.7, '#d97706');
          grad.addColorStop(1, '#b45309');
          ctx.strokeStyle = grad;
          ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
          ctx.shadowBlur = dynamicGlow;
        } else if (frameStyle === 'neon') {
          // Cyber Neon Cyan
          ctx.strokeStyle = '#06b6d4';
          ctx.shadowColor = 'rgba(6, 182, 212, 0.7)';
          ctx.shadowBlur = dynamicGlow;
        } else if (frameStyle === 'purple') {
          // Ultraviolet
          ctx.strokeStyle = '#a855f7';
          ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
          ctx.shadowBlur = dynamicGlow;
        } else if (frameStyle === 'custom-png') {
          // Dual ring futuristic style
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
          ctx.shadowBlur = dynamicGlow;
        }

        makeMaskPath(ctx);
        ctx.stroke();

        // Subtle dark inner bevel stroke for that polished broadcast feel
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 0;
        makeMaskPath(ctx);
        ctx.stroke();

        ctx.restore();
      }

      // Drag bounding indicator when hovering or dragging
      if (isDragging) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(x - 6, y - 6, width + 12, height + 12);
        ctx.restore();
      }

      // -----------------------------------------------------------------
      // 5. LIVE RECORDING BADGE ON CANVAS
      // -----------------------------------------------------------------
      if (isRecording) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.beginPath();
        ctx.arc(36, 36, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 14px -apple-system, sans-serif';
        ctx.fillText('REC', 54, 41);
        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [screenStream, cameraStream, geometry, analyserNode, isRecording, isDragging, fps]);

  // Mouse interaction: drag anywhere on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const { x, y, width, height } = geometry;

    if (mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height) {
      setIsDragging(true);
      setDragOffset({
        x: mouseX - x,
        y: mouseY - y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const newX = Math.max(10, Math.min(canvas.width - geometry.width - 10, mouseX - dragOffset.x));
    const newY = Math.max(10, Math.min(canvas.height - geometry.height - 10, mouseY - dragOffset.y));

    onUpdateGeometry({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* 1080p Canvas */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full max-h-[82vh] aspect-video object-contain rounded-xl shadow-2xl transition-all ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />

      {/* Floating Canvas Badges */}
      <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md text-[11px] font-mono font-semibold text-slate-300 border border-slate-800">
          1920 × 1080
        </span>
        <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 backdrop-blur-md text-[11px] font-mono font-semibold text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {fps} FPS
        </span>
      </div>

      {/* Quick corner positioning pill on top of canvas */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 shadow-xl text-xs text-slate-400">
        <Move className="w-3.5 h-3.5 text-blue-400" />
        <span className="mr-1">Drag camera freely or snap:</span>
        {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as CornerPosition[]).map((pos) => (
          <button
            key={pos}
            onClick={() => {
              const padding = 50;
              const cw = 1920;
              const ch = 1080;
              const w = geometry.width;
              const h = geometry.height;
              let nx = 0;
              let ny = 0;

              if (pos === 'top-right') { nx = cw - w - padding; ny = padding; }
              else if (pos === 'top-left') { nx = padding; ny = padding; }
              else if (pos === 'bottom-right') { nx = cw - w - padding; ny = ch - h - padding; }
              else if (pos === 'bottom-left') { nx = padding; ny = ch - h - padding; }

              onUpdateGeometry({ x: nx, y: ny });
            }}
            className="px-2 py-0.5 rounded-md hover:bg-slate-800 hover:text-white transition-colors capitalize text-[11px]"
          >
            {pos.replace('-', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
};
