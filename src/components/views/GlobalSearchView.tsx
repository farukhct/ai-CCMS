import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { query } from '../../database/engine';
import { toDisplayDate } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { DatePicker } from '../common/DatePicker';
import { Pagination } from '../common/Pagination';
import {
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  FileDown,
  Edit2,
  X,
  RotateCcw
} from 'lucide-react';

export const GlobalSearchView: React.FC = () => {
  const {
    settings,
    hasPermission,
    openApplicationModal,
    openDonationModal,
    openDisbursementModal,
    openPayOrderModal,
    dataVersion
  } = useApp();

  // Search filter criteria
  const [keyword, setKeyword] = useState('');
  const [moduleFilter, setModuleFilter] = useState<'all' | 'applications' | 'donations' | 'disbursements' | 'pay_orders'>('all');
  const [caseNumber, setCaseNumber] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const results = useMemo(() => {
    const list: any[] = [];
    const term = keyword.trim().toLowerCase();

    // 1. Query Applications if applicable
    if (moduleFilter === 'all' || moduleFilter === 'applications') {
      let appSql = 'SELECT * FROM Applications WHERE 1=1';
      let appParams: any[] = [];

      if (term) {
        appSql += ` AND (
          LOWER(serial_number) LIKE ? OR
          LOWER(donation_name) LIKE ? OR
          LOWER(address) LIKE ? OR
          phone_number LIKE ? OR
          LOWER(bank_name) LIKE ? OR
          LOWER(branch_name) LIKE ? OR
          bank_account_number LIKE ? OR
          routing_number LIKE ? OR
          LOWER(remarks) LIKE ?
        )`;
        const p = `%${term}%`;
        appParams.push(p, p, p, p, p, p, p, p, p);
      }

      if (startDate) {
        appSql += ' AND application_date >= ? AND application_date != ""';
        appParams.push(startDate);
      }
      if (endDate) {
        appSql += ' AND application_date <= ? AND application_date != ""';
        appParams.push(endDate);
      }

      const appRows = query(appSql, appParams);
      appRows.forEach((r: any) => {
        list.push({
          type: 'Application',
          id: r.id,
          serial_number: r.serial_number,
          case_number: '-',
          name: r.donation_name,
          details: `${r.bank_name || ''} ${r.bank_account_number ? `(A/C: ${r.bank_account_number})` : ''}`.trim() || r.address || '-',
          amount: null,
          date: r.application_date,
          status: 'Petition',
          remarks: r.remarks,
          raw: r
        });
      });
    }

    // 2. Query Donations if applicable
    if (moduleFilter === 'all' || moduleFilter === 'donations') {
      let donSql = 'SELECT * FROM Donations WHERE 1=1';
      let donParams: any[] = [];

      if (term) {
        donSql += ` AND (
          LOWER(serial_number) LIKE ? OR
          LOWER(case_number) LIKE ? OR
          LOWER(donation_name) LIKE ? OR
          LOWER(remarks) LIKE ?
        )`;
        const p = `%${term}%`;
        donParams.push(p, p, p, p);
      }

      if (caseNumber.trim()) {
        donSql += ' AND LOWER(case_number) LIKE ?';
        donParams.push(`%${caseNumber.trim().toLowerCase()}%`);
      }

      if (startDate) {
        donSql += ' AND judgement_date >= ? AND judgement_date != ""';
        donParams.push(startDate);
      }
      if (endDate) {
        donSql += ' AND judgement_date <= ? AND judgement_date != ""';
        donParams.push(endDate);
      }

      if (minAmount) {
        donSql += ' AND donation_amount >= ?';
        donParams.push(parseFloat(minAmount));
      }
      if (maxAmount) {
        donSql += ' AND donation_amount <= ?';
        donParams.push(parseFloat(maxAmount));
      }

      const donRows = query(donSql, donParams);
      donRows.forEach((r: any) => {
        list.push({
          type: 'Donation',
          id: r.id,
          serial_number: r.serial_number,
          case_number: r.case_number,
          name: r.donation_name,
          details: r.is_unlinked ? 'Unlinked Entry' : `Linked (App #${r.application_id})`,
          amount: r.donation_amount,
          date: r.judgement_date,
          status: 'Decreed',
          remarks: r.remarks,
          raw: r
        });
      });
    }

    // 3. Query Disbursements if applicable
    if (moduleFilter === 'all' || moduleFilter === 'disbursements') {
      let disSql = 'SELECT * FROM Disbursements WHERE 1=1';
      let disParams: any[] = [];

      if (term) {
        disSql += ` AND (
          LOWER(serial_number) LIKE ? OR
          LOWER(case_number) LIKE ? OR
          LOWER(donation_name) LIKE ? OR
          LOWER(receiver_name) LIKE ? OR
          receiver_phone LIKE ? OR
          LOWER(status) LIKE ? OR
          LOWER(remarks) LIKE ?
        )`;
        const p = `%${term}%`;
        disParams.push(p, p, p, p, p, p, p);
      }

      if (caseNumber.trim()) {
        disSql += ' AND LOWER(case_number) LIKE ?';
        disParams.push(`%${caseNumber.trim().toLowerCase()}%`);
      }

      if (status) {
        disSql += ' AND status = ?';
        disParams.push(status);
      }

      if (startDate) {
        disSql += ' AND receiving_date >= ? AND receiving_date != ""';
        disParams.push(startDate);
      }
      if (endDate) {
        disSql += ' AND receiving_date <= ? AND receiving_date != ""';
        disParams.push(endDate);
      }

      if (minAmount) {
        disSql += ' AND donation_amount >= ?';
        disParams.push(parseFloat(minAmount));
      }
      if (maxAmount) {
        disSql += ' AND donation_amount <= ?';
        disParams.push(parseFloat(maxAmount));
      }

      const disRows = query(disSql, disParams);
      disRows.forEach((r: any) => {
        list.push({
          type: 'Disbursement',
          id: r.id,
          serial_number: r.serial_number,
          case_number: r.case_number,
          name: `${r.receiver_name || 'No Receiver'} (${r.donation_name || 'No Entity'})`,
          details: `Phone: ${r.receiver_phone || '-'}`,
          amount: r.donation_amount,
          date: r.receiving_date,
          status: r.status,
          remarks: r.remarks,
          raw: r
        });
      });
    }

    // 4. Query PayOrders if applicable
    if (moduleFilter === 'all' || moduleFilter === 'pay_orders') {
      let poSql = 'SELECT * FROM PayOrders WHERE 1=1';
      let poParams: any[] = [];

      if (term) {
        poSql += ` AND (
          LOWER(serial_number) LIKE ? OR
          LOWER(case_number) LIKE ? OR
          LOWER(donation_name) LIKE ? OR
          LOWER(pay_order_number) LIKE ? OR
          LOWER(bank_name) LIKE ? OR
          LOWER(branch_name) LIKE ? OR
          LOWER(remarks) LIKE ?
        )`;
        const p = `%${term}%`;
        poParams.push(p, p, p, p, p, p, p);
      }

      if (caseNumber.trim()) {
        poSql += ' AND LOWER(case_number) LIKE ?';
        poParams.push(`%${caseNumber.trim().toLowerCase()}%`);
      }

      if (startDate) {
        poSql += ' AND po_date >= ? AND po_date != ""';
        poParams.push(startDate);
      }
      if (endDate) {
        poSql += ' AND po_date <= ? AND po_date != ""';
        poParams.push(endDate);
      }

      const poRows = query(poSql, poParams);
      poRows.forEach((r: any) => {
        list.push({
          type: 'PayOrder',
          id: r.id,
          serial_number: r.serial_number,
          case_number: r.case_number,
          name: `${r.pay_order_number ? `PO: ${r.pay_order_number}` : 'Pay Order'} (${r.donation_name || 'No Entity'})`,
          details: `${r.bank_name || ''} ${r.branch_name ? `(${r.branch_name})` : ''}`,
          amount: r.donation_amount || null,
          date: r.po_date,
          status: 'Active',
          remarks: r.remarks,
          raw: r
        });
      });
    }

    return list;
  }, [keyword, moduleFilter, caseNumber, status, startDate, endDate, minAmount, maxAmount, dataVersion]);

  // Paginated slice
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, page, pageSize]);

  const handleOpenRecord = (row: any) => {
    if (row.type === 'Application') openApplicationModal(row.id);
    else if (row.type === 'Donation') openDonationModal(row.id);
    else if (row.type === 'Disbursement') openDisbursementModal(row.id);
    else if (row.type === 'PayOrder') openPayOrderModal(row.id);
  };

  const handleResetFilters = () => {
    setKeyword('');
    setModuleFilter('all');
    setCaseNumber('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const exportCols: ExportColumn[] = [
    { header: 'Module', key: 'type', width: 14 },
    { header: 'Serial No', key: 'serial_number', width: 14 },
    { header: 'Case No', key: 'case_number', width: 16 },
    { header: 'Entity / Receiver', key: 'name', width: 26 },
    { header: 'Details', key: 'details', width: 24 },
    { header: 'Amount', key: 'amount', width: 16, align: 'right', isAmount: true },
    { header: 'Date', key: 'date', width: 14, align: 'center', isDate: true },
    { header: 'Status', key: 'status', width: 14, align: 'center' },
    { header: 'Remarks', key: 'remarks', width: 22 }
  ];

  const handleExport = (type: 'excel' | 'word' | 'pdf') => {
    const opts = {
      title: 'Global Search Results Report',
      settings,
      columns: exportCols,
      rows: results,
      orientation: 'landscape' as const
    };
    if (type === 'excel') exportToExcel(opts);
    if (type === 'word') exportToDocx(opts);
    if (type === 'pdf') exportToPdf(opts);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5 text-[#0f3a5d]" />
            Global Court Records Search & Filter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-module searching across Applications, Donations, and Disbursements (<strong className="font-mono text-slate-800">{results.length}</strong> matching records)
          </p>
        </div>

        {hasPermission('export_reports') && results.length > 0 && (
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

      {/* Advanced Filter Criteria Box */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3 text-xs">
        {/* Row 1: Global Keyword & Module Selector */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              General Keyword Search
            </label>
            <input
              type="text"
              value={keyword}
              onChange={e => { setKeyword(e.target.value); setPage(1); }}
              placeholder="Search by Serial, Name, Receiver, Bank, Phone, Remarks..."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Module Register
            </label>
            <select
              value={moduleFilter}
              onChange={e => { setModuleFilter(e.target.value as any); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="all">All Modules</option>
              <option value="applications">Applications Only</option>
              <option value="donations">Donations Only</option>
              <option value="disbursements">Disbursements Only</option>
              <option value="pay_orders">Pay Orders Only</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Case Number
            </label>
            <input
              type="text"
              value={caseNumber}
              onChange={e => { setCaseNumber(e.target.value); setPage(1); }}
              placeholder="e.g. CC-104/2026"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>
        </div>

        {/* Row 2: Status, Dates, Amounts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Disbursement Status
            </label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="">Any Status</option>
              <option value="New Entry">New Entry</option>
              <option value="Received">Received</option>
              <option value="Delivered">Delivered</option>
              <option value="Problem">Problem</option>
              <option value="Hold">Hold</option>
            </select>
          </div>

          <div>
            <DatePicker
              label="From Date"
              value={startDate}
              onChange={val => { setStartDate(val); setPage(1); }}
              placeholder="dd-MM-yyyy"
            />
          </div>

          <div>
            <DatePicker
              label="To Date"
              value={endDate}
              onChange={val => { setEndDate(val); setPage(1); }}
              placeholder="dd-MM-yyyy"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block font-semibold text-slate-700 mb-1">
                Min Amount ({settings.currencySymbol})
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={e => { setMinAmount(e.target.value); setPage(1); }}
                placeholder="0"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block font-semibold text-slate-700 mb-1">
                Max Amount
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={e => { setMaxAmount(e.target.value); setPage(1); }}
                placeholder="No max"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-800 font-mono"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="p-2 border border-slate-300 rounded hover:bg-slate-100 text-slate-600 transition-colors"
              title="Reset All Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f3a5d] text-white font-semibold">
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Serial No</th>
                <th className="py-2.5 px-3">Case Number</th>
                <th className="py-2.5 px-3">Entity / Beneficiary</th>
                <th className="py-2.5 px-3">Associated Details</th>
                <th className="py-2.5 px-3 text-right">Amount ({settings.currencySymbol})</th>
                <th className="py-2.5 px-3 text-center">Date</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right w-16">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No records match the active search criteria. Adjust or clear filters above.
                  </td>
                </tr>
              ) : (
                paginatedResults.map((r, idx) => (
                  <tr key={`${r.type}-${r.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-semibold">
                      <span className={
                        r.type === 'Application' ? 'text-teal-700' :
                        r.type === 'Donation' ? 'text-sky-700' : 'text-indigo-700'
                      }>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">
                      {r.serial_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      {r.case_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {r.name || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate" title={r.details}>
                      {r.details || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {r.amount !== null && r.amount !== undefined ? Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700">
                      {toDisplayDate(r.date)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="font-semibold text-slate-700">{r.status}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleOpenRecord(r)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ml-auto"
                        title="View / Edit Record"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalRecords={results.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={newSize => { setPageSize(newSize); setPage(1); }}
        />
      </div>
    </div>
  );
};
