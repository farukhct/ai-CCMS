import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { query } from '../../database/engine';
import { toDisplayDate } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import {
  Layers,
  FileSpreadsheet,
  FileText,
  FileDown,
  Search,
  ArrowRight,
  FileCheck,
  CreditCard,
  Building,
  Coins,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Filter,
  Receipt
} from 'lucide-react';

type AllRecordsFilterModule = 'all' | 'applications' | 'donations' | 'pay_orders' | 'disbursements';
type AllRecordsDisplayMode = 'unified' | 'pipeline';

export const AllRecordsView: React.FC = () => {
  const {
    settings,
    hasPermission,
    openApplicationModal,
    openDonationModal,
    openPayOrderModal,
    openDisbursementModal,
    dataVersion
  } = useApp();

  const [displayMode, setDisplayMode] = useState<AllRecordsDisplayMode>('unified');
  const [moduleFilter, setModuleFilter] = useState<AllRecordsFilterModule>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch raw records across all 4 modules
  const rawData = useMemo(() => {
    const apps = query('SELECT * FROM Applications ORDER BY id DESC');
    const dons = query('SELECT * FROM Donations ORDER BY id DESC');
    const pos = query('SELECT * FROM PayOrders ORDER BY id DESC');
    const diss = query('SELECT * FROM Disbursements ORDER BY id DESC');

    const appSum = 0;
    const donSum = dons.reduce((sum: number, d: any) => sum + (d.donation_amount || 0), 0);
    const poSum = pos.reduce((sum: number, p: any) => sum + (p.donation_amount || 0), 0);
    const disSum = diss.reduce((sum: number, d: any) => sum + (d.donation_amount || 0), 0);

    return { apps, dons, pos, diss, counts: { apps: apps.length, dons: dons.length, pos: pos.length, diss: diss.length, donSum, poSum, disSum } };
  }, [dataVersion]);

  // 2. Build Unified All Records List
  const unifiedRecords = useMemo(() => {
    const list: any[] = [];

    // Applications
    rawData.apps.forEach((a: any) => {
      list.push({
        module: 'applications',
        moduleLabel: 'Application',
        id: a.id,
        serial_number: a.serial_number,
        case_number: '-',
        entity_name: a.donation_name || 'No Entity',
        amount: null,
        date: a.application_date,
        dateLabel: 'App Date',
        details: `${a.bank_name || ''} ${a.branch_name ? `(${a.branch_name})` : ''} · A/C: ${a.bank_account_number || '-'}`,
        status: 'Submitted',
        raw: a
      });
    });

    // Donations
    rawData.dons.forEach((d: any) => {
      list.push({
        module: 'donations',
        moduleLabel: 'Donation',
        id: d.id,
        serial_number: d.serial_number,
        case_number: d.case_number || '-',
        entity_name: d.donation_name || 'No Entity',
        amount: d.donation_amount,
        date: d.judgement_date,
        dateLabel: 'Decree Date',
        details: d.is_unlinked ? 'Standalone / Unlinked' : 'Linked to Application',
        status: 'Decreed',
        raw: d
      });
    });

    // Pay Orders
    rawData.pos.forEach((p: any) => {
      list.push({
        module: 'pay_orders',
        moduleLabel: 'Pay Order',
        id: p.id,
        serial_number: p.serial_number,
        case_number: p.case_number || '-',
        entity_name: p.donation_name || 'No Entity',
        amount: p.donation_amount,
        date: p.po_date,
        dateLabel: 'PO Date',
        details: `PO #${p.pay_order_number || '-'} · ${p.bank_name || ''} ${p.branch_name ? `(${p.branch_name})` : ''}`,
        status: 'Active Instrument',
        raw: p
      });
    });

    // Disbursements
    rawData.diss.forEach((dis: any) => {
      list.push({
        module: 'disbursements',
        moduleLabel: 'Disbursement',
        id: dis.id,
        serial_number: dis.serial_number,
        case_number: dis.case_number || '-',
        entity_name: dis.donation_name || 'No Entity',
        amount: dis.donation_amount,
        date: dis.receiving_date,
        dateLabel: 'Disb Date',
        details: `Receiver: ${dis.receiver_name || '-'} (${dis.receiver_phone || ''}) · ${dis.pay_order_number ? `PO #${dis.pay_order_number}` : ''}`,
        status: dis.status || 'New Entry',
        raw: dis
      });
    });

    return list;
  }, [rawData]);

  // 3. Build Connected Pipeline Records (Joined Query)
  const pipelineRecords = useMemo(() => {
    let sql = `
      SELECT 
        dis.id as dis_id,
        dis.serial_number as dis_serial,
        dis.case_number as case_number,
        dis.donation_name as entity_name,
        dis.donation_amount as dis_amount,
        dis.receiver_name as receiver_name,
        dis.receiver_phone as receiver_phone,
        dis.receiving_date as receiving_date,
        dis.status as dis_status,
        don.id as don_id,
        don.serial_number as don_serial,
        don.donation_amount as don_amount,
        don.judgement_date as judgement_date,
        app.id as app_id,
        app.serial_number as app_serial,
        app.bank_name as bank_name,
        app.bank_account_number as bank_account,
        app.application_date as app_date
      FROM Disbursements dis
      LEFT JOIN Donations don ON dis.donation_id = don.id
      LEFT JOIN Applications app ON don.application_id = app.id
      ORDER BY dis.id DESC
    `;
    return query(sql);
  }, [dataVersion]);

  // Filtered rows based on current active mode, module, and search term
  const displayedRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (displayMode === 'unified') {
      let list = unifiedRecords;
      if (moduleFilter !== 'all') {
        list = list.filter(r => r.module === moduleFilter);
      }
      if (!term) return list;

      return list.filter(r =>
        (r.serial_number && r.serial_number.toLowerCase().includes(term)) ||
        (r.case_number && r.case_number.toLowerCase().includes(term)) ||
        (r.entity_name && r.entity_name.toLowerCase().includes(term)) ||
        (r.details && r.details.toLowerCase().includes(term)) ||
        (r.status && r.status.toLowerCase().includes(term)) ||
        (r.moduleLabel && r.moduleLabel.toLowerCase().includes(term))
      );
    } else {
      let list = pipelineRecords;
      if (!term) return list;

      return list.filter((r: any) =>
        (r.case_number && r.case_number.toLowerCase().includes(term)) ||
        (r.entity_name && r.entity_name.toLowerCase().includes(term)) ||
        (r.receiver_name && r.receiver_name.toLowerCase().includes(term)) ||
        (r.bank_name && r.bank_name.toLowerCase().includes(term)) ||
        (r.dis_serial && r.dis_serial.toLowerCase().includes(term)) ||
        (r.don_serial && r.don_serial.toLowerCase().includes(term)) ||
        (r.app_serial && r.app_serial.toLowerCase().includes(term)) ||
        (r.pay_order_number && r.pay_order_number.toLowerCase().includes(term))
      );
    }
  }, [displayMode, moduleFilter, searchTerm, unifiedRecords, pipelineRecords]);

  // Export Columns definition based on mode
  const exportCols: ExportColumn[] = useMemo(() => {
    if (displayMode === 'unified') {
      return [
        { header: 'Module', key: 'moduleLabel', width: 14 },
        { header: 'Serial No', key: 'serial_number', width: 14 },
        { header: 'Case Number', key: 'case_number', width: 16 },
        { header: 'Entity / Company', key: 'entity_name', width: 24 },
        { header: 'Amount', key: 'amount', width: 16, align: 'right', isAmount: true },
        { header: 'Date', key: 'date', width: 14, align: 'center', isDate: true },
        { header: 'Status', key: 'status', width: 14, align: 'center' },
        { header: 'Details / References', key: 'details', width: 32 }
      ];
    } else {
      return [
        { header: 'Disb Serial', key: 'dis_serial', width: 14 },
        { header: 'Case No', key: 'case_number', width: 16 },
        { header: 'Entity Name', key: 'entity_name', width: 24 },
        { header: 'Disb Amount', key: 'dis_amount', width: 16, align: 'right', isAmount: true },
        { header: 'Receiver Name', key: 'receiver_name', width: 20 },
        { header: 'Disbursement Date', key: 'receiving_date', width: 16, align: 'center', isDate: true },
        { header: 'Pay Order No', key: 'pay_order_number', width: 16 },
        { header: 'Status', key: 'dis_status', width: 14, align: 'center' },
        { header: 'Donation Serial', key: 'don_serial', width: 16 },
        { header: 'Decree Amount', key: 'don_amount', width: 16, align: 'right', isAmount: true },
        { header: 'App Serial', key: 'app_serial', width: 14 },
        { header: 'Bank Name', key: 'bank_name', width: 18 }
      ];
    }
  }, [displayMode]);

  const handleExport = (type: 'excel' | 'word' | 'pdf') => {
    const opts = {
      title: displayMode === 'unified' ? 'Unified All Records Ledger' : 'Consolidated Court Pipeline Ledger',
      settings,
      columns: exportCols,
      rows: displayedRows,
      orientation: 'landscape' as const
    };
    if (type === 'excel') exportToExcel(opts);
    if (type === 'word') exportToDocx(opts);
    if (type === 'pdf') exportToPdf(opts);
  };

  const handleOpenRowRecord = (row: any) => {
    if (row.module === 'applications') openApplicationModal(row.id);
    else if (row.module === 'donations') openDonationModal(row.id);
    else if (row.module === 'pay_orders') openPayOrderModal(row.id);
    else if (row.module === 'disbursements') openDisbursementModal(row.id);
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0f3a5d]" />
            All Records Registry & Pipeline Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive registry indexing all imported and entered records across Applications, Decreed Donations, Pay Orders, and Disbursements.
          </p>
        </div>

        {hasPermission('export_reports') && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExport('excel')}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              Excel (.xlsx)
            </button>
            <button
              onClick={() => handleExport('word')}
              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-sky-700" />
              Word (.docx)
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-700" />
              PDF
            </button>
          </div>
        )}
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => { setDisplayMode('unified'); setModuleFilter('applications'); }}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            moduleFilter === 'applications' && displayMode === 'unified'
              ? 'bg-teal-50/80 border-teal-500 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-teal-800 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Building className="w-4 h-4 text-teal-700" />
              Applications
            </span>
            <span className="font-mono text-xs text-teal-600 bg-teal-100 px-1.5 py-0.2 rounded">
              {rawData.counts.apps}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {rawData.counts.apps} <span className="text-xs font-normal text-slate-500">records</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Petitions & Bank Accs</div>
        </div>

        <div
          onClick={() => { setDisplayMode('unified'); setModuleFilter('donations'); }}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            moduleFilter === 'donations' && displayMode === 'unified'
              ? 'bg-sky-50/80 border-sky-500 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-800 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-sky-700" />
              Donations (Decreed)
            </span>
            <span className="font-mono text-xs text-sky-600 bg-sky-100 px-1.5 py-0.2 rounded">
              {rawData.counts.dons}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {settings.currencySymbol} {rawData.counts.donSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{rawData.counts.dons} decreed donations</div>
        </div>

        <div
          onClick={() => { setDisplayMode('unified'); setModuleFilter('pay_orders'); }}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            moduleFilter === 'pay_orders' && displayMode === 'unified'
              ? 'bg-blue-50/80 border-blue-500 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-blue-800 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-700" />
              Pay Orders
            </span>
            <span className="font-mono text-xs text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">
              {rawData.counts.pos}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {settings.currencySymbol} {rawData.counts.poSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{rawData.counts.pos} bank instruments</div>
        </div>

        <div
          onClick={() => { setDisplayMode('unified'); setModuleFilter('disbursements'); }}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            moduleFilter === 'disbursements' && displayMode === 'unified'
              ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-indigo-800 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-indigo-700" />
              Disbursements
            </span>
            <span className="font-mono text-xs text-indigo-600 bg-indigo-100 px-1.5 py-0.2 rounded">
              {rawData.counts.diss}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {settings.currencySymbol} {rawData.counts.disSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{rawData.counts.diss} payment payouts</div>
        </div>
      </div>

      {/* Controls & Mode Selection */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Display Mode Toggle */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setDisplayMode('unified')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                displayMode === 'unified'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Unified All Records View</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 font-mono">
                {unifiedRecords.length}
              </span>
            </button>
            <button
              onClick={() => setDisplayMode('pipeline')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                displayMode === 'pipeline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#0f3a5d]" />
              <span>Connected Pipeline (Relational Trace)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 font-mono">
                {pipelineRecords.length}
              </span>
            </button>
          </div>

          {/* Module Filter Buttons (Unified Mode) */}
          {displayMode === 'unified' && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-slate-500 text-[11px] font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Module:
              </span>
              <button
                onClick={() => setModuleFilter('all')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  moduleFilter === 'all'
                    ? 'bg-[#0f3a5d] text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Modules ({unifiedRecords.length})
              </button>
              <button
                onClick={() => setModuleFilter('applications')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  moduleFilter === 'applications'
                    ? 'bg-teal-700 text-white font-semibold'
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                }`}
              >
                Apps ({rawData.counts.apps})
              </button>
              <button
                onClick={() => setModuleFilter('donations')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  moduleFilter === 'donations'
                    ? 'bg-sky-700 text-white font-semibold'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                }`}
              >
                Donations ({rawData.counts.dons})
              </button>
              <button
                onClick={() => setModuleFilter('pay_orders')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  moduleFilter === 'pay_orders'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                Pay Orders ({rawData.counts.pos})
              </button>
              <button
                onClick={() => setModuleFilter('disbursements')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  moduleFilter === 'disbursements'
                    ? 'bg-indigo-700 text-white font-semibold'
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                Disbursements ({rawData.counts.diss})
              </button>
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={
              displayMode === 'unified'
                ? 'Search any imported or entered records by serial, case number, company entity, bank, receiver, or details...'
                : 'Search connected pipeline by case number, company, bank, receiver, serials, or pay order numbers...'
            }
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {displayMode === 'unified' ? (
          /* 1. Unified Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f3a5d] text-white font-semibold">
                  <th className="py-2.5 px-3 w-28">Module</th>
                  <th className="py-2.5 px-3 w-32">Serial No</th>
                  <th className="py-2.5 px-3 w-40">Case Number</th>
                  <th className="py-2.5 px-3">Company / Entity Name</th>
                  <th className="py-2.5 px-3 w-36 text-right">Amount</th>
                  <th className="py-2.5 px-3 w-28 text-center">Date</th>
                  <th className="py-2.5 px-3 w-32 text-center">Status</th>
                  <th className="py-2.5 px-3">Details / Reference</th>
                  <th className="py-2.5 px-3 w-16 text-center">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No records match the current filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r: any, idx: number) => (
                    <tr key={`unified-${r.module}-${r.id || idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            r.module === 'applications'
                              ? 'bg-teal-100 text-teal-800'
                              : r.module === 'donations'
                              ? 'bg-sky-100 text-sky-800'
                              : r.module === 'pay_orders'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {r.moduleLabel}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">
                        <button
                          onClick={() => handleOpenRowRecord(r)}
                          className="hover:underline text-indigo-800 font-semibold text-left"
                        >
                          {r.serial_number || `#${r.id}`}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {r.case_number || '-'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {r.entity_name || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-teal-800">
                        {r.amount !== null && r.amount !== undefined
                          ? `${settings.currencySymbol} ${Number(r.amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}`
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="font-mono text-slate-800">{toDisplayDate(r.date)}</div>
                        <div className="text-[10px] text-slate-400">{r.dateLabel}</div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {r.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px]">
                        {r.details || '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleOpenRowRecord(r)}
                          title="Open Record in Editor"
                          className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 2. Connected Pipeline Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f3a5d] text-white font-semibold">
                  <th className="py-2.5 px-3">Disb. Serial</th>
                  <th className="py-2.5 px-3">Case Number</th>
                  <th className="py-2.5 px-3">Company / Entity</th>
                  <th className="py-2.5 px-3 text-right">Disb Amount</th>
                  <th className="py-2.5 px-3">Receiver</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 bg-blue-950">Pay Order</th>
                  <th className="py-2.5 px-3 bg-sky-950">Linked Donation</th>
                  <th className="py-2.5 px-3 text-right bg-sky-950">Decreed Amount</th>
                  <th className="py-2.5 px-3 bg-teal-950">Application / Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No connected pipeline records found. Switch to "Unified All Records View" to inspect individual module records.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r: any, idx: number) => (
                    <tr key={`pipeline-${r.dis_id || idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">
                        <button
                          onClick={() => openDisbursementModal(r.dis_id)}
                          className="text-indigo-700 hover:underline"
                        >
                          {r.dis_serial || `#${r.dis_id}`}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {r.case_number || '-'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {r.entity_name || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {r.dis_amount ? `${settings.currencySymbol} ${Number(r.dis_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-900">{r.receiver_name || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.receiver_phone || ''}</div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {r.dis_status || 'New Entry'}
                        </span>
                      </td>
                      <td className="py-2 px-3 bg-blue-50/30">
                        {r.pay_order_number ? (
                          <div>
                            <span className="font-mono font-bold text-blue-900">#{r.pay_order_number}</span>
                            {r.po_date && (
                              <div className="text-[10px] text-blue-600 font-mono">{toDisplayDate(r.po_date)}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No PO</span>
                        )}
                      </td>
                      <td className="py-2 px-3 bg-sky-50/30">
                        {r.don_id ? (
                          <button
                            onClick={() => openDonationModal(r.don_id)}
                            className="text-sky-800 hover:underline font-mono"
                          >
                            {r.don_serial || `Donation #${r.don_id}`}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">No link</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums bg-sky-50/30">
                        {r.don_amount ? `${settings.currencySymbol} ${Number(r.don_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2 px-3 bg-teal-50/30 text-[11px]">
                        {r.app_id ? (
                          <div>
                            <button
                              onClick={() => openApplicationModal(r.app_id)}
                              className="text-teal-800 font-mono hover:underline font-medium"
                            >
                              {r.app_serial || `App #${r.app_id}`}
                            </button>
                            <div className="text-slate-500 truncate max-w-[140px]">{r.bank_name || ''}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unlinked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer with visible record count */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <span>
            Showing <strong className="font-mono text-slate-900">{displayedRows.length}</strong> records in{' '}
            {displayMode === 'unified' ? 'Unified All Records View' : 'Connected Pipeline'}
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            {displayMode === 'unified'
              ? `Applications: ${rawData.counts.apps} | Donations: ${rawData.counts.dons} | Pay Orders: ${rawData.counts.pos} | Disbursements: ${rawData.counts.diss}`
              : `Pipeline Disbursed: ${settings.currencySymbol} ${rawData.counts.disSum.toLocaleString()} / Decreed: ${settings.currencySymbol} ${rawData.counts.donSum.toLocaleString()}`}
          </span>
        </div>
      </div>
    </div>
  );
};
