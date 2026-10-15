import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { disbursementRepo, DisbursementFilter } from '../../database/repositories/disbursementRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DisbursementRecord } from '../../types';
import { toDisplayDate } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { Pagination } from '../common/Pagination';
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  FileDown,
  Edit2,
  Trash2,
  X,
  Coins
} from 'lucide-react';

export const DisbursementEntryView: React.FC = () => {
  const {
    openDisbursementModal,
    showConfirm,
    addToast,
    hasPermission,
    settings,
    currentUser,
    dataVersion
  } = useApp();

  const [records, setRecords] = useState<DisbursementRecord[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize || 20);
  const [sortBy, setSortBy] = useState<DisbursementFilter['sortBy']>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const loadData = useCallback(() => {
    const res = disbursementRepo.getAll({
      search: searchTerm,
      status: statusFilter || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder
    });
    setRecords(res.data);
    setTotal(res.total);
  }, [searchTerm, statusFilter, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  const handleDelete = (record: DisbursementRecord) => {
    if (!hasPermission('delete_records')) {
      addToast('Permission denied: You cannot delete records.', 'error');
      return;
    }

    showConfirm({
      title: 'Delete Disbursement Record?',
      message: `Are you sure you want to permanently delete Disbursement Record #${record.id} (${record.receiver_name || 'No Receiver'})? This action will be audited.`,
      confirmLabel: 'Delete Record',
      isDestructive: true,
      onConfirm: () => {
        const ok = disbursementRepo.delete(record.id);
        if (ok) {
          auditRepo.log('DELETE_RECORD', 'Disbursements', record.id, `Deleted Disbursement #${record.id} (${record.receiver_name || 'No Receiver'})`, currentUser || undefined);
          addToast('Disbursement deleted successfully.', 'success');
          loadData();
        } else {
          addToast('Failed to delete disbursement.', 'error');
        }
      }
    });
  };

  const exportColumns: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Case Number', key: 'case_number', width: 16 },
    { header: 'Donation Name', key: 'donation_name', width: 24 },
    { header: 'Amount', key: 'donation_amount', width: 16, align: 'right', isAmount: true },
    { header: 'Receiver Name', key: 'receiver_name', width: 20 },
    { header: 'Receiver Phone', key: 'receiver_phone', width: 16 },
    { header: 'Disbursement Date', key: 'receiving_date', width: 16, align: 'center', isDate: true },
    { header: 'Judgement Date', key: 'judgement_date', width: 16, align: 'center', isDate: true },
    { header: 'Status', key: 'status', width: 14, align: 'center' },
    { header: 'Remarks', key: 'remarks', width: 20 }
  ];

  const handleExportExcel = () => {
    const fullRes = disbursementRepo.getAll({
      search: searchTerm,
      status: statusFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToExcel({
      title: 'Disbursement Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Disbursements', null, 'Exported Disbursement Register to Excel (.xlsx)', currentUser || undefined);
    addToast('Excel export initiated.', 'success');
  };

  const handleExportWord = () => {
    const fullRes = disbursementRepo.getAll({
      search: searchTerm,
      status: statusFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToDocx({
      title: 'Disbursement Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Disbursements', null, 'Exported Disbursement Register to Word (.docx)', currentUser || undefined);
    addToast('Word (.docx) export initiated.', 'success');
  };

  const handleExportPdf = () => {
    const fullRes = disbursementRepo.getAll({
      search: searchTerm,
      status: statusFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToPdf({
      title: 'Disbursement Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Disbursements', null, 'Exported Disbursement Register to PDF', currentUser || undefined);
    addToast('PDF export generated.', 'success');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered':
        return <span className="text-emerald-800 font-semibold">Delivered</span>;
      case 'Received':
        return <span className="text-amber-800 font-semibold">Received</span>;
      case 'Problem':
        return <span className="text-rose-800 font-semibold">Problem</span>;
      case 'Hold':
        return <span className="text-purple-800 font-semibold">Hold</span>;
      default:
        return <span className="text-sky-800 font-semibold">New Entry</span>;
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Title & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Donation Disbursement Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Beneficiary disbursement and release authorizations (<strong className="font-mono text-slate-700">{total}</strong> total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('export_reports') && (
            <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Export as Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Excel
              </button>
              <button
                onClick={handleExportWord}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Export as Word (.docx)"
              >
                <FileText className="w-3.5 h-3.5 text-sky-700" />
                Word
              </button>
              <button
                onClick={handleExportPdf}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Export as PDF"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-700" />
                PDF
              </button>
            </div>
          )}

          {hasPermission('create_records') && (
            <button
              onClick={() => openDisbursementModal()}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Disbursement
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search Serial, Case Number, Receiver Name, Phone, Remarks..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setPage(1); }}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            <option value="">All Statuses</option>
            <option value="New Entry">New Entry</option>
            <option value="Received">Received</option>
            <option value="Delivered">Delivered</option>
            <option value="Problem">Problem</option>
            <option value="Hold">Hold</option>
          </select>
        </div>

        {/* Clear Filters */}
        {(searchTerm || statusFilter) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 rounded font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f3a5d] text-white font-semibold">
                <th className="py-2.5 px-3 text-center w-12">ID</th>
                <th className="py-2.5 px-3">Serial No</th>
                <th className="py-2.5 px-3">Case Number</th>
                <th className="py-2.5 px-3">Donation Name</th>
                <th className="py-2.5 px-3 text-right">Amount ({settings.currencySymbol})</th>
                <th className="py-2.5 px-3">Receiver Name</th>
                <th className="py-2.5 px-3 font-mono">Receiver Phone</th>
                <th className="py-2.5 px-3 text-center">Disbursement Date</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    No disbursement records found. Click "+ New Disbursement" or import records.
                  </td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {rec.id}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">
                      {rec.serial_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-900">
                      {rec.case_number || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-800">
                      {rec.donation_name || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {rec.donation_amount !== null && rec.donation_amount !== undefined
                        ? rec.donation_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {rec.receiver_name || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800">
                      {rec.receiver_phone || '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700">
                      {toDisplayDate(rec.receiving_date)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate" title={rec.remarks}>
                      {rec.remarks || '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('edit_records') && (
                          <button
                            onClick={() => openDisbursementModal(rec.id)}
                            className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-slate-100 rounded transition-colors"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('delete_records') && (
                          <button
                            onClick={() => handleDelete(rec)}
                            className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
