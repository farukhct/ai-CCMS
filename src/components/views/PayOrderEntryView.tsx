import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { payOrderRepo, PayOrderFilter } from '../../database/repositories/payOrderRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { PayOrderRecord } from '../../types';
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
  CreditCard,
  Building,
  Link as LinkIcon,
  Unlink
} from 'lucide-react';

export const PayOrderEntryView: React.FC = () => {
  const {
    openPayOrderModal,
    showConfirm,
    addToast,
    hasPermission,
    settings,
    currentUser
  } = useApp();

  const [records, setRecords] = useState<PayOrderRecord[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize || 20);
  const [sortBy, setSortBy] = useState<PayOrderFilter['sortBy']>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const loadData = useCallback(() => {
    const res = payOrderRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      bankName: bankFilter || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder
    });
    setRecords(res.data);
    setTotal(res.total);
  }, [searchTerm, caseFilter, bankFilter, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = (record: PayOrderRecord) => {
    if (!hasPermission('delete_records')) {
      addToast('Permission denied: You cannot delete records.', 'error');
      return;
    }

    showConfirm({
      title: 'Delete Pay Order Record?',
      message: `Are you sure you want to permanently delete Pay Order Record #${record.id} (${record.pay_order_number || record.case_number || 'No Identifier'})? This action will be audited.`,
      confirmLabel: 'Delete Record',
      isDestructive: true,
      onConfirm: () => {
        const ok = payOrderRepo.delete(record.id);
        if (ok) {
          auditRepo.log(
            'DELETE_RECORD',
            'PayOrders',
            record.id,
            `Deleted Pay Order #${record.id} (PO: ${record.pay_order_number || 'N/A'}, Case: ${record.case_number || 'N/A'})`,
            currentUser || undefined
          );
          addToast('Pay Order deleted successfully.', 'success');
          loadData();
        } else {
          addToast('Failed to delete pay order.', 'error');
        }
      }
    });
  };

  const exportColumns: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Case Number', key: 'case_number', width: 16 },
    { header: 'Donation Name', key: 'donation_name', width: 24 },
    { header: 'Pay Order No', key: 'pay_order_number', width: 16 },
    { header: 'PO Date', key: 'po_date', width: 16, align: 'center', isDate: true },
    { header: 'Bank Name', key: 'bank_name', width: 20 },
    { header: 'Branch Name', key: 'branch_name', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 20 }
  ];

  const handleExportExcel = () => {
    const fullRes = payOrderRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      bankName: bankFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });
    exportToExcel({
      title: 'Pay Order Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'PayOrders', null, 'Exported Pay Orders to Excel (XLSX)', currentUser || undefined);
    addToast('Pay Orders exported to Excel successfully.', 'success');
  };

  const handleExportDocx = () => {
    const fullRes = payOrderRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      bankName: bankFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });
    exportToDocx({
      title: 'Pay Order Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'PayOrders', null, 'Exported Pay Orders to Word (DOCX)', currentUser || undefined);
    addToast('Pay Orders exported to Word document successfully.', 'success');
  };

  const handleExportPdf = () => {
    const fullRes = payOrderRepo.getAll({
      search: searchTerm,
      caseNumber: caseFilter || undefined,
      bankName: bankFilter || undefined,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortOrder
    });
    exportToPdf({
      title: 'Pay Order Register',
      settings,
      columns: exportColumns,
      rows: fullRes.data,
      orientation: 'landscape'
    });
    auditRepo.log('REPORT_EXPORT', 'PayOrders', null, 'Exported Pay Orders to PDF', currentUser || undefined);
    addToast('Pay Orders exported to PDF document successfully.', 'success');
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Pay Order Entry & Register
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {total} {total === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Judicial pay order instruments linked to court-decreed Donations and corporate case proceedings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export dropdown/buttons */}
          <div className="flex items-center border border-slate-300 rounded overflow-hidden divide-x divide-slate-300">
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportDocx}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Export to Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Word</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Export to PDF document"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF</span>
            </button>
          </div>

          {/* New Pay Order Button */}
          {hasPermission('create_records') && (
            <button
              onClick={() => openPayOrderModal()}
              className="px-3.5 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Pay Order
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search serial, PO number, bank, case..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 text-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Case number filter */}
          <input
            type="text"
            value={caseFilter}
            onChange={e => {
              setCaseFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by Case No..."
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 text-xs w-40"
          />

          {/* Bank name filter */}
          <input
            type="text"
            value={bankFilter}
            onChange={e => {
              setBankFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by Bank..."
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 text-xs w-40"
          />
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2 text-slate-500 shrink-0">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0f3a5d] text-white select-none">
              <tr>
                <th
                  onClick={() => {
                    if (sortBy === 'id') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('id'); setSortOrder('DESC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10 w-12 text-center"
                >
                  ID {sortBy === 'id' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'serial_number') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('serial_number'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Serial No {sortBy === 'serial_number' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'case_number') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('case_number'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Case Number {sortBy === 'case_number' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'donation_name') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('donation_name'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Donation Name / Entity {sortBy === 'donation_name' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'pay_order_number') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('pay_order_number'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Pay Order Number {sortBy === 'pay_order_number' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'po_date') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('po_date'); setSortOrder('DESC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10 text-center"
                >
                  PO Date {sortBy === 'po_date' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'bank_name') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('bank_name'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Bank Name {sortBy === 'bank_name' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  Branch Name
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  Remarks
                </th>
                <th className="py-2.5 px-3 font-semibold text-right pr-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-sm font-medium text-slate-600">No Pay Order records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchTerm || caseFilter || bankFilter
                        ? 'Try clearing the search filters.'
                        : 'Click "New Pay Order" to create the first record or populate from a Donation.'}
                    </p>
                  </td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {rec.id}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-700">
                      {rec.serial_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 font-mono text-[11px]">
                      {rec.case_number ? (
                        <span className="text-[#0f3a5d] font-semibold">{rec.case_number}</span>
                      ) : (
                        <span className="text-slate-400 italic">No Case</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-[180px] truncate" title={rec.donation_name}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{rec.donation_name || '-'}</span>
                        {rec.donation_id ? (
                          <span className="inline-flex items-center text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 shrink-0" title={`Linked to Donation #${rec.donation_id}`}>
                            <LinkIcon className="w-2.5 h-2.5 mr-0.5" />
                            #{rec.donation_id}
                          </span>
                        ) : rec.is_unlinked ? (
                          <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 shrink-0" title="Manual unlinked record">
                            <Unlink className="w-2.5 h-2.5" />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-emerald-800 text-[11px]">
                      {rec.pay_order_number || '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                      {toDisplayDate(rec.po_date)}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {rec.bank_name || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {rec.branch_name || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate" title={rec.remarks}>
                      {rec.remarks || '-'}
                    </td>
                    <td className="py-2 px-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('edit_records') && (
                          <button
                            onClick={() => openPayOrderModal(rec.id)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('delete_records') && (
                          <button
                            onClick={() => handleDelete(rec)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
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

        {/* Pagination footer */}
        <Pagination
          currentPage={page}
          totalRecords={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
