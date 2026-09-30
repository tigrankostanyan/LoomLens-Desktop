export interface ElectronDesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
  display_id?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  getDesktopSources: (options?: { types?: string[] }) => Promise<ElectronDesktopSource[]>;
  saveRecording: (buffer: ArrayBuffer, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  getNetworkInfo: () => Promise<{ localIps: string[]; primaryIp: string; port: number }>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openPath: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
