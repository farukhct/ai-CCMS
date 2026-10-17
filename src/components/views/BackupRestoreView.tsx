import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { backupService } from '../../services/backupService';
import { checkIntegrity, TableStatInfo } from '../../database/engine';
import { auditRepo } from '../../database/repositories/auditRepo';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  AlertOctagon,
  Layers,
  FileSpreadsheet,
  Users,
  Coins,
  Receipt,
  FileText,
  CreditCard,
  History,
  CheckSquare,
  Square,
  ShieldAlert,
  Info,
  RotateCcw
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const {
    addToast,
    hasPermission,
    currentUser,
    refreshUsersCheck,
    refreshData,
    openFactoryResetModal
  } = useApp();

  // Backup & Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Table Deletion Facility states
  const [tableStats, setTableStats] = useState<TableStatInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [resetSequences, setResetSequences] = useState(true);
  const [preserveAdminUser, setPreserveAdminUser] = useState(true);

  // Confirmation Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load manifest and table stats
  const manifest = backupService.getManifest();

  useEffect(() => {
    const stats = backupService.getTableStatistics();
    setTableStats(stats);
  }, [refreshKey]);

  const handleRefreshStats = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleRunIntegrityCheck = () => {
    const result = checkIntegrity();
    setIntegrityStatus(result);
    if (result === 'ok') {
      addToast('Database integrity check passed (PRAGMA integrity_check: ok)', 'success');
    } else {
      addToast(`Integrity check issues found: ${result}`, 'error');
    }
  };

  const handleDownloadBackup = () => {
    if (!hasPermission('backup_database')) {
      addToast('Permission denied: You do not have backup permissions.', 'error');
      return;
    }

    try {
      const res = backupService.createBackup();
      auditRepo.log('DB_BACKUP', 'Database', null, `Created database backup snapshot (${res.filename})`, currentUser || undefined);
      addToast(`Backup created and downloaded successfully: ${res.filename}`, 'success');
      handleRefreshStats();
    } catch (err: any) {
      addToast(err.message || 'Error creating database backup.', 'error');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      addToast('Please select a valid SQLite .db backup file first.', 'warning');
      return;
    }

    if (!hasPermission('restore_database')) {
      addToast('Permission denied: Only authorized administrators can restore databases.', 'error');
      return;
    }

    setIsRestoring(true);
    try {
      const res = await backupService.restoreBackup(restoreFile);
      if (res.success) {
        auditRepo.log('DB_RESTORE', 'Database', null, `Restored database from file "${restoreFile.name}"`, currentUser || undefined);
        addToast('Database successfully restored and verified.', 'success');
        refreshUsersCheck();
        refreshData();
        setRestoreFile(null);
        handleRefreshStats();
      } else {
        addToast(res.message, 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to restore database.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // Toggle table selection
  const toggleTableSelection = (tableName: string) => {
    setSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  // Quick preset selections
  const handleSelectOperational = () => {
    setSelectedTables(['Applications', 'Donations', 'PayOrders', 'Disbursements']);
  };

  const handleSelectAllTables = () => {
    setSelectedTables(tableStats.map(t => t.name));
  };

  const handleDeselectAll = () => {
    setSelectedTables([]);
  };

  // Total records across chosen tables
  const totalSelectedRecords = tableStats
    .filter(t => selectedTables.includes(t.name))
    .reduce((sum, t) => sum + t.count, 0);

  // Open confirmation message dialog
  const handleOpenDeleteConfirm = () => {
    if (selectedTables.length === 0) {
      addToast('Please select at least one database table to delete.', 'warning');
      return;
    }

    if (!hasPermission('delete_records')) {
      addToast('Permission denied: Administrative delete permissions required.', 'error');
      return;
    }

    setAcknowledgedWarning(false);
    setIsConfirmModalOpen(true);
  };

  // Execute deletion upon confirmation
  const handleExecuteDelete = () => {
    if (!acknowledgedWarning) {
      addToast('Please acknowledge the confirmation checkbox to proceed.', 'warning');
      return;
    }

    setIsDeleting(true);
    try {
      const result = backupService.purgeTableData(selectedTables, {
        createSafetyBackup,
        preserveCurrentUser: preserveAdminUser,
        currentUserId: currentUser?.id,
        resetSequences,
        user: currentUser
      });

      const tableBreakdown = Object.entries(result.deletedCounts)
        .map(([tbl, cnt]) => `${tbl} (${cnt})`)
        .join(', ');

      let message = `Database deletion complete: Successfully removed ${result.totalDeleted} record(s) across ${selectedTables.length} table(s): ${tableBreakdown}.`;
      if (result.backupFilename) {
        message += ` Safety snapshot saved as ${result.backupFilename}.`;
      }

      addToast(message, 'success');
      setSelectedTables([]);
      setIsConfirmModalOpen(false);
      handleRefreshStats();
      refreshUsersCheck();
    } catch (err: any) {
      addToast(`Deletion failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to render table icon
  const renderTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'Applications':
        return <Layers className="w-4 h-4 text-teal-600" />;
      case 'Donations':
        return <Coins className="w-4 h-4 text-amber-600" />;
      case 'PayOrders':
        return <CreditCard className="w-4 h-4 text-indigo-600" />;
      case 'Disbursements':
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case 'AuditLogs':
        return <History className="w-4 h-4 text-purple-600" />;
      case 'ImportJobs':
        return <FileSpreadsheet className="w-4 h-4 text-sky-600" />;
      case 'Users':
        return <Users className="w-4 h-4 text-rose-600" />;
      default:
        return <Database className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0f3a5d]" />
            Database Backup, Restoration & Maintenance Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create verified SQLite binary snapshots (<span className="font-mono text-slate-700">ccms.db</span>), restore safe states, and selectively manage database tables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshStats}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            Refresh Statistics
          </button>
          <button
            onClick={handleRunIntegrityCheck}
            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
            Run PRAGMA Integrity Check
          </button>
        </div>
      </div>

      {integrityStatus && (
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
          integrityStatus === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {integrityStatus === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>
            Database State: <strong>{integrityStatus === 'ok' ? 'Healthy and Consistent (Integrity Verified)' : integrityStatus}</strong>
          </span>
        </div>
      )}

      {/* Grid: Backup & Restore Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Panel */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded bg-teal-50 text-teal-700">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Generate On-Demand Backup
              </h2>
              <p className="text-[11px] text-slate-500">
                Exports genuine binary SQLite <code className="font-mono text-teal-800">.db</code> file with metadata manifest
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2 font-mono text-[11px]">
            <div className="text-slate-500 font-sans font-semibold uppercase text-[10px]">
              Current Database Snapshot Statistics:
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Applications:</span>
              <span className="font-bold text-slate-900">{manifest.recordCounts.applications}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Donations:</span>
              <span className="font-bold text-slate-900">{manifest.recordCounts.donations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Pay Orders:</span>
              <span className="font-bold text-slate-900">{manifest.recordCounts.payOrders || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Disbursements:</span>
              <span className="font-bold text-slate-900">{manifest.recordCounts.disbursements}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Audit Logs:</span>
              <span className="font-bold text-slate-900">{manifest.recordCounts.auditLogs}</span>
            </div>
          </div>

          <p className="text-slate-600 leading-relaxed text-[11px]">
            Backups are created fully offline using SQLite's online serialization mechanism, guaranteeing atomic consistency with zero network dependencies.
          </p>

          <button
            onClick={handleDownloadBackup}
            className="w-full py-2.5 px-4 bg-[#0f3a5d] hover:bg-[#164a75] text-white font-semibold rounded text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Complete Database Snapshot (.db + JSON)
          </button>
        </div>

        {/* Restore Panel */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded bg-amber-50 text-amber-700">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Restore Database from Backup
              </h2>
              <p className="text-[11px] text-slate-500">
                Restores CCMS data from an authentic <code className="font-mono text-amber-800">.db</code> SQLite file
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded text-amber-900 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1 text-amber-800">
              <ShieldCheck className="w-4 h-4" />
              Safety Verification Protocols
            </div>
            <p>
              Before applying the restore, CCMS validates table structures and executes an internal safety snapshot so you can rollback if corrupted.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select SQLite Database File (.db)
            </label>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={e => setRestoreFile(e.target.files?.[0] || null)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-700 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>

          <button
            onClick={handleRestore}
            disabled={!restoreFile || isRestoring}
            className="w-full py-2.5 px-4 bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white font-semibold rounded text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {isRestoring ? 'Verifying & Restoring...' : 'Validate & Execute Database Restoration'}
          </button>
        </div>
      </div>

      {/* SECTION 3: Database Table Deletion & Purge Facility */}
      <div className="bg-white rounded-lg border border-rose-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-rose-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded bg-rose-50 text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Database Table Deletion & Selective Data Purge Facility
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 uppercase tracking-wide">
                Administrative
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Selectively delete records from individual database tables. Choose which tables of data you wish to delete below.
              Every operation requires an explicit confirmation message, and CCMS can automatically generate a safety backup file prior to deleting.
            </p>
          </div>

          {/* Quick Selection Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectOperational}
              className="px-2.5 py-1.5 border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              Select Operational Data (Apps + Donations + Disbursements)
            </button>
            <button
              type="button"
              onClick={handleSelectAllTables}
              className="px-2.5 py-1.5 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              Select All Tables
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Table Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tableStats.map(table => {
            const isSelected = selectedTables.includes(table.name);
            const isEmpty = table.count === 0;

            return (
              <div
                key={table.name}
                onClick={() => toggleTableSelection(table.name)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isSelected
                    ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-slate-700">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {renderTableIcon(table.name)}
                        <span className="font-bold text-xs text-slate-900">
                          {table.displayName}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                        isEmpty
                          ? 'bg-slate-100 text-slate-500'
                          : isSelected
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-teal-50 text-teal-800'
                      }`}
                    >
                      {table.count} {table.count === 1 ? 'row' : 'rows'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                    {table.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Table: {table.name}</span>
                  {table.name === 'Users' ? (
                    <span className="text-emerald-700 font-medium">Session safeguarded</span>
                  ) : table.name === 'Applications' ? (
                    <span className="text-amber-700 font-medium">Unlinks downstream donations</span>
                  ) : table.name === 'Donations' ? (
                    <span className="text-amber-700 font-medium">Unlinks downstream disbursements</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Protection & Safety Options */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs pb-1 border-b border-slate-200">
            <ShieldAlert className="w-4 h-4 text-teal-700" />
            Safety Options & Deletion Policy
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createSafetyBackup}
                onChange={e => setCreateSafetyBackup(e.target.checked)}
                className="rounded border-slate-300 text-[#0f3a5d] focus:ring-[#0f3a5d]"
              />
              <span className="text-slate-700 text-xs">
                Download safety backup (.db) before delete (Recommended)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetSequences}
                onChange={e => setResetSequences(e.target.checked)}
                className="rounded border-slate-300 text-[#0f3a5d] focus:ring-[#0f3a5d]"
              />
              <span className="text-slate-700 text-xs">
                Reset auto-increment ID counters back to 1
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveAdminUser}
                onChange={e => setPreserveAdminUser(e.target.checked)}
                className="rounded border-slate-300 text-[#0f3a5d] focus:ring-[#0f3a5d]"
              />
              <span className="text-slate-700 text-xs">
                Safeguard active admin account if Users table is cleared
              </span>
            </label>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-600">
            {selectedTables.length === 0 ? (
              <span className="text-slate-500">No tables chosen. Select one or more tables above to delete.</span>
            ) : (
              <span>
                Selected: <strong className="text-slate-900">{selectedTables.length}</strong> table(s) | Total records to delete: <strong className="text-rose-700">{totalSelectedRecords}</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenDeleteConfirm}
            disabled={selectedTables.length === 0}
            className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected Tables ({totalSelectedRecords} records)...
          </button>
        </div>
      </div>

      {/* SECTION 4: Application Factory Reset Facility */}
      <div className="bg-white rounded-lg border border-red-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-red-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded bg-red-100 text-red-700">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Application Factory Reset Facility
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 uppercase tracking-wide">
                Super Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Restore the entire application to its original factory specifications. You can wipe all court records for a clean production start (0 records), reload official sample court decrees and cases, or perform a complete out-of-the-box fresh install that restarts the First-Run Setup Wizard.
            </p>
          </div>

          <button
            type="button"
            onClick={openFactoryResetModal}
            className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Open Factory Reset Facility...
          </button>
        </div>
        <div className="bg-red-50/60 border border-red-200 rounded p-3 text-xs text-red-900 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            Requires typing <strong>"FACTORY RESET"</strong> to confirm execution. An automated downloadable SQLite safety snapshot (.db) is created before resetting.
          </span>
        </div>
      </div>

      {/* CONFIRMATION MESSAGE MODAL DIALOG */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-lg w-full p-6 overflow-hidden animate-in zoom-in-95 duration-150 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Database Table Deletion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please review the chosen tables and confirm before permanent deletion
                </p>
              </div>
            </div>

            {/* Warning Message Box */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Permanent Data Removal Notice
              </div>
              <p className="leading-relaxed">
                You have chosen to delete data from <strong>{selectedTables.length} database table(s)</strong>.
                This action will permanently delete <strong>{totalSelectedRecords} records</strong> from the local SQLite storage.
                This cannot be reversed without restoring a previous backup file.
              </p>
            </div>

            {/* Selected Tables Breakdown */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 flex justify-between">
                <span>Table to be Purged</span>
                <span>Records to be Deleted</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {tableStats
                  .filter(t => selectedTables.includes(t.name))
                  .map(t => (
                    <div key={t.name} className="px-3 py-2 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-2">
                        {renderTableIcon(t.name)}
                        <div>
                          <div className="font-medium text-slate-900">{t.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.name}</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-rose-700 px-2 py-0.5 bg-rose-50 rounded">
                        {t.count} records
                      </span>
                    </div>
                  ))}
              </div>
              <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total Impact:</span>
                <span className="text-rose-700 font-mono">{totalSelectedRecords} records</span>
              </div>
            </div>

            {/* Safeguards Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-teal-700" />
                Execution Safeguards:
              </div>
              {createSafetyBackup ? (
                <div className="text-emerald-700">
                  ✓ CCMS will download an automatic binary safety backup (.db) to your browser before deletion.
                </div>
              ) : (
                <div className="text-amber-700">
                  ⚠ Automated safety backup is turned off.
                </div>
              )}
              {selectedTables.includes('Users') && preserveAdminUser && (
                <div className="text-slate-600">
                  ✓ Current administrator account is protected to prevent administrative lockout.
                </div>
              )}
              {resetSequences && (
                <div className="text-slate-600">
                  ✓ Auto-increment sequence numbering will be reset to 1 for purged tables.
                </div>
              )}
            </div>

            {/* Confirmation Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-300 bg-amber-50/50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledgedWarning}
                  onChange={e => setAcknowledgedWarning(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-rose-700 focus:ring-rose-700"
                />
                <span className="text-xs font-semibold text-slate-900">
                  I understand that this action will permanently delete the selected database records and cannot be undone.
                </span>
              </label>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel & Keep Records
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={!acknowledgedWarning || isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting Selected Tables...' : 'Yes, Permanently Delete Selected Tables'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
