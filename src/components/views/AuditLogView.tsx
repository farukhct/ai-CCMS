import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { auditRepo, AuditFilter } from '../../database/repositories/auditRepo';
import { AuditLogRecord } from '../../types';
import { formatTimestampDisplay } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { Pagination } from '../common/Pagination';
import {
  History,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  FileDown,
  ShieldCheck,
  X
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { settings, hasPermission } = useApp();

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadLogs = useCallback(() => {
    const res = auditRepo.getAll({
      search: searchTerm,
      actionType: actionFilter || undefined,
      page,
      pageSize
    });
    setLogs(res.data);
    setTotal(res.total);
  }, [searchTerm, actionFilter, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const exportCols: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Timestamp', key: 'timestamp', width: 22, align: 'center' },
    { header: 'User', key: 'username', width: 16 },
    { header: 'Action Type', key: 'action_type', width: 18 },
    { header: 'Entity', key: 'entity_name', width: 16 },
    { header: 'Record ID', key: 'entity_id', width: 12, align: 'center' },
    { header: 'Summary', key: 'summary', width: 36 }
  ];

  const handleExport = (type: 'excel' | 'word' | 'pdf') => {
    const fullRes = auditRepo.getAll({
      search: searchTerm,
      actionType: actionFilter || undefined,
      page: 1,
      pageSize: 5000
    });

    const formattedRows = fullRes.data.map(l => ({
      ...l,
      timestamp: formatTimestampDisplay(l.timestamp),
      entity_id: l.entity_id || '-'
    }));

    const opts = {
      title: 'System Security & Audit Trail Register',
      settings,
      columns: exportCols,
      rows: formattedRows,
      orientation: 'landscape' as const
    };
    if (type === 'excel') exportToExcel(opts);
    if (type === 'word') exportToDocx(opts);
    if (type === 'pdf') exportToPdf(opts);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE')) return <span className="text-teal-800 font-semibold">{action}</span>;
    if (action.includes('UPDATE')) return <span className="text-sky-800 font-semibold">{action}</span>;
    if (action.includes('DELETE')) return <span className="text-rose-800 font-semibold">{action}</span>;
    if (action.includes('LOGIN')) return <span className="text-indigo-800 font-semibold">{action}</span>;
    if (action.includes('BACKUP') || action.includes('RESTORE')) return <span className="text-amber-800 font-semibold">{action}</span>;
    return <span className="text-slate-800 font-semibold">{action}</span>;
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-[#0f3a5d]" />
            Official Security & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident record of user authentications, data insertions, modifications, and exports (<strong className="font-mono text-slate-800">{total}</strong> total logs)
          </p>
        </div>

        {hasPermission('export_reports') && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport('excel')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              Excel
            </button>
            <button
              onClick={() => handleExport('word')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-sky-700" />
              Word
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-700" />
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter Box */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search audit summaries, user identifiers..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
        >
          <option value="">All Action Types</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="CREATE_RECORD">CREATE_RECORD</option>
          <option value="UPDATE_RECORD">UPDATE_RECORD</option>
          <option value="DELETE_RECORD">DELETE_RECORD</option>
          <option value="CSV_IMPORT">CSV_IMPORT</option>
          <option value="REPORT_EXPORT">REPORT_EXPORT</option>
          <option value="DB_BACKUP">DB_BACKUP</option>
          <option value="DB_RESTORE">DB_RESTORE</option>
          <option value="USER_MANAGEMENT">USER_MANAGEMENT</option>
          <option value="SETTINGS_CHANGE">SETTINGS_CHANGE</option>
        </select>

        {(searchTerm || actionFilter) && (
          <button
            onClick={() => { setSearchTerm(''); setActionFilter(''); setPage(1); }}
            className="px-2 py-1 text-rose-700 hover:bg-rose-50 rounded font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f3a5d] text-white font-semibold">
                <th className="py-2.5 px-3 w-12 text-center">ID</th>
                <th className="py-2.5 px-3 font-mono">Timestamp</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3 text-center">Entity ID</th>
                <th className="py-2.5 px-3">Summary Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No audit records found matching active filter.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {log.id}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 text-[11px]">
                      {formatTimestampDisplay(log.timestamp)}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      @{log.username}
                    </td>
                    <td className="py-2 px-3">
                      {getActionBadge(log.action_type)}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {log.entity_name}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-500">
                      {log.entity_id || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">
                      {log.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalRecords={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={newSize => { setPageSize(newSize); setPage(1); }}
        />
      </div>
    </div>
  );
};
