import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrentDateDDMMYYYY } from '../../services/dateUtils';
import { Lock, LogOut, Settings as SettingsIcon, Menu, Plus } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    settings,
    logout,
    lockSession,
    setActiveTab,
    toggleSidebar,
    openApplicationModal,
    openDonationModal,
    openDisbursementModal,
    openPayOrderModal,
    hasPermission
  } = useApp();

  const currentDateFormatted = formatCurrentDateDDMMYYYY();

  return (
    <header className="h-14 bg-[#0f3a5d] text-white flex items-center justify-between px-4 border-b border-slate-700/60 shadow-sm shrink-0">
      {/* Left zone: Toggle + Org Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-wide text-white leading-tight">
            {settings.orgName}
          </span>
          <span className="text-[11px] text-slate-300 leading-tight">
            {settings.appSubtitle}
          </span>
        </div>
      </div>

      {/* Center/Right Zone: Quick Actions & User Bar */}
      <div className="flex items-center gap-4 text-xs">
        {/* Quick entry dropdown/buttons */}
        {hasPermission('create_records') && (
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => openApplicationModal()}
              className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Application
            </button>
            <button
              onClick={() => openDonationModal()}
              className="px-2.5 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Donation
            </button>
            <button
              onClick={() => openDisbursementModal()}
              className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Disbursement
            </button>
            <button
              onClick={() => openPayOrderModal()}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Pay Order
            </button>
          </div>
        )}

        {/* Current Date Display */}
        <div className="hidden sm:flex items-center gap-2 text-slate-200">
          <span className="text-slate-400">Date:</span>
          <span className="font-mono tabular-nums text-slate-100 font-medium">
            {currentDateFormatted}
          </span>
        </div>

        <span className="hidden sm:inline text-slate-500">·</span>

        {/* User Info */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col text-right">
              <span className="font-medium text-white leading-none">
                {currentUser.full_name}
              </span>
              <span className="text-[10px] text-teal-300 mt-0.5 leading-none">
                {currentUser.role}
              </span>
            </div>
            <div className="w-7 h-7 rounded bg-teal-800 text-white font-semibold flex items-center justify-center text-xs border border-teal-600">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center gap-1 border-l border-slate-700/60 pl-3">
          <button
            onClick={() => setActiveTab('settings')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={lockSession}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Lock Session"
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-1.5 text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 rounded transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
