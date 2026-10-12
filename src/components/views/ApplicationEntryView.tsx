import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { applicationRepo, ApplicationFilter } from '../../database/repositories/applicationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { ApplicationRecord } from '../../types';
import { toDisplayDate } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { Pagination } from '../common/Pagination';
import {
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Edit2,
  Trash2,
  X,
  FileDown
} from 'lucide-react';

export const ApplicationEntryView: React.FC = () => {
  const {
    openApplicationModal,
    showConfirm,
    addToast,
    hasPermission,
    settings,
    currentUser
  } = useApp();

  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize || 20);
  const [sortBy, setSortBy] = useState<ApplicationFilter['sortBy']>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const loadData = useCallback(() => {
    const res = applicationRepo.getAll({
      search: searchTerm,
      bankName: bankFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder
    });
    setRecords(res.data);
    setTotal(res.total);
  }, [searchTerm, bankFilter, startDate, endDate, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = (record: ApplicationRecord) => {
    if (!hasPermission('delete_records')) {
      addToast('Permission denied: You cannot delete records.', 'error');
      return;
    }

    showConfirm({
      title: 'Delete Application Record?',
      message: `Are you sure you want to permanently delete Application Record #${record.id} (${record.serial_number || 'No Serial'})? This action will be audited.`,
      confirmLabel: 'Delete Record',
      isDestructive: true,
      onConfirm: () => {
        const ok = applicationRepo.delete(record.id);
        if (ok) {
          auditRepo.log('DELETE_RECORD', 'Applications', record.id, `Deleted Application #${record.id} (${record.serial_number || 'No Serial'})`, currentUser || undefined);
          addToast('Application deleted successfully.', 'success');
          loadData();
        } else {
          addToast('Failed to delete application.', 'error');
        }
      }
    });
  };

  // Export columns definition
  const exportColumns: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Donation Name', key: 'donation_name', width: 26 },
    { header: 'Address', key: 'address', width: 22 },
    { header: 'Phone Number', key: 'phone_number', width: 15 },
    { header: 'Bank Name', key: 'bank_name', width: 18 },
    { header: 'Branch Name', key: 'branch_name', width: 18 },
    { header: 'Bank Account No', key: 'bank_account_number', width: 20 },
    { header: 'Routing No', key: 'routing_number', width: 14 },
    { header: 'Application Date', key: 'application_date', width: 16, align: 'center', isDate: true },
    { header: 'Remarks', key: 'remarks', width: 20 }
  ];

  const handleExportExcel = () => {
    const fullRes = applicationRepo.getAll({
      search: searchTerm,
      bankName: bankFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToExcel({
      title: 'Application Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Applications', null, 'Exported Application Register to Excel (.xlsx)', currentUser || undefined);
    addToast('Excel export initiated.', 'success');
  };

  const handleExportWord = () => {
    const fullRes = applicationRepo.getAll({
      search: searchTerm,
      bankName: bankFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToDocx({
      title: 'Application Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Applications', null, 'Exported Application Register to Word (.docx)', currentUser || undefined);
    addToast('Word (.docx) export initiated.', 'success');
  };

  const handleExportPdf = () => {
    const fullRes = applicationRepo.getAll({
      search: searchTerm,
      bankName: bankFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    exportToPdf({
      title: 'Application Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Applications', null, 'Exported Application Register to PDF', currentUser || undefined);
    addToast('PDF export generated.', 'success');
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Title & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Application Entry Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered corporate and individual court petitions (<strong className="font-mono text-slate-700">{total}</strong> total)
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
              onClick={() => openApplicationModal()}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Application
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
            placeholder="Search Serial, Donation Name, Bank, Phone, Account, Remarks..."
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

        {/* Clear Filters */}
        {(searchTerm || bankFilter) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setBankFilter('');
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
                <th className="py-2.5 px-3">Donation Name</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3 font-mono">Phone</th>
                <th className="py-2.5 px-3">Bank Details</th>
                <th className="py-2.5 px-3 font-mono">Account / Routing</th>
                <th className="py-2.5 px-3 text-center">App Date</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    No application entries found. Click "+ New Application" or use CSV Import to add records.
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
                    <td className="py-2 px-3 font-semibold text-teal-900">
                      {rec.donation_name || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 max-w-[180px] truncate" title={rec.address}>
                      {rec.address || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800">
                      {rec.phone_number || '-'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-slate-800 font-medium">{rec.bank_name || '-'}</div>
                      <div className="text-[10px] text-slate-400">{rec.branch_name || ''}</div>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-800">
                      <div>{rec.bank_account_number || '-'}</div>
                      {rec.routing_number && (
                        <div className="text-[10px] text-slate-400">RT: {rec.routing_number}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700">
                      {toDisplayDate(rec.application_date)}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate" title={rec.remarks}>
                      {rec.remarks || '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('edit_records') && (
                          <button
                            onClick={() => openApplicationModal(rec.id)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
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

        {/* Pagination Bar */}
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
