import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { payOrderRepo, PayOrderFilter } from '../../database/repositories/payOrderRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { query } from '../../database/engine';
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
  Unlink,
  Coins,
  Calendar,
  SendHorizontal
} from 'lucide-react';

export const PayOrderEntryView: React.FC = () => {
  const {
    openPayOrderModal,
    openDisbursementModal,
    showConfirm,
    addToast,
    hasPermission,
    settings,
    currentUser,
    dataVersion
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
  }, [loadData, dataVersion]);

  // Overall financial and aggregate stats
  const overallStats = React.useMemo(() => {
    const sumRes = query<{ total_amt: number; linked_count: number; bank_count: number }>(`
      SELECT 
        COALESCE(SUM(donation_amount), 0) as total_amt,
        SUM(CASE WHEN donation_id IS NOT NULL THEN 1 ELSE 0 END) as linked_count,
        COUNT(DISTINCT bank_name) as bank_count
      FROM PayOrders
    `);
    return sumRes[0] || { total_amt: 0, linked_count: 0, bank_count: 0 };
  }, [dataVersion, total]);

  const handleDelete = (record: PayOrderRecord) => {
    if (!hasPermission('delete_records')) {
      addToast('Permission denied: You cannot delete records.', 'error');
      return;
    }

    showConfirm({
      title: 'Delete Pay Order Record?',
      message: `Are you sure you want to permanently delete Pay Order Record #${record.id} (PO: ${record.pay_order_number || 'N/A'}, Case: ${record.case_number || 'N/A'})? This action will be audited.`,
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

  // Full fields for Export & Registers
  const exportColumns: ExportColumn[] = [
    { header: 'ID', key: 'id', width: 8, align: 'center' },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Case Number', key: 'case_number', width: 16 },
    { header: 'Donation Name', key: 'donation_name', width: 24 },
    { header: 'Donation Amount', key: 'donation_amount', width: 16, align: 'right', isAmount: true },
    { header: 'Judgement Date', key: 'judgement_date', width: 16, align: 'center', isDate: true },
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
            Judicial pay order instruments with full field register (amounts, decreed dates, case citations, issuing banks)
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

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Pay Orders</span>
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {total}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Court instruments logged</p>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Decreed Amount</span>
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 font-mono truncate" title={`${settings.currencySymbol} ${Number(overallStats.total_amt).toLocaleString()}`}>
            {settings.currencySymbol} {Number(overallStats.total_amt).toLocaleString(undefined, { minimumFractionDigits: settings.decimalPrecision || 2, maximumFractionDigits: settings.decimalPrecision || 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Aggregate valuation</p>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Linked to Donations</span>
            <LinkIcon className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-teal-700 font-mono">
            {overallStats.linked_count} <span className="text-xs font-normal text-slate-400">/ {total}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Populated from donations</p>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Banking Partners</span>
            <Building className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {overallStats.bank_count}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Distinct financial institutions</p>
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
              placeholder="Search serial, PO number, bank, case, entity..."
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

      {/* Main Records Table with ALL Fields */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
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
                    if (sortBy === 'donation_amount') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('donation_amount'); setSortOrder('DESC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10 text-right"
                >
                  Donation Amount ({settings.currencySymbol}) {sortBy === 'donation_amount' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'judgement_date') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('judgement_date'); setSortOrder('DESC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10 text-center"
                >
                  Judgement Date {sortBy === 'judgement_date' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'pay_order_number') setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                    else { setSortBy('pay_order_number'); setSortOrder('ASC'); }
                  }}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-white/10"
                >
                  Pay Order No {sortBy === 'pay_order_number' && (sortOrder === 'ASC' ? '↑' : '↓')}
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
                  <td colSpan={12} className="py-12 text-center text-slate-400">
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
                    {/* 1. ID */}
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {rec.id}
                    </td>

                    {/* 2. Serial Number */}
                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                      {rec.serial_number || '-'}
                    </td>

                    {/* 3. Case Number */}
                    <td className="py-2 px-3 font-medium text-slate-900 font-mono text-[11px] whitespace-nowrap">
                      {rec.case_number ? (
                        <span className="text-[#0f3a5d] font-semibold">{rec.case_number}</span>
                      ) : (
                        <span className="text-slate-400 italic">No Case</span>
                      )}
                    </td>

                    {/* 4. Donation Name */}
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-[170px] truncate" title={rec.donation_name}>
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

                    {/* 5. Donation Amount (Requested field showing in entry & register) */}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                      {rec.donation_amount !== null && rec.donation_amount !== undefined ? (
                        `${settings.currencySymbol} ${Number(rec.donation_amount).toLocaleString(undefined, { minimumFractionDigits: settings.decimalPrecision || 2, maximumFractionDigits: settings.decimalPrecision || 2 })}`
                      ) : (
                        <span className="text-slate-300 font-normal">-</span>
                      )}
                    </td>

                    {/* 6. Judgement Date (Decreed Court Date) */}
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {rec.judgement_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {toDisplayDate(rec.judgement_date)}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 7. Pay Order Number */}
                    <td className="py-2 px-3 font-mono font-medium text-emerald-800 text-[11px] whitespace-nowrap">
                      {rec.pay_order_number || '-'}
                    </td>

                    {/* 8. PO Date */}
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {toDisplayDate(rec.po_date)}
                    </td>

                    {/* 9. Bank Name */}
                    <td className="py-2 px-3 text-slate-700 max-w-[130px] truncate" title={rec.bank_name}>
                      {rec.bank_name || '-'}
                    </td>

                    {/* 10. Branch Name */}
                    <td className="py-2 px-3 text-slate-600 max-w-[120px] truncate" title={rec.branch_name}>
                      {rec.branch_name || '-'}
                    </td>

                    {/* 11. Remarks */}
                    <td className="py-2 px-3 text-slate-500 max-w-[120px] truncate" title={rec.remarks}>
                      {rec.remarks || '-'}
                    </td>

                    {/* 12. Actions */}
                    <td className="py-2 px-3 text-right pr-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick create disbursement with pre-populated PO data */}
                        <button
                          onClick={() => {
                            openDisbursementModal(undefined, rec.donation_id || undefined, {
                              payOrderId: rec.id,
                              payOrderNumber: rec.pay_order_number,
                              poDate: rec.po_date,
                              bankName: rec.bank_name,
                              branchName: rec.branch_name,
                              caseNumber: rec.case_number,
                              donationName: rec.donation_name,
                              donationAmount: rec.donation_amount,
                              judgementDate: rec.judgement_date,
                              donationId: rec.donation_id
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          title="Create Disbursement from this Pay Order"
                        >
                          <SendHorizontal className="w-3.5 h-3.5" />
                        </button>

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

            {/* Table Footer with Summary Sum */}
            {records.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-800">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-xs text-slate-600">
                    Visible Page Total ({records.length} {records.length === 1 ? 'record' : 'records'}):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs text-emerald-800 whitespace-nowrap">
                    {settings.currencySymbol} {records.reduce((sum, r) => sum + (r.donation_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: settings.decimalPrecision || 2, maximumFractionDigits: settings.decimalPrecision || 2 })}
                  </td>
                  <td colSpan={7} className="py-2.5 px-3 text-xs text-slate-400 text-right pr-4">
                    Grand Decreed Total: <strong className="text-slate-700 font-mono">{settings.currencySymbol} {Number(overallStats.total_amt).toLocaleString(undefined, { minimumFractionDigits: settings.decimalPrecision || 2, maximumFractionDigits: settings.decimalPrecision || 2 })}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
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
