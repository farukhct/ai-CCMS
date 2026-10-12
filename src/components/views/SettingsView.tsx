import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AppSettings } from '../../types';
import { checkIntegrity } from '../../database/engine';
import {
  Settings,
  Building2,
  Sliders,
  Shield,
  HardDrive,
  Save,
  RotateCcw,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, addToast, showConfirm, reseedData } = useApp();

  const [form, setForm] = useState<AppSettings>(() => ({ ...settings }));
  const [hasChanges, setHasChanges] = useState(false);
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasChanges) {
      setForm({ ...settings });
    }
  }, [settings, hasChanges]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
    setHasChanges(false);
  };

  const handleResetDefaults = () => {
    showConfirm({
      title: 'Restore Default Settings?',
      message: 'This will reset all application preferences, organization banners, and timeout rules back to their initial factory settings.',
      confirmLabel: 'Restore Defaults',
      isDestructive: true,
      onConfirm: () => {
        const defaults: Partial<AppSettings> = {
          appName: 'Company Court Management System (CCMS)',
          appSubtitle: 'High Court Division & Company Court Administration',
          orgName: 'Company Court Administrative Wing',
          orgAddress: 'Supreme Court Building, Dhaka-1000',
          orgContactPhone: '+880 2-9562858',
          orgContactEmail: 'companycourt@judiciary.gov.bd',
          currencyCode: 'BDT',
          currencySymbol: '৳',
          decimalPrecision: 2,
          dateFormat: 'DD-MM-YYYY',
          defaultPageSize: 20,
          sessionTimeoutMinutes: 30,
          tableDensity: 'comfortable',
          defaultOrientation: 'landscape',
          defaultExportDirectory: 'C:\\CCMS_Exports',
          backupReminderDays: 7,
          duplicateWarningPolicy: 'warn',
          requireConfirmBlank: true
        };
        setForm(prev => ({ ...prev, ...defaults }));
        updateSettings(defaults);
        setHasChanges(false);
        addToast('Default settings restored.', 'info');
      }
    });
  };

  const handleRunIntegrity = () => {
    const res = checkIntegrity();
    setIntegrityMessage(res);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0f3a5d]" />
            Application Configuration & Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure judicial authority headers, regional currency, density, and security policies (persisted in SQLite)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-700 font-medium px-2 py-1 bg-amber-50 border border-amber-200 rounded">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              showConfirm({
                title: 'Reload Sample Court Records?',
                message: 'This will reset and re-seed 8 authentic Company Court applications, 7 donation decree funds, and 12 disbursement records.',
                confirmLabel: 'Reload Sample Data',
                onConfirm: () => {
                  reseedData();
                }
              });
            }}
            className="px-3 py-1.5 border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Sample Data
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Organization & Court Authority */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Judicial Authority & Court Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Court Authority / Wing Name
              </label>
              <input
                type="text"
                value={form.orgName}
                onChange={e => handleChange('orgName', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Division / Subtitle
              </label>
              <input
                type="text"
                value={form.appSubtitle}
                onChange={e => handleChange('appSubtitle', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Official Address
              </label>
              <input
                type="text"
                value={form.orgAddress}
                onChange={e => handleChange('orgAddress', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={form.orgContactPhone}
                onChange={e => handleChange('orgContactPhone', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={form.orgContactEmail}
                onChange={e => handleChange('orgContactEmail', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Regional, Currency, & Date Formatting */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-sky-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Regional Formatting & UI Display Standards
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={form.currencySymbol}
                onChange={e => handleChange('currencySymbol', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Currency Code
              </label>
              <input
                type="text"
                value={form.currencyCode}
                onChange={e => handleChange('currencyCode', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Decimal Precision
              </label>
              <select
                value={form.decimalPrecision}
                onChange={e => handleChange('decimalPrecision', parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
              >
                <option value={0}>0 (Whole units)</option>
                <option value={2}>2 (Standard Minor Units: .00)</option>
                <option value={4}>4 (Precision: .0000)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Date Display Format
              </label>
              <input
                type="text"
                disabled
                value="dd-MM-yyyy (Mandatory)"
                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded text-slate-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Table Density
              </label>
              <select
                value={form.tableDensity}
                onChange={e => handleChange('tableDensity', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact (High Density)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Page Size
              </label>
              <select
                value={form.defaultPageSize}
                onChange={e => handleChange('defaultPageSize', parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono"
              >
                <option value={10}>10 records</option>
                <option value={20}>20 records</option>
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Report Orientation
              </label>
              <select
                value={form.defaultOrientation}
                onChange={e => handleChange('defaultOrientation', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Security & Session Rules */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Shield className="w-4 h-4 text-rose-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Security, Session Lock & Data Invariants
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Inactivity Lock (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={form.sessionTimeoutMinutes}
                onChange={e => handleChange('sessionTimeoutMinutes', parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">0 disables auto-locking</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Duplicate Warning Policy
              </label>
              <select
                value={form.duplicateWarningPolicy}
                onChange={e => handleChange('duplicateWarningPolicy', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
              >
                <option value="warn">Warn on Duplicate (Recommended)</option>
                <option value="block">Block Duplicate Records</option>
                <option value="allow">Allow Silently</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Confirm Blank Records
              </label>
              <select
                value={form.requireConfirmBlank ? '1' : '0'}
                onChange={e => handleChange('requireConfirmBlank', e.target.value === '1')}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
              >
                <option value="1">Show Confirmation Dialog (Prompt)</option>
                <option value="0">Save Immediately Without Prompt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Local Storage & Maintenance */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Local Database & Storage Diagnostics
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRunIntegrity}
              className="text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Integrity
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono space-y-1">
            <div className="text-slate-600">Database Engine: SQLite 3 (sql.js / WebAssembly)</div>
            <div className="text-slate-600">Storage Target: Local Application Data Directory / ccms.db</div>
            <div className="text-slate-600">Mode: 100% Offline (No Cloud or Remote Access)</div>
            {integrityMessage && (
              <div className="text-emerald-700 font-bold mt-1">
                Integrity Result: {integrityMessage}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
