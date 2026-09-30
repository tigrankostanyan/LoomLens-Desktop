import React from 'react';
import { Download, X, Play, Clock, HardDrive, CheckCircle2, Film } from 'lucide-react';
import { RecordedVideoData } from '../types';

interface RecordingReviewModalProps {
  data: RecordedVideoData | null;
  onClose: () => void;
}

export const RecordingReviewModal: React.FC<RecordingReviewModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    // If in Electron, use native save dialog
    if (window.electronAPI && window.electronAPI.saveRecording) {
      try {
        const buffer = await data.blob.arrayBuffer();
        const res = await window.electronAPI.saveRecording(buffer, data.filename);
        if (res.success) {
          alert(`Saved successfully to ${res.filePath}`);
          return;
        }
      } catch (e) {
        console.error('Electron save failed, falling back to browser download:', e);
      }
    }

    // Standard browser download
    const a = document.createElement('a');
    a.href = data.url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Recording Complete & Ready
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                  1080p 60 FPS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Synchronized screen + camera overlay stream rendered & encoded
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

        {/* Video Player Preview */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner group">
            <video
              src={data.url}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Video Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Duration</span>
                <span className="text-sm font-bold text-white">{formatDuration(data.durationSec)}</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">File Size</span>
                <span className="text-sm font-bold text-white">{formatFileSize(data.sizeBytes)}</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Resolution</span>
                <span className="text-sm font-bold text-white">1920 × 1080</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Container</span>
                <span className="text-sm font-bold text-white">WebM / VP9</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Dismiss
          </button>

          <button
            onClick={handleDownload}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            Download Recording
          </button>
        </div>
      </div>
    </div>
  );
};
