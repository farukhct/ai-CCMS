import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  downloadCsvTemplate,
  downloadExcelTemplate,
  parseUploadedFile,
  validateApplicationRows,
  validateDonationRows,
  validatePayOrderRows,
  validateDisbursementRows,
  ImportModuleKey
} from '../../services/csvService';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { disbursementRepo } from '../../database/repositories/disbursementRepo';
import { payOrderRepo } from '../../database/repositories/payOrderRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { run, transaction } from '../../database/engine';
import { ImportValidationRow } from '../../types';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Layers,
  Sparkles,
  CreditCard,
  FileCheck
} from 'lucide-react';

export const ImportView: React.FC = () => {
  const { addToast, currentUser, settings, refreshData, setActiveTab } = useApp();

  const [targetModule, setTargetModule] = useState<ImportModuleKey>('applications');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportValidationRow[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update' | 'insert'>('skip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportSummary(null);

    try {
      const rawData = await parseUploadedFile(selectedFile);
      if (rawData.length === 0) {
        addToast('Uploaded file contains no data rows or headers could not be found.', 'warning');
        setParsedRows([]);
        return;
      }

      let validated: ImportValidationRow[] = [];
      if (targetModule === 'applications') {
        validated = validateApplicationRows(rawData);
      } else if (targetModule === 'donations') {
        validated = validateDonationRows(rawData);
      } else if (targetModule === 'pay_orders') {
        validated = validatePayOrderRows(rawData);
      } else {
        validated = validateDisbursementRows(rawData);
      }

      setParsedRows(validated);
      addToast(
        `Parsed ${validated.length} rows from "${selectedFile.name}" for ${getModuleName(targetModule)}`,
        'info'
      );
    } catch (err: any) {
      addToast(err.message || 'Error parsing imported file. Please check format.', 'error');
    }
  };

  const getModuleName = (key: ImportModuleKey): string => {
    switch (key) {
      case 'applications':
        return 'Applications Register';
      case 'donations':
        return 'Donations Register';
      case 'pay_orders':
        return 'Pay Order Entry & Register';
      case 'disbursements':
        return 'Disbursements Register';
    }
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;

    setIsProcessing(true);
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errorsCount = 0;

    try {
      transaction(() => {
        for (const row of parsedRows) {
          // If row has fatal blocking errors, skip
          if (row.errors.length > 0) {
            errorsCount++;
            continue;
          }

          // Ensure sequential serial number if missing from spreadsheet
          if (!row.data.serial_number || !String(row.data.serial_number).trim()) {
            if (targetModule === 'applications') {
              row.data.serial_number = applicationRepo.getNextSerialNumber();
            } else if (targetModule === 'donations') {
              row.data.serial_number = donationRepo.getNextSerialNumber();
            } else if (targetModule === 'pay_orders') {
              row.data.serial_number = payOrderRepo.getNextSerialNumber();
            } else {
              row.data.serial_number = disbursementRepo.getNextSerialNumber();
            }
          }

          if (row.isDuplicate) {
            if (duplicatePolicy === 'skip') {
              skipped++;
              continue;
            } else if (duplicatePolicy === 'update') {
              // Update existing record by serial number or key
              const serial = row.data.serial_number;
              if (targetModule === 'applications') {
                const existing = applicationRepo.getBySerialNumber(serial);
                if (existing) applicationRepo.update(existing.id, row.data);
                else applicationRepo.create(row.data, currentUser?.username);
              } else if (targetModule === 'donations') {
                const matched = donationRepo.getAll({ search: serial, pageSize: 1 });
                if (matched.data.length > 0) donationRepo.update(matched.data[0].id, row.data);
                else donationRepo.create(row.data, currentUser?.username);
              } else if (targetModule === 'pay_orders') {
                const matched = payOrderRepo.getAll({ search: serial, pageSize: 1 });
                if (matched.data.length > 0) payOrderRepo.update(matched.data[0].id, row.data);
                else payOrderRepo.create(row.data, currentUser?.username);
              } else {
                const matched = disbursementRepo.getAll({ search: serial, pageSize: 1 });
                if (matched.data.length > 0) disbursementRepo.update(matched.data[0].id, row.data);
                else disbursementRepo.create(row.data, currentUser?.username);
              }
              updated++;
              continue;
            } else if (duplicatePolicy === 'insert') {
              // Generate fresh non-colliding serial number for new record
              if (targetModule === 'applications') {
                row.data.serial_number = applicationRepo.getNextSerialNumber();
              } else if (targetModule === 'donations') {
                row.data.serial_number = donationRepo.getNextSerialNumber();
              } else if (targetModule === 'pay_orders') {
                row.data.serial_number = payOrderRepo.getNextSerialNumber();
              } else {
                row.data.serial_number = disbursementRepo.getNextSerialNumber();
              }
            }
          }

          // Insert new record
          if (targetModule === 'applications') {
            applicationRepo.create(row.data, currentUser?.username);
          } else if (targetModule === 'donations') {
            donationRepo.create(row.data, currentUser?.username);
          } else if (targetModule === 'pay_orders') {
            payOrderRepo.create(row.data, currentUser?.username);
          } else {
            disbursementRepo.create(row.data, currentUser?.username);
          }
          imported++;
        }

        // Record import job in DB
        run(
          `INSERT INTO ImportJobs (module_name, filename, total_rows, imported_rows, skipped_rows, error_rows, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            targetModule,
            file?.name || 'import.csv',
            parsedRows.length,
            imported + updated,
            skipped,
            errorsCount,
            'COMPLETED',
            new Date().toISOString()
          ]
        );
      });

      // Audit log
      auditRepo.log(
        'CSV_IMPORT',
        targetModule.toUpperCase(),
        null,
        `Imported ${imported} new rows, updated ${updated} rows in ${targetModule} (Skipped: ${skipped}, Errors: ${errorsCount}) from "${file?.name || 'file'}"`,
        currentUser || undefined
      );

      // Crucial: refresh context so all views immediately display imported records!
      refreshData();

      setImportSummary({
        total: parsedRows.length,
        imported,
        updated,
        skipped,
        errors: errorsCount
      });
      addToast(
        `Import successful: ${imported} imported, ${updated} updated, ${skipped} skipped.`,
        'success'
      );
    } catch (err: any) {
      addToast(`Import transaction failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setImportSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const navigateToTargetView = () => {
    switch (targetModule) {
      case 'applications':
        setActiveTab('applications');
        break;
      case 'donations':
        setActiveTab('donations');
        break;
      case 'pay_orders':
        setActiveTab('pay_orders');
        break;
      case 'disbursements':
        setActiveTab('disbursements');
        break;
    }
  };

  const isExcel = file?.name?.toLowerCase().endsWith('.xlsx') || file?.name?.toLowerCase().endsWith('.xls');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0f3a5d]" />
            Bulk Data Import (Excel & CSV)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingest and verify records with automatic header matching, UTF-8 Bengali support, and instant database refresh.
          </p>
        </div>

        {/* Template Downloads (CSV & Excel) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Download Templates:
          </div>
          <div className="inline-flex rounded-md shadow-2xs">
            <button
              onClick={() => downloadExcelTemplate('applications')}
              title="Download Excel (.xlsx) Application Template"
              className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-l text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              Apps (XLSX)
            </button>
            <button
              onClick={() => downloadCsvTemplate('applications')}
              title="Download CSV Application Template"
              className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-t border-b border-r border-slate-300 rounded-r text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              CSV
            </button>
          </div>

          <div className="inline-flex rounded-md shadow-2xs">
            <button
              onClick={() => downloadExcelTemplate('donations')}
              title="Download Excel (.xlsx) Donation Template"
              className="px-2 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-l text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
              Donations (XLSX)
            </button>
            <button
              onClick={() => downloadCsvTemplate('donations')}
              title="Download CSV Donation Template"
              className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-t border-b border-r border-slate-300 rounded-r text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              CSV
            </button>
          </div>

          <div className="inline-flex rounded-md shadow-2xs">
            <button
              onClick={() => downloadExcelTemplate('pay_orders')}
              title="Download Excel (.xlsx) Pay Order Register Template"
              className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-l text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-sky-700" />
              Pay Orders (XLSX)
            </button>
            <button
              onClick={() => downloadCsvTemplate('pay_orders')}
              title="Download CSV Pay Order Template"
              className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-t border-b border-r border-slate-300 rounded-r text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              CSV
            </button>
          </div>

          <div className="inline-flex rounded-md shadow-2xs">
            <button
              onClick={() => downloadExcelTemplate('disbursements')}
              title="Download Excel (.xlsx) Disbursement Template"
              className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-l text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-700" />
              Disb (XLSX)
            </button>
            <button
              onClick={() => downloadCsvTemplate('disbursements')}
              title="Download CSV Disbursement Template"
              className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-t border-b border-r border-slate-300 rounded-r text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Step 1: Configuration Form */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              1. Target Registry
            </label>
            <select
              value={targetModule}
              onChange={e => {
                setTargetModule(e.target.value as ImportModuleKey);
                setParsedRows([]);
                setImportSummary(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setFile(null);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="applications">Applications Register</option>
              <option value="donations">Donations Register (Decrees)</option>
              <option value="pay_orders">Pay Order Entry & Register</option>
              <option value="disbursements">Disbursements Register</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {targetModule === 'applications' && 'Company applications with petitioner, address, and judicial bank accounts.'}
              {targetModule === 'donations' && 'Court-decreed fund amounts with case numbers and judgement dates.'}
              {targetModule === 'pay_orders' && 'Bank pay orders with instrument numbers, dates, amounts, and issuing banks.'}
              {targetModule === 'disbursements' && 'Payment payouts, receiver details, linked pay orders, and status.'}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              2. Duplicate Conflict Policy
            </label>
            <select
              value={duplicatePolicy}
              onChange={e => setDuplicatePolicy(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="skip">Skip duplicates (Recommended)</option>
              <option value="update">Update existing matched records</option>
              <option value="insert">Insert as new records (auto-renumber)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Determines system behavior if a serial number or key already exists in CCMS.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              3. Select File (.xlsx, .xls, .csv)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-700 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
            />
            {file && (
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isExcel ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {isExcel ? 'Excel Workbook' : 'CSV Text'}
                </span>
                <span className="text-slate-600 truncate max-w-[200px]" title={file.name}>
                  {file.name}
                </span>
                <span className="text-slate-400 text-[10px]">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post-Import Success Summary Card */}
      {importSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-xs text-emerald-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-full">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-emerald-950">
                  Data Import Successfully Committed to Database!
                </h3>
                <p className="text-emerald-800 mt-0.5">
                  All imported records are now active in the CCMS database, indexed for search, and included in court reports.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={navigateToTargetView}
                className="px-4 py-2 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>View {getModuleName(targetModule)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-emerald-200/60">
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Rows</div>
              <div className="text-lg font-bold text-slate-900">{importSummary.total}</div>
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <div className="text-[10px] font-semibold text-emerald-700 uppercase">New Records</div>
              <div className="text-lg font-bold text-emerald-700">+{importSummary.imported}</div>
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <div className="text-[10px] font-semibold text-sky-700 uppercase">Updated Records</div>
              <div className="text-lg font-bold text-sky-700">{importSummary.updated}</div>
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <div className="text-[10px] font-semibold text-amber-700 uppercase">Skipped</div>
              <div className="text-lg font-bold text-amber-700">{importSummary.skipped}</div>
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <div className="text-[10px] font-semibold text-rose-700 uppercase">Errors</div>
              <div className="text-lg font-bold text-rose-700">{importSummary.errors}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Import Verification Table */}
      {parsedRows.length > 0 && !importSummary && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-700" />
                Pre-Import Verification ({parsedRows.length} rows parsed from file)
              </h2>
              <p className="text-[11px] text-slate-500">
                Review data columns and status before committing to SQLite database. Invalid rows will be skipped safely.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] disabled:opacity-50 text-white rounded font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5"
              >
                <span>Commit & Ingest into Database</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[55vh] border border-slate-100 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                  <th className="py-2.5 px-3 w-12 text-center">Row</th>
                  <th className="py-2.5 px-3 w-28">Status</th>
                  <th className="py-2.5 px-3 w-32">Serial No</th>
                  <th className="py-2.5 px-3 w-40">Case / Order No</th>
                  <th className="py-2.5 px-3">Primary Details</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount</th>
                  <th className="py-2.5 px-3 w-48">Validation Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {parsedRows.map(row => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.errors.length > 0
                        ? 'bg-rose-50/60'
                        : row.isDuplicate
                        ? 'bg-amber-50/60'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                      {row.rowNumber}
                    </td>
                    <td className="py-2 px-3">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-700 font-bold flex items-center gap-1 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" /> Invalid
                        </span>
                      ) : row.isDuplicate ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Duplicate
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">
                      {row.data.serial_number || (
                        <span className="text-slate-400 italic">Auto-assign</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {row.data.case_number || row.data.pay_order_number || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-800">
                      <div className="font-semibold text-slate-900">
                        {row.data.donation_name || row.data.receiver_name || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {row.data.bank_name ? `${row.data.bank_name} (${row.data.branch_name || 'Main'})` : ''}
                        {row.data.judgement_date ? ` · Judgement: ${row.data.judgement_date}` : ''}
                        {row.data.po_date ? ` · PO Date: ${row.data.po_date}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-teal-800">
                      {row.data.donation_amount !== null && row.data.donation_amount !== undefined
                        ? `${settings.currencySymbol} ${Number(row.data.donation_amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}`
                        : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {row.errors.length > 0 && (
                        <div className="text-rose-600 font-medium text-[11px]">
                          {row.errors.join('; ')}
                        </div>
                      )}
                      {row.warnings.length > 0 && (
                        <div className="text-amber-700 text-[11px]">
                          {row.warnings.join('; ')}
                        </div>
                      )}
                      {row.errors.length === 0 && row.warnings.length === 0 && (
                        <span className="text-slate-400 text-[11px]">Ready for ingestion</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
