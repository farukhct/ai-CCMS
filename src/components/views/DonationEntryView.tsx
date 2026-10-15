import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { donationRepo, DonationFilter } from '../../database/repositories/donationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DonationRecord } from '../../types';
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
  Link as LinkIcon,
  Unlink,
  Coins,
  CreditCard
} from 'lucide-react';

export const DonationEntryView: React.FC = () => {
  const {
    openDonationModal,
    openDisbursementModal,
    openPayOrderModal,
    showConfirm,
    addToast,
    hasPermission,
    settings,
    currentUser
  } = useApp();

  const [records, setRecords] = useState<DonationRecord[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize || 20);
  const [sortBy, setSortBy] = useState<DonationFilter['sortBy']>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const loadData = useCallback(() => {
    const isUnlinkedParam = linkFilter === 'linked' ? 0 : linkFilter === 'unlinked' ? 1 : undefined;

    const res = donationRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      isUnlinked: isUnlinkedParam,
      page,
      pageSize,
      sortBy,
      sortOrder
    });
    setRecords(res.data);
    setTotal(res.total);
  }, [searchTerm, caseFilter, linkFilter, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = (record: DonationRecord) => {
    if (!hasPermission('delete_records')) {
      addToast('Permission denied: You cannot delete records.', 'error');
      return;
    }

    showConfirm({
      title: 'Delete Donation Record?',
      message: `Are you sure you want to permanently delete Donation Record #${record.id} (${record.case_number || 'No Case'})? This action will be audited.`,
      confirmLabel: 'Delete Record',
      isDestructive: true,
      onConfirm: () => {
        const ok = donationRepo.delete(record.id);
        if (ok) {
          auditRepo.log('DELETE_RECORD', 'Donations', record.id, `Deleted Donation #${record.id} (${record.case_number || 'No Case'})`, currentUser || undefined);
          addToast('Donation deleted successfully.', 'success');
          loadData();
        } else {
          addToast('Failed to delete donation.', 'error');
        }
      }
    });
  };

  const exportColumns: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Case Number', key: 'case_number', width: 18 },
    { header: 'Donation Name', key: 'donation_name', width: 28 },
    { header: 'Donation Amount', key: 'donation_amount', width: 18, align: 'right', isAmount: true },
    { header: 'Judgement Date', key: 'judgement_date', width: 16, align: 'center', isDate: true },
    { header: 'Link Status', key: 'is_unlinked', width: 14, align: 'center' },
    { header: 'Remarks', key: 'remarks', width: 22 }
  ];

  const handleExportExcel = () => {
    const isUnlinkedParam = linkFilter === 'linked' ? 0 : linkFilter === 'unlinked' ? 1 : undefined;
    const fullRes = donationRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      isUnlinked: isUnlinkedParam,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    const rowsWithStatus = fullRes.data.map(r => ({
      ...r,
      is_unlinked: r.is_unlinked ? 'Unlinked' : `Linked (App #${r.application_id || ''})`
    }));

    exportToExcel({
      title: 'Donation Register',
      settings,
      columns: exportColumns,
      rows: rowsWithStatus,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Donations', null, 'Exported Donation Register to Excel (.xlsx)', currentUser || undefined);
    addToast('Excel export initiated.', 'success');
  };

  const handleExportWord = () => {
    const isUnlinkedParam = linkFilter === 'linked' ? 0 : linkFilter === 'unlinked' ? 1 : undefined;
    const fullRes = donationRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      isUnlinked: isUnlinkedParam,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    const rowsWithStatus = fullRes.data.map(r => ({
      ...r,
      is_unlinked: r.is_unlinked ? 'Unlinked' : `Linked (App #${r.application_id || ''})`
    }));

    exportToDocx({
      title: 'Donation Register',
      settings,
      columns: exportColumns,
      rows: rowsWithStatus,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Donations', null, 'Exported Donation Register to Word (.docx)', currentUser || undefined);
    addToast('Word (.docx) export initiated.', 'success');
  };

  const handleExportPdf = () => {
    const isUnlinkedParam = linkFilter === 'linked' ? 0 : linkFilter === 'unlinked' ? 1 : undefined;
    const fullRes = donationRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      isUnlinked: isUnlinkedParam,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });

    const rowsWithStatus = fullRes.data.map(r => ({
      ...r,
      is_unlinked: r.is_unlinked ? 'Unlinked' : `Linked (App #${r.application_id || ''})`
    }));

    exportToPdf({
      title: 'Donation Register',
      settings,
      columns: exportColumns,
      rows: rowsWithStatus,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'Donations', null, 'Exported Donation Register to PDF', currentUser || undefined);
    addToast('PDF export generated.', 'success');
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Title & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Donation Entry Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Decreed donations with internal relational link to Applications (<strong className="font-mono text-slate-700">{total}</strong> total)
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
              onClick={() => openDonationModal()}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Donation
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
            placeholder="Search Serial, Case Number, Donation Entity, Remarks..."
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

        {/* Link Filter Segmented */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
          <button
            onClick={() => { setLinkFilter('all'); setPage(1); }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              linkFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Links
          </button>
          <button
            onClick={() => { setLinkFilter('linked'); setPage(1); }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              linkFilter === 'linked' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Linked Only
          </button>
          <button
            onClick={() => { setLinkFilter('unlinked'); setPage(1); }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              linkFilter === 'unlinked' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Unlinked
          </button>
        </div>

        {/* Clear Filters */}
        {(searchTerm || linkFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setLinkFilter('all');
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
                <th className="py-2.5 px-3 text-center">Judgement Date</th>
                <th className="py-2.5 px-3 text-center">Application Link</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No donation entries recorded yet. Click "+ New Donation" or import via CSV.
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
                    <td className="py-2 px-3 font-mono font-bold text-sky-900">
                      {rec.case_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {rec.donation_name || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {rec.donation_amount !== null && rec.donation_amount !== undefined
                        ? rec.donation_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700">
                      {toDisplayDate(rec.judgement_date)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {!rec.is_unlinked && rec.application_id ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-teal-800 font-medium">
                          <LinkIcon className="w-3 h-3 text-teal-600" />
                          App #{rec.application_id}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                          <Unlink className="w-3 h-3 text-amber-600" />
                          Unlinked
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[160px] truncate" title={rec.remarks}>
                      {rec.remarks || '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('create_records') && (
                          <>
                            <button
                              onClick={() => openPayOrderModal(undefined, rec.id)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              title="Create Pay Order for this Donation"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDisbursementModal(undefined, rec.id)}
                              className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                              title="Create Disbursement for this Donation"
                            >
                              <Coins className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {hasPermission('edit_records') && (
                          <button
                            onClick={() => openDonationModal(rec.id)}
                            className="p-1 text-slate-500 hover:text-sky-700 hover:bg-slate-100 rounded transition-colors"
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
