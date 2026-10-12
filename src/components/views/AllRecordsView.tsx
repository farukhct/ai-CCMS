import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { query } from '../../database/engine';
import { toDisplayDate } from '../../services/dateUtils';
import { exportToExcel, exportToDocx, exportToPdf, ExportColumn } from '../../services/exportService';
import { Layers, FileSpreadsheet, FileText, FileDown, Search, ArrowRight } from 'lucide-react';

export const AllRecordsView: React.FC = () => {
  const {
    settings,
    hasPermission,
    openApplicationModal,
    openDonationModal,
    openDisbursementModal
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');

  // Comprehensive Join Query across Applications, Donations, and Disbursements
  const masterRecords = React.useMemo(() => {
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
    const rows = query(sql);

    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();

    return rows.filter((r: any) =>
      (r.case_number && r.case_number.toLowerCase().includes(term)) ||
      (r.entity_name && r.entity_name.toLowerCase().includes(term)) ||
      (r.receiver_name && r.receiver_name.toLowerCase().includes(term)) ||
      (r.bank_name && r.bank_name.toLowerCase().includes(term)) ||
      (r.dis_serial && r.dis_serial.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const exportCols: ExportColumn[] = [
    { header: 'Disb Serial', key: 'dis_serial', width: 14 },
    { header: 'Case No', key: 'case_number', width: 16 },
    { header: 'Entity Name', key: 'entity_name', width: 24 },
    { header: 'Disb Amount', key: 'dis_amount', width: 16, align: 'right', isAmount: true },
    { header: 'Receiver Name', key: 'receiver_name', width: 20 },
    { header: 'Disbursement Date', key: 'receiving_date', width: 16, align: 'center', isDate: true },
    { header: 'Status', key: 'dis_status', width: 14, align: 'center' },
    { header: 'Donation Serial', key: 'don_serial', width: 16 },
    { header: 'Decree Amount', key: 'don_amount', width: 16, align: 'right', isAmount: true },
    { header: 'App Serial', key: 'app_serial', width: 14 },
    { header: 'Bank Name', key: 'bank_name', width: 18 }
  ];

  const handleExport = (type: 'excel' | 'word' | 'pdf') => {
    const opts = {
      title: 'Consolidated Company Court Ledger',
      settings,
      columns: exportCols,
      rows: masterRecords,
      orientation: 'landscape' as const
    };
    if (type === 'excel') exportToExcel(opts);
    if (type === 'word') exportToDocx(opts);
    if (type === 'pdf') exportToPdf(opts);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0f3a5d]" />
            Consolidated Court Pipeline Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full relational lineage trace: Application Petition ➔ Decreed Donation ➔ Beneficiary Disbursement
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

      {/* Search */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search across case numbers, entities, receivers, and banks..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>
        <span className="text-xs text-slate-500">
          <strong className="font-mono text-slate-800">{masterRecords.length}</strong> joined rows
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
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
                <th className="py-2.5 px-3 bg-sky-950">Linked Donation</th>
                <th className="py-2.5 px-3 text-right bg-sky-950">Decreed Amount</th>
                <th className="py-2.5 px-3 bg-teal-950">Application / Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {masterRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No joined records available. Complete applications, donations, and disbursement records will appear here connected.
                  </td>
                </tr>
              ) : (
                masterRecords.map((r: any, idx: number) => (
                  <tr key={`master-${r.dis_id || idx}`} className="hover:bg-slate-50 transition-colors">
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
                      {r.dis_amount ? Number(r.dis_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-900">{r.receiver_name || '-'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.receiver_phone || ''}</div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="font-semibold text-slate-700">{r.dis_status || 'New Entry'}</span>
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
                      {r.don_amount ? Number(r.don_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2 px-3 bg-teal-50/30">
                      {r.app_id ? (
                        <button
                          onClick={() => openApplicationModal(r.app_id)}
                          className="text-teal-800 hover:underline"
                        >
                          {r.app_serial || `App #${r.app_id}`} {r.bank_name ? `· ${r.bank_name}` : ''}
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">No link</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
