export type MaskShape = 'squircle' | 'circle' | 'rect' | 'portrait' | 'widescreen';

export type FrameStyle = 'amber' | 'neon' | 'purple' | 'minimal' | 'custom-png';

export type CornerPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom';

export type CameraSourceType = 'phone' | 'webcam' | 'virtual';

export interface CameraGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  maskShape: MaskShape;
  frameStyle: FrameStyle;
  borderWidth: number;
  glowIntensity: number;
  isMirrored: boolean;
  zoom: number;
  audioReactiveGlow: boolean;
}

export interface RemotePhoneTelemetry {
  connected: boolean;
  role: 'mobile' | 'desktop';
  resolution?: string;
  fps?: number;
  facingMode?: 'user' | 'environment';
  torchSupported?: boolean;
  isTorchOn?: boolean;
  battery?: number;
  pingMs?: number;
}

export interface NetworkInfo {
  localIps: string[];
  port: number;
  primaryIp: string;
  localCamUrl: string;
  cloudCamUrl: string;
  qrDataUrl: string;
}

export interface RecordedVideoData {
  blob: Blob;
  url: string;
  durationSec: number;
  sizeBytes: number;
  timestamp: string;
  filename: string;
}
