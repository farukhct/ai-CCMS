import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  downloadCsvTemplate,
  parseUploadedCsv,
  validateApplicationRows,
  validateDonationRows,
  validateDisbursementRows
} from '../../services/csvService';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { disbursementRepo } from '../../database/repositories/disbursementRepo';
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
  RotateCcw
} from 'lucide-react';

export const ImportView: React.FC = () => {
  const { addToast, currentUser, settings } = useApp();

  const [targetModule, setTargetModule] = useState<'applications' | 'donations' | 'disbursements'>('applications');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportValidationRow[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update' | 'insert'>('skip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportSummary(null);

    try {
      const rawData = await parseUploadedCsv(selectedFile);
      if (rawData.length === 0) {
        addToast('Uploaded CSV file contains no data rows.', 'warning');
        setParsedRows([]);
        return;
      }

      let validated: ImportValidationRow[] = [];
      if (targetModule === 'applications') {
        validated = validateApplicationRows(rawData);
      } else if (targetModule === 'donations') {
        validated = validateDonationRows(rawData);
      } else {
        validated = validateDisbursementRows(rawData);
      }

      setParsedRows(validated);
      addToast(`Parsed ${validated.length} rows from ${selectedFile.name}`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Error parsing CSV file.', 'error');
    }
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;

    setIsProcessing(true);
    let imported = 0;
    let skipped = 0;
    let errorsCount = 0;

    try {
      transaction(() => {
        for (const row of parsedRows) {
          // If row has blocking errors, skip
          if (row.errors.length > 0) {
            errorsCount++;
            continue;
          }

          if (row.isDuplicate) {
            if (duplicatePolicy === 'skip') {
              skipped++;
              continue;
            } else if (duplicatePolicy === 'update') {
              // Update existing record by serial number
              const serial = row.data.serial_number;
              if (targetModule === 'applications') {
                const existing = applicationRepo.getBySerialNumber(serial);
                if (existing) applicationRepo.update(existing.id, row.data);
                else applicationRepo.create(row.data, currentUser?.username);
              } else if (targetModule === 'donations') {
                const matched = donationRepo.getAll({ search: serial, pageSize: 1 });
                if (matched.data.length > 0) donationRepo.update(matched.data[0].id, row.data);
                else donationRepo.create(row.data, currentUser?.username);
              } else {
                const matched = disbursementRepo.getAll({ search: serial, pageSize: 1 });
                if (matched.data.length > 0) disbursementRepo.update(matched.data[0].id, row.data);
                else disbursementRepo.create(row.data, currentUser?.username);
              }
              imported++;
              continue;
            }
          }

          // Insert new record
          if (targetModule === 'applications') {
            applicationRepo.create(row.data, currentUser?.username);
          } else if (targetModule === 'donations') {
            donationRepo.create(row.data, currentUser?.username);
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
            imported,
            skipped,
            errorsCount,
            'COMPLETED',
            new Date().toISOString()
          ]
        );
      });

      auditRepo.log('CSV_IMPORT', targetModule.toUpperCase(), null, `Imported ${imported} rows into ${targetModule} (Skipped: ${skipped}, Errors: ${errorsCount})`, currentUser || undefined);

      setImportSummary({
        total: parsedRows.length,
        imported,
        skipped,
        errors: errorsCount
      });
      addToast(`Import finished: ${imported} imported, ${skipped} skipped.`, 'success');
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
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0f3a5d]" />
            Bulk CSV Data Import
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Safely ingest records with validation, Bengali UTF-8 encoding support, and preview
          </p>
        </div>

        {/* Template Downloads */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsvTemplate('applications')}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-teal-700" />
            Application Template
          </button>
          <button
            onClick={() => downloadCsvTemplate('donations')}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-700" />
            Donation Template
          </button>
          <button
            onClick={() => downloadCsvTemplate('disbursements')}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-700" />
            Disbursement Template
          </button>
        </div>
      </div>

      {/* Step 1: Select Module & Upload */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              1. Target Module
            </label>
            <select
              value={targetModule}
              onChange={e => {
                setTargetModule(e.target.value as any);
                setParsedRows([]);
                setImportSummary(null);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
            >
              <option value="applications">Applications Register</option>
              <option value="donations">Donations Register</option>
              <option value="disbursements">Disbursements Register</option>
            </select>
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
              <option value="insert">Insert as separate records</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              3. Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-700 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Summary Box if executed */}
      {importSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-sm">Batch Import Completed Successfully</h3>
              <p className="text-emerald-700 mt-0.5">
                Total Rows: {importSummary.total} · Imported: {importSummary.imported} · Skipped: {importSummary.skipped} · Errors: {importSummary.errors}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && !importSummary && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Pre-Import Verification ({parsedRows.length} rows previewed)
              </h2>
              <p className="text-[11px] text-slate-500">
                Review validation issues and duplicate tags before committing to SQLite.
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
                Commit Import to Database
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2 px-3 w-14 text-center">Row</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Serial / Key</th>
                  <th className="py-2 px-3">Primary Content</th>
                  <th className="py-2 px-3">Validation Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {parsedRows.map(row => (
                  <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-rose-50/50' : row.isDuplicate ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                      {row.rowNumber}
                    </td>
                    <td className="py-2 px-3">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Invalid
                        </span>
                      ) : row.isDuplicate ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Duplicate
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">
                      {row.data.serial_number || row.data.case_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {row.data.donation_name || row.data.receiver_name || '-'}
                    </td>
                    <td className="py-2 px-3">
                      {row.errors.length > 0 && (
                        <div className="text-rose-600 font-medium">
                          {row.errors.join('; ')}
                        </div>
                      )}
                      {row.warnings.length > 0 && (
                        <div className="text-amber-700 text-[11px]">
                          {row.warnings.join('; ')}
                        </div>
                      )}
                      {row.errors.length === 0 && row.warnings.length === 0 && (
                        <span className="text-slate-400">All checks passed</span>
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
