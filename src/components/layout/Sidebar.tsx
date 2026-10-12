import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveNavTab } from '../../types';
import {
  LayoutDashboard,
  FilePlus,
  Coins,
  Receipt,
  Layers,
  Search,
  FileText,
  Upload,
  Database,
  Users,
  Settings,
  History,
  HelpCircle,
  LogOut
} from 'lucide-react';

interface NavItem {
  id: ActiveNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    hasPermission,
    logout
  } = useApp();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'applications', label: 'Application Entry', icon: FilePlus },
    { id: 'donations', label: 'Donation Entry', icon: Coins },
    { id: 'disbursements', label: 'Donation Disbursement', icon: Receipt },
    { id: 'all_records', label: 'All Records', icon: Layers },
    { id: 'search', label: 'Search & Filter', icon: Search },
    { id: 'reports', label: 'Reports & Printing', icon: FileText, permission: 'view_records' },
    { id: 'import', label: 'Import Data', icon: Upload, permission: 'import_records' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, permission: 'backup_database' },
    { id: 'users', label: 'User Management', icon: Users, permission: 'manage_users' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'change_settings' },
    { id: 'audit', label: 'Audit Log', icon: History, permission: 'view_audit_logs' },
    { id: 'help', label: 'Help & User Guide', icon: HelpCircle }
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-200 shrink-0 select-none ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map(item => {
          if (item.permission && !hasPermission(item.permission as any)) {
            return null;
          }

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap text-left ${
                isActive
                  ? 'bg-teal-700 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Logout Item */}
      <div className="p-2 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-950/40 hover:text-rose-100 rounded transition-colors text-left"
          title={isSidebarCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          {!isSidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
