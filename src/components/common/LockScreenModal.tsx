import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, LogOut } from 'lucide-react';

export const LockScreenModal: React.FC = () => {
  const { isLocked, currentUser, unlockSession, logout, settings } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isLocked || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Password is required to unlock.');
      return;
    }

    const success = unlockSession(password);
    if (success) {
      setPassword('');
      setError(null);
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-[#0f3a5d] mx-auto flex items-center justify-center mb-3 border border-slate-200">
          <Lock className="w-6 h-6" />
        </div>

        <h2 className="text-base font-bold text-slate-900">Workstation Locked</h2>
        <p className="text-xs text-slate-500 mt-1">
          {settings.appName}
        </p>

        <div className="mt-4 p-2.5 bg-slate-50 rounded border border-slate-200 text-left">
          <div className="text-xs font-semibold text-slate-800">{currentUser.full_name}</div>
          <div className="text-[11px] text-teal-700">{currentUser.role}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">@{currentUser.username}</div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 text-left">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Enter password to resume
          </label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Account password"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-700"
          />

          {error && (
            <p className="text-[11px] text-rose-600 font-medium mt-1.5">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 py-2 px-3 bg-[#0f3a5d] hover:bg-[#164a75] text-white text-xs font-semibold rounded transition-colors"
            >
              Unlock Workstation
            </button>
            <button
              type="button"
              onClick={logout}
              className="py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded flex items-center justify-center transition-colors"
              title="Sign Out completely"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
