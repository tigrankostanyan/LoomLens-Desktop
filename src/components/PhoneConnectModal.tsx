import React, { useState } from 'react';
import { Smartphone, QrCode, Copy, Check, ExternalLink, RefreshCw, Zap, X, ShieldCheck } from 'lucide-react';
import { NetworkInfo, RemotePhoneTelemetry } from '../types';

interface PhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkInfo: NetworkInfo | null;
  telemetry: RemotePhoneTelemetry;
  onSendCommand: (action: string, payload?: unknown) => void;
  onRefreshNetwork: () => void;
}

export const PhoneConnectModal: React.FC<PhoneConnectModalProps> = ({
  isOpen,
  onClose,
  networkInfo,
  telemetry,
  onSendCommand,
  onRefreshNetwork,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const targetUrl = networkInfo?.cloudCamUrl || (typeof window !== 'undefined' ? `${window.location.origin}/cam` : '');
  const localUrl = networkInfo?.localCamUrl || `http://${networkInfo?.primaryIp || '192.168.1.x'}:3000/cam`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Remote Smartphone Camera Node
                {telemetry.connected ? (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Connected
                  </span>
                ) : (
                  <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                    Waiting for Phone...
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Use your iPhone or Android as an ultra-high definition wireless webcam
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* QR Code and Quick Connect */}
          <div className="flex flex-col md:flex-row items-center gap-6 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
            <div className="flex-shrink-0 bg-white p-3 rounded-xl shadow-lg relative group">
              {networkInfo?.qrDataUrl ? (
                <img
                  src={networkInfo.qrDataUrl}
                  alt="Scan QR code to connect smartphone"
                  className="w-40 h-40 object-contain"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-slate-400 bg-slate-100 rounded-lg">
                  <QrCode className="w-12 h-12 text-slate-500 animate-pulse" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-semibold uppercase tracking-wider bg-blue-500/10 px-2.5 py-1 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" /> Step 1: Scan with phone camera
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Point your phone's camera app at this QR code. It will open the dedicated mobile camera client over low-latency WebRTC.
              </p>

              {/* Direct links & Quick test button */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={targetUrl}
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(targetUrl)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Instant Open Test Tab button */}
                <a
                  href="/cam"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Բացել կամերայի էջը նոր պատուհանով (Թեստավորել տեղում)
                </a>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-200/90 leading-relaxed">
                  💡 <b>Հուշում.</b> Եթե հեռախոսով QR-ը սկանավորելիս էջը չի բացվում Google-ի պաշտպանության պատճառով, սեղմիր վերևի կոճակը կամ Sidebar-ից ընտրիր <b>«Local Webcam»</b>՝ համակարգչիդ կամերան անմիջապես տեսնելու համար:
                </div>

                {networkInfo?.localCamUrl && (
                  <p className="text-[11px] text-slate-500">
                    Տեղային WiFi IP (Local Run): <span className="font-mono text-slate-400">{localUrl}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Remote Telemetry & Controls if Connected */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Remote Camera Telemetry & Controls</span>
              <button
                onClick={onRefreshNetwork}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Stream State</span>
                <span className={`text-xs font-bold ${telemetry.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {telemetry.connected ? 'Active (P2P)' : 'Standby'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Resolution</span>
                <span className="text-xs font-bold text-sky-400">
                  {telemetry.resolution || '1080p FHD'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Frame Rate</span>
                <span className="text-xs font-bold text-emerald-400">
                  {telemetry.fps ? `${telemetry.fps} FPS` : '60 FPS Target'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Lens Active</span>
                <span className="text-xs font-bold text-amber-300">
                  {telemetry.facingMode === 'environment' ? 'Rear (Main)' : 'Front (Selfie)'}
                </span>
              </div>
            </div>

            {/* Remote commands triggerable from desktop */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
              <button
                onClick={() => onSendCommand('flip')}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                Flip Camera Lens
              </button>

              <button
                onClick={() => onSendCommand('toggle-torch')}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Toggle Flashlight / Torch
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
