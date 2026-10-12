import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, User, CheckCircle2 } from 'lucide-react';
import { formatCurrentDateDDMMYYYY } from '../../services/dateUtils';

export const LoginView: React.FC = () => {
  const { login, settings } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = login(username.trim(), password);
      if (!result.success) {
        setError(result.error || 'Authentication failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between selection:bg-[#0f3a5d] selection:text-white">
      {/* Government Top Bar */}
      <div className="bg-[#0f3a5d] text-white py-3 px-6 border-b border-slate-700/80 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-teal-600 flex items-center justify-center font-bold text-xs text-white">
            C
          </div>
          <span className="font-semibold tracking-wide">{settings.appName}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
          <span>Official Court Portal</span>
          <span>·</span>
          <span className="font-mono tabular-nums">{formatCurrentDateDDMMYYYY()}</span>
        </div>
      </div>

      {/* Main Centered Authentication Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          {/* Card Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 text-center">
            <div className="w-12 h-12 rounded-full bg-[#0f3a5d]/10 text-[#0f3a5d] mx-auto flex items-center justify-center mb-2.5 border border-[#0f3a5d]/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {settings.orgName}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Authorized Personnel System Sign-In
            </p>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <span className="font-bold shrink-0">Error:</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  User ID / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter assigned username"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f3a5d] focus:border-[#0f3a5d]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f3a5d] focus:border-[#0f3a5d]"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#0f3a5d] hover:bg-[#164a75] disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Sign In to CCMS Workstation
                </button>
              </div>
            </form>

            {/* Quick Demo Sign-in Section */}
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                One-Click Role Authentication
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('admin123');
                    login('admin', 'admin123');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded text-[11px] font-medium text-slate-700 text-center transition-colors cursor-pointer"
                >
                  <div className="font-bold text-teal-800">Super Admin</div>
                  <div className="text-[10px] text-slate-400 font-mono">admin</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('operator');
                    setPassword('operator123');
                    login('operator', 'operator123');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded text-[11px] font-medium text-slate-700 text-center transition-colors cursor-pointer"
                >
                  <div className="font-bold text-sky-800">Operator</div>
                  <div className="text-[10px] text-slate-400 font-mono">operator</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('reviewer');
                    setPassword('reviewer123');
                    login('reviewer', 'reviewer123');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded text-[11px] font-medium text-slate-700 text-center transition-colors cursor-pointer"
                >
                  <div className="font-bold text-indigo-800">Reviewer</div>
                  <div className="text-[10px] text-slate-400 font-mono">reviewer</div>
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-teal-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Local Offline Database Connected
              </span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-200/80 border-t border-slate-300 py-2.5 px-6 text-center text-xs text-slate-600">
        <p>
          Restricted Government System · Unauthorized access is prohibited by law · Database: <span className="font-mono text-slate-700">ccms.db</span>
        </p>
      </div>
    </div>
  );
};
