import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { donationRepo } from '../../database/repositories/donationRepo';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DonationRecord, ApplicationRecord } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { X, Sparkles, AlertCircle, Building2, Link as LinkIcon, Unlink, Plus } from 'lucide-react';

interface Props {
  recordId: number | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export const DonationFormModal: React.FC<Props> = ({ recordId, onClose, onSaved }) => {
  const { currentUser, addToast, showConfirm, settings } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [donationName, setDonationName] = useState('');
  const [isManualName, setIsManualName] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [judgementDate, setJudgementDate] = useState(''); // Canonical YYYY-MM-DD
  const [remarks, setRemarks] = useState('');

  // Dropdown options from Applications
  const [availableApplications, setAvailableApplications] = useState<ApplicationRecord[]>([]);
  const [matchedApp, setMatchedApp] = useState<ApplicationRecord | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    // Load all applications that have donation_name or id
    const res = applicationRepo.getAll({ pageSize: 500, sortBy: 'donation_name', sortOrder: 'ASC' });
    setAvailableApplications(res.data);
  }, []);

  useEffect(() => {
    if (isEdit && recordId) {
      const existing = donationRepo.getById(recordId);
      if (existing) {
        setSerialNumber(existing.serial_number || '');
        setCaseNumber(existing.case_number || '');
        setSelectedAppId(existing.application_id ?? null);
        setDonationName(existing.donation_name || '');
        setIsManualName(existing.is_unlinked === 1);
        setDonationAmount(existing.donation_amount !== null && existing.donation_amount !== undefined ? String(existing.donation_amount) : '');
        setJudgementDate(existing.judgement_date || '');
        setRemarks(existing.remarks || '');

        if (existing.application_id) {
          const app = applicationRepo.getById(existing.application_id);
          setMatchedApp(app);
        }
      }
    } else if (recordId === null) {
      setSerialNumber(donationRepo.getNextSerialNumber());
      setCaseNumber('');
      setSelectedAppId(null);
      setDonationName('');
      setIsManualName(false);
      setDonationAmount('');
      setJudgementDate('');
      setRemarks('');
      setMatchedApp(null);
    }
  }, [recordId, isEdit]);

  // When selected application changes from dropdown
  const handleSelectApplication = (appIdStr: string) => {
    if (!appIdStr) {
      setSelectedAppId(null);
      setMatchedApp(null);
      setDonationName('');
      return;
    }

    const id = parseInt(appIdStr, 10);
    setSelectedAppId(id);
    const app = applicationRepo.getById(id);
    if (app) {
      setMatchedApp(app);
      setDonationName(app.donation_name);
      setIsManualName(false);
    }
  };

  // Check possible duplicate case number & donation name
  const handleCheckDuplicate = () => {
    if (caseNumber.trim() && donationName.trim()) {
      const dups = donationRepo.checkPossibleDuplicate(caseNumber.trim(), donationName.trim(), isEdit ? recordId! : undefined);
      if (dups.length > 0) {
        setDuplicateWarning(`A donation entry for Case "${caseNumber}" with entity "${donationName}" already exists in record #${dups[0].id}.`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleGenerateSerial = () => {
    const next = donationRepo.getNextSerialNumber();
    setSerialNumber(next);
  };

  const resetForm = () => {
    setSerialNumber(donationRepo.getNextSerialNumber());
    setCaseNumber('');
    setSelectedAppId(null);
    setMatchedApp(null);
    setDonationName('');
    setDonationAmount('');
    setRemarks('');
    setDuplicateWarning(null);
    setIsManualName(false);
  };

  const doSave = (addAnotherMode?: boolean) => {
    try {
      const cleanAmount = donationAmount.trim() ? parseFloat(donationAmount.replace(/,/g, '')) : null;

      const payload: Partial<DonationRecord> = {
        serial_number: serialNumber.trim(),
        case_number: caseNumber.trim(),
        application_id: isManualName ? null : selectedAppId,
        donation_name: donationName.trim(),
        donation_amount: cleanAmount,
        judgement_date: judgementDate.trim(),
        remarks: remarks.trim(),
        is_unlinked: isManualName || !selectedAppId ? 1 : 0
      };

      const willKeepOpen = !isEdit && (addAnotherMode !== undefined ? addAnotherMode : keepOpen);

      if (isEdit && recordId) {
        const updated = donationRepo.update(recordId, payload);
        auditRepo.log('UPDATE_RECORD', 'Donations', updated.id, `Updated Donation #${updated.id} (Case: ${updated.case_number || 'N/A'})`, currentUser || undefined);
        addToast('Donation updated successfully.', 'success');
        onSaved();
        onClose();
      } else {
        const created = donationRepo.create(payload, currentUser?.username);
        auditRepo.log('CREATE_RECORD', 'Donations', created.id, `Created Donation #${created.id} (Case: ${created.case_number || 'N/A'})`, currentUser || undefined);
        onSaved();

        if (willKeepOpen) {
          addToast('Donation created successfully! Ready for next entry.', 'success');
          resetForm();
        } else {
          addToast('Donation created successfully.', 'success');
          onClose();
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Error saving donation entry.', 'error');
    }
  };

  const handleSubmit = (e?: React.FormEvent, addAnotherMode?: boolean) => {
    if (e) e.preventDefault();

    // Case Number is strictly required
    if (!caseNumber || !caseNumber.trim()) {
      addToast('Case Number is required for Donation records.', 'error');
      return;
    }

    // Judgement Date is strictly required
    if (!judgementDate || !judgementDate.trim()) {
      addToast('Judgement Date is required for Donation records.', 'error');
      return;
    }

    const isCompletelyBlank =
      !serialNumber.trim() &&
      !donationName.trim() &&
      !donationAmount.trim() &&
      !remarks.trim();

    if (isCompletelyBlank && settings.requireConfirmBlank) {
      showConfirm({
        title: 'Save Blank Donation Record?',
        message: 'All optional fields other than Case Number and Judgement Date are blank in this donation record. Would you like to proceed?',
        confirmLabel: 'Save Donation Record',
        onConfirm: () => doSave(addAnotherMode)
      });
      return;
    }

    doSave(addAnotherMode);
  };

  if (recordId === undefined) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-2xl w-full flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0f3a5d] text-white flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-sm font-bold tracking-wide">
              {isEdit ? `Edit Donation Entry #${recordId}` : 'New Donation Entry'}
            </h2>
            <p className="text-[11px] text-slate-300">
              Links to Application Entry or permits standalone unlinked records
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {duplicateWarning && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Row 1: Serial & Case Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Serial Number (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSerial}
                  className="text-[11px] text-teal-700 hover:text-teal-900 flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Gen
                </button>
              </div>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="e.g. DON-00001"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Case Number <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                onBlur={handleCheckDuplicate}
                placeholder="e.g. CC-104/2026 or Company Matter 42/2025"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">
                * Case Number is required
              </span>
            </div>
          </div>

          {/* Row 2: Linked Donation Name Selection */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#0f3a5d]" />
                Donation Name Selection
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualName(!isManualName);
                  if (!isManualName) {
                    setSelectedAppId(null);
                    setMatchedApp(null);
                  }
                }}
                className="text-[11px] text-teal-800 hover:underline flex items-center gap-1"
              >
                {isManualName ? (
                  <>
                    <LinkIcon className="w-3 h-3" />
                    Switch to Linked Application Dropdown
                  </>
                ) : (
                  <>
                    <Unlink className="w-3 h-3" />
                    Enter Custom Unlinked Name
                  </>
                )}
              </button>
            </div>

            {!isManualName ? (
              <div>
                <select
                  value={selectedAppId || ''}
                  onChange={e => handleSelectApplication(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">-- Select from Registered Applications --</option>
                  {availableApplications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.donation_name || `[Application #${app.id}]`} {app.serial_number ? `(${app.serial_number})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Select an application to preserve internal relational linkage.
                </span>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={donationName}
                  onChange={e => setDonationName(e.target.value)}
                  onBlur={handleCheckDuplicate}
                  placeholder="Enter custom donation name (will be flagged as Unlinked)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
                <span className="text-[10px] text-amber-700 mt-0.5 block">
                  Note: Manually entered names are marked as unlinked.
                </span>
              </div>
            )}

            {/* Matched Application Preview Card */}
            {matchedApp && (
              <div className="mt-2 p-2.5 bg-white rounded border border-slate-200 text-[11px] space-y-1">
                <div className="font-semibold text-slate-800">
                  Linked Application Record: #{matchedApp.id} ({matchedApp.serial_number || 'No Serial'})
                </div>
                <div className="text-slate-600">
                  <span className="text-slate-400">Address:</span> {matchedApp.address || '-'} · <span className="text-slate-400">Phone:</span> {matchedApp.phone_number || '-'}
                </div>
                <div className="text-slate-600">
                  <span className="text-slate-400">Bank:</span> {matchedApp.bank_name || '-'} ({matchedApp.branch_name || '-'}) · <span className="text-slate-400">A/C:</span> {matchedApp.bank_account_number || '-'}
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Amount & Judgement Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Donation Amount ({settings.currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-mono">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={donationAmount}
                  onChange={e => setDonationAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>

            <div>
              <DatePicker
                label="Judgement Date *"
                value={judgementDate}
                onChange={setJudgementDate}
                placeholder="dd-MM-yyyy"
                required={true}
              />
              <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">
                * Judgement Date is required
              </span>
            </div>
          </div>

          {/* Row 4: Remarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Court judgment notes, decree references"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 italic">
                <strong className="text-rose-600 font-bold">*</strong> Case Number and Judgement Date are required.
              </span>
              {!isEdit && (
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none font-medium hover:text-teal-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={keepOpen}
                    onChange={e => setKeepOpen(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-700 w-3.5 h-3.5"
                  />
                  <span>Keep form open to enter data several times</span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-medium transition-colors shadow-xs flex items-center gap-1.5"
                  title="Save and keep form open to enter another donation"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Add Another
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded font-semibold transition-colors shadow-xs"
              >
                {isEdit ? 'Update Donation' : 'Save Donation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
