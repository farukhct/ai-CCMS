import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { query } from '../../database/engine';
import { toDisplayDate, formatCurrentDateDDMMYYYY, formatTimestampDisplay } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { DatePicker } from '../common/DatePicker';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  FileDown,
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Building2,
  Coins,
  Receipt,
  Scale
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { settings, hasPermission } = useApp();

  const [selectedReportId, setSelectedReportId] = useState<number>(1);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(settings.defaultOrientation || 'landscape');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Custom column toggles for Report 13
  const [customCols, setCustomCols] = useState<string[]>([
    'serial_number', 'case_number', 'donation_name', 'donation_amount', 'receiver_name', 'status', 'receiving_date'
  ]);

  const reportDefinitions = [
    { id: 1, name: '1. Application Register', desc: 'Complete catalogue of submitted petitions and bank accounts.' },
    { id: 2, name: '2. Donation Register', desc: 'Decreed court donations with case citations and amounts.' },
    { id: 3, name: '3. Donation by Case Number', desc: 'Case-indexed donation register filtered by matter reference.' },
    { id: 4, name: '4. Donation by Entity Name', desc: 'Grouped donations according to paying corporate respondent.' },
    { id: 5, name: '5. Donation by Judgement Date', desc: 'Chronological sequence of judicial decrees.' },
    { id: 6, name: '6. Disbursement Register', desc: 'Master record of authorized fund deliveries to beneficiaries.' },
    { id: 7, name: '7. Disbursement by Status', desc: 'Categorized breakdown (Delivered, Received, Problem, Hold, New Entry).' },
    { id: 8, name: '8. Disbursement by Receiver', desc: 'All releases indexed by authorized recipient name or phone.' },
    { id: 9, name: '9. Disbursement by Disbursement Date', desc: 'Chronological timeline of executed payments.' },
    { id: 10, name: '10. Case-wise Donation & Disbursement Summary', desc: 'Case reconciliation showing decreed amounts vs disbursed totals.' },
    { id: 11, name: '11. Daily / Monthly Financial Summary', desc: 'Periodic financial throughput aggregate.' },
    { id: 12, name: '12. Incomplete Records Audit Report', desc: 'Records requiring data completion (missing dates, amounts, or entities).' },
    { id: 13, name: '13. Custom-Filtered Dynamic Report', desc: 'Select bespoke columns and custom multi-field criteria.' },
    { id: 14, name: '14. System Security & Audit Log Report', desc: 'Privileged audit trail of user access and record modifications.', perm: 'view_audit_logs' },
    { id: 15, name: '15. Pay Order Register', desc: 'Judicial bank pay order instruments with amounts, dates, case citations, and issuing banks.' }
  ];

  // Compute Active Report Data & Columns
  const activeReport = useMemo(() => {
    let title = 'Court Report';
    let columns: ExportColumn[] = [];
    let rows: any[] = [];
    let totalSum: number | null = null;

    if (selectedReportId === 1) {
      title = 'Application Register';
      columns = [
        { header: 'ID', key: 'id', width: 8, align: 'center' },
        { header: 'Serial No', key: 'serial_number', width: 14 },
        { header: 'Donation Name', key: 'donation_name', width: 28 },
        { header: 'Address', key: 'address', width: 22 },
        { header: 'Phone', key: 'phone_number', width: 15 },
        { header: 'Bank Name', key: 'bank_name', width: 18 },
        { header: 'Branch', key: 'branch_name', width: 16 },
        { header: 'Account No', key: 'bank_account_number', width: 20 },
        { header: 'Routing No', key: 'routing_number', width: 14 },
        { header: 'App Date', key: 'application_date', width: 14, align: 'center', isDate: true },
        { header: 'Remarks', key: 'remarks', width: 20 }
      ];
      let sql = 'SELECT * FROM Applications WHERE 1=1';
      let p: any[] = [];
      if (startDate) { sql += ' AND application_date >= ?'; p.push(startDate); }
      if (endDate) { sql += ' AND application_date <= ?'; p.push(endDate); }
      sql += ' ORDER BY id DESC';
      rows = query(sql, p);
    }
    else if (selectedReportId === 2 || selectedReportId === 3 || selectedReportId === 4 || selectedReportId === 5) {
      title = selectedReportId === 2 ? 'Donation Register' :
              selectedReportId === 3 ? 'Donation by Case Number' :
              selectedReportId === 4 ? 'Donation by Donation Name' : 'Donation by Judgement Date';

      columns = [
        { header: 'ID', key: 'id', width: 8, align: 'center' },
        { header: 'Serial No', key: 'serial_number', width: 14 },
        { header: 'Case Number', key: 'case_number', width: 18 },
        { header: 'Donation Name', key: 'donation_name', width: 28 },
        { header: 'Amount', key: 'donation_amount', width: 18, align: 'right', isAmount: true },
        { header: 'Judgement Date', key: 'judgement_date', width: 16, align: 'center', isDate: true },
        { header: 'Linked App', key: 'link_info', width: 16, align: 'center' },
        { header: 'Remarks', key: 'remarks', width: 22 }
      ];

      let sql = 'SELECT * FROM Donations WHERE 1=1';
      let p: any[] = [];
      if (caseFilter.trim()) { sql += ' AND case_number LIKE ?'; p.push(`%${caseFilter.trim()}%`); }
      if (entityFilter.trim()) { sql += ' AND donation_name LIKE ?'; p.push(`%${entityFilter.trim()}%`); }
      if (startDate) { sql += ' AND judgement_date >= ?'; p.push(startDate); }
      if (endDate) { sql += ' AND judgement_date <= ?'; p.push(endDate); }

      if (selectedReportId === 3) sql += ' ORDER BY case_number ASC, id DESC';
      else if (selectedReportId === 4) sql += ' ORDER BY donation_name ASC, id DESC';
      else if (selectedReportId === 5) sql += ' ORDER BY judgement_date DESC, id DESC';
      else sql += ' ORDER BY id DESC';

      const raw = query(sql, p);
      rows = raw.map((r: any) => ({
        ...r,
        link_info: r.is_unlinked ? 'Unlinked' : (r.application_id ? `App #${r.application_id}` : '-')
      }));

      totalSum = rows.reduce((acc, cur) => acc + (cur.donation_amount || 0), 0);
    }
    else if (selectedReportId === 6 || selectedReportId === 7 || selectedReportId === 8 || selectedReportId === 9) {
      title = selectedReportId === 6 ? 'Disbursement Register' :
              selectedReportId === 7 ? 'Disbursement by Status' :
              selectedReportId === 8 ? 'Disbursement by Receiver' : 'Disbursement by Disbursement Date';

      columns = [
        { header: 'ID', key: 'id', width: 8, align: 'center' },
        { header: 'Serial No', key: 'serial_number', width: 14 },
        { header: 'Case Number', key: 'case_number', width: 16 },
        { header: 'Donation Name', key: 'donation_name', width: 24 },
        { header: 'Amount', key: 'donation_amount', width: 16, align: 'right', isAmount: true },
        { header: 'Receiver Name', key: 'receiver_name', width: 20 },
        { header: 'Receiver Phone', key: 'receiver_phone', width: 16 },
        { header: 'Disbursement Date', key: 'receiving_date', width: 16, align: 'center', isDate: true },
        { header: 'Status', key: 'status', width: 14, align: 'center' },
        { header: 'Remarks', key: 'remarks', width: 20 }
      ];

      let sql = 'SELECT * FROM Disbursements WHERE 1=1';
      let p: any[] = [];
      if (statusFilter) { sql += ' AND status = ?'; p.push(statusFilter); }
      if (startDate) { sql += ' AND receiving_date >= ?'; p.push(startDate); }
      if (endDate) { sql += ' AND receiving_date <= ?'; p.push(endDate); }

      if (selectedReportId === 7) sql += ' ORDER BY status ASC, id DESC';
      else if (selectedReportId === 8) sql += ' ORDER BY receiver_name ASC, id DESC';
      else if (selectedReportId === 9) sql += ' ORDER BY receiving_date DESC, id DESC';
      else sql += ' ORDER BY id DESC';

      rows = query(sql, p);
      totalSum = rows.reduce((acc, cur) => acc + (cur.donation_amount || 0), 0);
    }
    else if (selectedReportId === 10) {
      title = 'Case-wise Donation & Disbursement Summary';
      columns = [
        { header: 'Case Number', key: 'case_number', width: 18 },
        { header: 'Entity Name', key: 'entity_name', width: 26 },
        { header: 'Total Decreed', key: 'total_decreed', width: 18, align: 'right', isAmount: true },
        { header: 'Total Disbursed', key: 'total_disbursed', width: 18, align: 'right', isAmount: true },
        { header: 'Remaining Balance', key: 'balance', width: 18, align: 'right', isAmount: true }
      ];

      // Aggregate case query
      const sql = `
        SELECT 
          d.case_number,
          d.donation_name as entity_name,
          SUM(d.donation_amount) as total_decreed,
          COALESCE(disb.disb_sum, 0) as total_disbursed,
          (SUM(d.donation_amount) - COALESCE(disb.disb_sum, 0)) as balance
        FROM Donations d
        LEFT JOIN (
          SELECT case_number, SUM(donation_amount) as disb_sum
          FROM Disbursements
          GROUP BY case_number
        ) disb ON d.case_number = disb.case_number
        WHERE d.case_number IS NOT NULL AND d.case_number != ""
        GROUP BY d.case_number
        ORDER BY d.case_number ASC
      `;
      rows = query(sql);
    }
    else if (selectedReportId === 11) {
      title = 'Periodic Financial Summary';
      columns = [
        { header: 'Period (Month)', key: 'period', width: 18, align: 'center' },
        { header: 'Donation Cases', key: 'don_count', width: 16, align: 'center' },
        { header: 'Decreed Total', key: 'don_total', width: 20, align: 'right', isAmount: true },
        { header: 'Disbursement Count', key: 'dis_count', width: 18, align: 'center' },
        { header: 'Disbursed Total', key: 'dis_total', width: 20, align: 'right', isAmount: true }
      ];

      // Monthly aggregation
      const rawDons = query<{ m: string; c: number; s: number }>(`
        SELECT SUBSTR(judgement_date, 1, 7) as m, COUNT(*) as c, SUM(donation_amount) as s
        FROM Donations WHERE judgement_date IS NOT NULL AND judgement_date != ""
        GROUP BY m ORDER BY m DESC
      `);
      const rawDiss = query<{ m: string; c: number; s: number }>(`
        SELECT SUBSTR(receiving_date, 1, 7) as m, COUNT(*) as c, SUM(donation_amount) as s
        FROM Disbursements WHERE receiving_date IS NOT NULL AND receiving_date != ""
        GROUP BY m ORDER BY m DESC
      `);

      const periodMap: Record<string, any> = {};
      rawDons.forEach(r => {
        if (!r.m) return;
        periodMap[r.m] = { period: r.m, don_count: r.c, don_total: r.s || 0, dis_count: 0, dis_total: 0 };
      });
      rawDiss.forEach(r => {
        if (!r.m) return;
        if (!periodMap[r.m]) periodMap[r.m] = { period: r.m, don_count: 0, don_total: 0, dis_count: r.c, dis_total: r.s || 0 };
        else {
          periodMap[r.m].dis_count = r.c;
          periodMap[r.m].dis_total = r.s || 0;
        }
      });
      rows = Object.values(periodMap).sort((a, b) => b.period.localeCompare(a.period));
    }
    else if (selectedReportId === 12) {
      title = 'Incomplete Records Audit Report';
      columns = [
        { header: 'Module', key: 'module', width: 14 },
        { header: 'Record ID', key: 'id', width: 10, align: 'center' },
        { header: 'Serial No', key: 'serial', width: 14 },
        { header: 'Missing Fields', key: 'missing', width: 34 },
        { header: 'Remarks', key: 'remarks', width: 24 }
      ];

      const incApps = query('SELECT * FROM Applications WHERE (donation_name IS NULL OR donation_name = "") OR (application_date IS NULL OR application_date = "")');
      const incDons = query('SELECT * FROM Donations WHERE (donation_amount IS NULL) OR (case_number IS NULL OR case_number = "") OR (judgement_date IS NULL OR judgement_date = "")');
      const incDiss = query('SELECT * FROM Disbursements WHERE (receiver_name IS NULL OR receiver_name = "") OR (donation_amount IS NULL) OR (receiving_date IS NULL OR receiving_date = "")');

      incApps.forEach((a: any) => {
        const miss: string[] = [];
        if (!a.donation_name) miss.push('Donation Name');
        if (!a.application_date) miss.push('Application Date');
        if (!a.bank_account_number) miss.push('Account No');
        rows.push({ module: 'Application', id: a.id, serial: a.serial_number || '-', missing: miss.join(', '), remarks: a.remarks || '-' });
      });
      incDons.forEach((d: any) => {
        const miss: string[] = [];
        if (!d.case_number) miss.push('Case Number');
        if (d.donation_amount === null) miss.push('Amount');
        if (!d.judgement_date) miss.push('Judgement Date');
        rows.push({ module: 'Donation', id: d.id, serial: d.serial_number || '-', missing: miss.join(', '), remarks: d.remarks || '-' });
      });
      incDiss.forEach((dis: any) => {
        const miss: string[] = [];
        if (!dis.receiver_name) miss.push('Receiver Name');
        if (dis.donation_amount === null) miss.push('Amount');
        if (!dis.receiving_date) miss.push('Disbursement Date');
        rows.push({ module: 'Disbursement', id: dis.id, serial: dis.serial_number || '-', missing: miss.join(', '), remarks: dis.remarks || '-' });
      });
    }
    else if (selectedReportId === 13) {
      title = 'Custom Dynamic Report';
      const allPossibleCols: Record<string, ExportColumn> = {
        serial_number: { header: 'Serial No', key: 'serial_number', width: 14 },
        case_number: { header: 'Case Number', key: 'case_number', width: 16 },
        donation_name: { header: 'Donation Entity', key: 'donation_name', width: 24 },
        donation_amount: { header: 'Amount', key: 'donation_amount', width: 16, align: 'right', isAmount: true },
        receiver_name: { header: 'Receiver Name', key: 'receiver_name', width: 20 },
        receiver_phone: { header: 'Receiver Phone', key: 'receiver_phone', width: 16 },
        status: { header: 'Status', key: 'status', width: 14, align: 'center' },
        receiving_date: { header: 'Disbursement Date', key: 'receiving_date', width: 16, align: 'center', isDate: true },
        remarks: { header: 'Remarks', key: 'remarks', width: 22 }
      };

      columns = customCols.map(c => allPossibleCols[c]).filter(Boolean);
      rows = query('SELECT * FROM Disbursements ORDER BY id DESC LIMIT 200');
    }
    else if (selectedReportId === 14) {
      title = 'Security & Audit Log Report';
      columns = [
        { header: 'ID', key: 'id', width: 8, align: 'center' },
        { header: 'Timestamp', key: 'timestamp', width: 20, align: 'center' },
        { header: 'User', key: 'username', width: 16 },
        { header: 'Action', key: 'action_type', width: 18 },
        { header: 'Entity', key: 'entity_name', width: 16 },
        { header: 'Summary', key: 'summary', width: 34 }
      ];
      const logs = query('SELECT * FROM AuditLogs ORDER BY id DESC LIMIT 500');
      rows = logs.map((l: any) => ({
        ...l,
        timestamp: formatTimestampDisplay(l.timestamp)
      }));
    }
    else if (selectedReportId === 15) {
      title = 'Pay Order Register';
      columns = [
        { header: 'ID', key: 'id', width: 8, align: 'center' },
        { header: 'Serial No', key: 'serial_number', width: 14 },
        { header: 'Case Number', key: 'case_number', width: 16 },
        { header: 'Donation Name', key: 'donation_name', width: 24 },
        { header: 'Donation Amount', key: 'donation_amount', width: 18, align: 'right', isAmount: true },
        { header: 'Judgement Date', key: 'judgement_date', width: 16, align: 'center', isDate: true },
        { header: 'Pay Order No', key: 'pay_order_number', width: 16 },
        { header: 'PO Date', key: 'po_date', width: 16, align: 'center', isDate: true },
        { header: 'Bank Name', key: 'bank_name', width: 20 },
        { header: 'Branch Name', key: 'branch_name', width: 18 },
        { header: 'Remarks', key: 'remarks', width: 20 }
      ];

      let sql = 'SELECT * FROM PayOrders WHERE 1=1';
      let p: any[] = [];
      if (caseFilter.trim()) { sql += ' AND case_number LIKE ?'; p.push(`%${caseFilter.trim()}%`); }
      if (entityFilter.trim()) { sql += ' AND (donation_name LIKE ? OR bank_name LIKE ?)'; p.push(`%${entityFilter.trim()}%`, `%${entityFilter.trim()}%`); }
      if (startDate) { sql += ' AND po_date >= ? AND po_date != ""'; p.push(startDate); }
      if (endDate) { sql += ' AND po_date <= ? AND po_date != ""'; p.push(endDate); }
      sql += ' ORDER BY id DESC';

      rows = query(sql, p);
      totalSum = rows.reduce((acc, cur) => acc + (cur.donation_amount || 0), 0);
    }

    return { title, columns, rows, totalSum };
  }, [selectedReportId, startDate, endDate, statusFilter, caseFilter, entityFilter, customCols]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = (type: 'excel' | 'word' | 'pdf') => {
    const opts = {
      title: activeReport.title,
      settings,
      columns: activeReport.columns,
      rows: activeReport.rows,
      orientation
    };
    if (type === 'excel') exportToExcel(opts);
    if (type === 'word') exportToDocx(opts);
    if (type === 'pdf') exportToPdf(opts);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0f3a5d]" />
            Judicial Reporting & Print Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Formal government ledger extracts formatted with CCMS authority headers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Orientation switch */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs mr-2">
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-2 py-1 rounded font-medium ${orientation === 'portrait' ? 'bg-white shadow-xs font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              Portrait
            </button>
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-2 py-1 rounded font-medium ${orientation === 'landscape' ? 'bg-white shadow-xs font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              Landscape
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>

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
      </div>

      {/* Grid: Left Report Selector + Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: 14 Report Selector Panel */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs h-fit space-y-1">
          <div className="px-2 py-1.5 font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-100 mb-1">
            Available Court Registers
          </div>
          <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
            {reportDefinitions.map(r => {
              if (r.perm && !hasPermission(r.perm as any)) return null;
              const isSelected = selectedReportId === r.id;

              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#0f3a5d] text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="leading-tight">{r.name}</div>
                  <div className={`text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                    {r.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Live Formal Report Preview Container */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter Bar for Active Report */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
            <DatePicker
              label="Date From"
              value={startDate}
              onChange={setStartDate}
              placeholder="dd-MM-yyyy"
            />
            <DatePicker
              label="Date To"
              value={endDate}
              onChange={setEndDate}
              placeholder="dd-MM-yyyy"
            />

            {(selectedReportId === 6 || selectedReportId === 7) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800"
                >
                  <option value="">All Statuses</option>
                  <option value="New Entry">New Entry</option>
                  <option value="Received">Received</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Problem">Problem</option>
                  <option value="Hold">Hold</option>
                </select>
              </div>
            )}

            {(startDate || endDate || statusFilter) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(''); }}
                className="mt-4 px-2 py-1 text-rose-700 hover:bg-rose-50 rounded text-xs font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Printable Report Paper Container */}
          <div className="bg-white rounded-lg border border-slate-300 p-8 shadow-sm print:p-0 print:border-none print:shadow-none min-h-[600px] text-xs">
            {/* Government Authority Banner */}
            <div className="text-center pb-4 border-b-2 border-slate-800 mb-5">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 leading-tight">
                {settings.orgName}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {settings.appSubtitle} · {settings.orgAddress}
              </p>
              <div className="mt-2 text-sm font-bold text-[#0f3a5d] underline uppercase">
                {activeReport.title}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                Generated: {formatTimestampDisplay(new Date().toISOString())} · Total Records: {activeReport.rows.length}
                {startDate || endDate ? ` · Date Range: ${startDate ? toDisplayDate(startDate) : 'Start'} to ${endDate ? toDisplayDate(endDate) : 'Present'}` : ''}
              </div>
            </div>

            {/* Report Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                    {activeReport.columns.map((c, i) => (
                      <th
                        key={i}
                        className={`py-2 px-2.5 border-r border-slate-300 ${
                          c.align === 'right' || c.isAmount ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {activeReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={activeReport.columns.length} className="py-8 text-center text-slate-400">
                        No records match the requested report criteria.
                      </td>
                    </tr>
                  ) : (
                    activeReport.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        {activeReport.columns.map((c, cIdx) => {
                          let val = row[c.key];
                          if (c.isDate) val = toDisplayDate(val, '-');
                          else if (c.isAmount) {
                            val = val !== null && val !== undefined && !isNaN(Number(val))
                              ? Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '-';
                          } else if (val === null || val === undefined || val === '') {
                            val = '-';
                          }

                          return (
                            <td
                              key={cIdx}
                              className={`py-1.5 px-2.5 border-r border-slate-200 ${
                                c.align === 'right' || c.isAmount ? 'text-right font-mono tabular-nums' : c.align === 'center' ? 'text-center font-mono tabular-nums' : 'text-left'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {activeReport.totalSum !== null && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <td colSpan={3} className="py-2 px-2.5 text-right font-semibold">
                        TOTAL:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-900 font-bold">
                        {settings.currencySymbol} {activeReport.totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={activeReport.columns.length - 4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Official Report Sign-off Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-3 text-center text-xs text-slate-600">
              <div>
                <div className="h-8" />
                <div className="border-t border-slate-400 pt-1 font-medium">Prepared By</div>
              </div>
              <div>
                <div className="h-8" />
                <div className="border-t border-slate-400 pt-1 font-medium">Verified By (Bench Officer)</div>
              </div>
              <div>
                <div className="h-8" />
                <div className="border-t border-slate-400 pt-1 font-medium">Company Court Seal & Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
