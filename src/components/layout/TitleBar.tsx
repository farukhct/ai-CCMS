import React, { useState } from 'react';
import { Minus, Square, X, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TitleBar: React.FC = () => {
  const { settings } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    // If in Electron, triggers ipcRenderer.send('window-minimize')
    if ((window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI?.maximize) {
      (window as any).electronAPI.maximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    if ((window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    }
  };

  return (
    <div className="h-8 bg-slate-900 text-slate-300 flex items-center justify-between px-3 select-none text-xs border-b border-slate-800 z-50">
      {/* Title & Brand */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-teal-600 flex items-center justify-center text-white font-bold text-[10px]">
          C
        </div>
        <span className="font-medium tracking-wide text-slate-200">
          {settings.appName}
        </span>
        <span className="text-slate-500">·</span>
        <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Offline Secure Mode
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="w-7 h-6 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-6 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-6 flex items-center justify-center hover:bg-red-700 text-slate-400 hover:text-white transition-colors"
          title="Close Window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
