import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { disbursementRepo } from '../../database/repositories/disbursementRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DisbursementRecord, DisbursementStatus } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { toCanonicalDate, toDisplayDate } from '../../services/dateUtils';
import { X, Sparkles, AlertCircle, Coins, Link as LinkIcon, Unlink, CheckCircle2, Plus } from 'lucide-react';

interface Props {
  recordId: number | null | undefined;
  initialDonationId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export const DisbursementFormModal: React.FC<Props> = ({ recordId, initialDonationId, onClose, onSaved }) => {
  const { currentUser, addToast, showConfirm, settings } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [selectedDonationId, setSelectedDonationId] = useState<number | null>(null);
  const [caseNumber, setCaseNumber] = useState('');
  const [donationName, setDonationName] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receivingDate, setReceivingDate] = useState(''); // Canonical YYYY-MM-DD (Disbursement Date)
  const [judgementDate, setJudgementDate] = useState(''); // Canonical YYYY-MM-DD
  const [status, setStatus] = useState<DisbursementStatus>('New Entry');
  const [remarks, setRemarks] = useState('');

  const [availableDonations, setAvailableDonations] = useState<any[]>([]);
  const [matchedDonation, setMatchedDonation] = useState<any | null>(null);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    // Load selectable donations
    const list = donationRepo.getSelectableDonations();
    setAvailableDonations(list);

    if (isEdit && recordId) {
      const existing = disbursementRepo.getById(recordId);
      if (existing) {
        setSerialNumber(existing.serial_number || '');
        setSelectedDonationId(existing.donation_id ?? null);
        setCaseNumber(existing.case_number || '');
        setDonationName(existing.donation_name || '');
        setDonationAmount(existing.donation_amount !== null && existing.donation_amount !== undefined ? String(existing.donation_amount) : '');
        setReceiverName(existing.receiver_name || '');
        setReceiverPhone(existing.receiver_phone || '');
        setReceivingDate(existing.receiving_date || '');
        setJudgementDate(existing.judgement_date || '');
        setStatus(existing.status || 'New Entry');
        setRemarks(existing.remarks || '');
        setIsManualOverride(existing.is_unlinked === 1);

        if (existing.donation_id) {
          const don = donationRepo.getById(existing.donation_id);
          setMatchedDonation(don);
        }
      }
    } else if (recordId === null) {
      // New Disbursement: Auto-populate donation record
      setSerialNumber(disbursementRepo.getNextSerialNumber());
      setReceiverName('');
      setReceiverPhone('');
      setReceivingDate('');
      setStatus('New Entry');
      setRemarks('');

      const targetDonId = initialDonationId || (list.length > 0 ? list[0].id : null);
      if (targetDonId) {
        const don = donationRepo.getById(targetDonId);
        if (don) {
          setSelectedDonationId(don.id);
          setMatchedDonation(don);
          setCaseNumber(don.case_number || '');
          setDonationName(don.donation_name || '');
          setDonationAmount(don.donation_amount !== null && don.donation_amount !== undefined ? String(don.donation_amount) : '');
          setJudgementDate(don.judgement_date || '');
          setIsManualOverride(false);
          return;
        }
      }

      setSelectedDonationId(null);
      setCaseNumber('');
      setDonationName('');
      setDonationAmount('');
      setJudgementDate('');
      setMatchedDonation(null);
      setIsManualOverride(false);
    }
  }, [recordId, isEdit, initialDonationId]);

  // When user selects a donation record from dropdown
  const handleSelectDonation = (donIdStr: string) => {
    if (!donIdStr) {
      setSelectedDonationId(null);
      setMatchedDonation(null);
      return;
    }

    const id = parseInt(donIdStr, 10);
    setSelectedDonationId(id);
    const don = donationRepo.getById(id);
    if (don) {
      setMatchedDonation(don);
      setCaseNumber(don.case_number || '');
      setDonationName(don.donation_name || '');
      setDonationAmount(don.donation_amount !== null && don.donation_amount !== undefined ? String(don.donation_amount) : '');
      setJudgementDate(don.judgement_date || '');
      setIsManualOverride(false);
    }
  };

  const handleCheckDuplicate = () => {
    if (caseNumber.trim() && receiverName.trim()) {
      const dups = disbursementRepo.checkPossibleDuplicate(caseNumber.trim(), receiverName.trim(), isEdit ? recordId! : undefined);
      if (dups.length > 0) {
        setDuplicateWarning(`A disbursement for Case "${caseNumber}" to receiver "${receiverName}" already exists in record #${dups[0].id}.`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleGenerateSerial = () => {
    const next = disbursementRepo.getNextSerialNumber();
    setSerialNumber(next);
  };

  const resetForm = () => {
    setSerialNumber(disbursementRepo.getNextSerialNumber());
    setSelectedDonationId(null);
    setMatchedDonation(null);
    setCaseNumber('');
    setDonationName('');
    setDonationAmount('');
    setReceiverName('');
    setReceiverPhone('');
    setReceivingDate('');
    setJudgementDate('');
    setStatus('New Entry');
    setRemarks('');
    setIsManualOverride(false);
    setDuplicateWarning(null);
    setAvailableDonations(donationRepo.getSelectableDonations());
  };

  const doSave = (addAnotherMode?: boolean) => {
    try {
      const cleanAmount = donationAmount.trim() ? parseFloat(donationAmount.replace(/,/g, '')) : null;

      const payload: Partial<DisbursementRecord> = {
        serial_number: serialNumber.trim(),
        donation_id: isManualOverride ? null : selectedDonationId,
        case_number: caseNumber.trim(),
        donation_name: donationName.trim(),
        donation_amount: cleanAmount,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        receiving_date: receivingDate.trim(),
        judgement_date: judgementDate.trim(),
        status: status,
        remarks: remarks.trim(),
        is_unlinked: isManualOverride || !selectedDonationId ? 1 : 0
      };

      const willKeepOpen = !isEdit && (addAnotherMode !== undefined ? addAnotherMode : keepOpen);

      if (isEdit && recordId) {
        const updated = disbursementRepo.update(recordId, payload);
        auditRepo.log('UPDATE_RECORD', 'Disbursements', updated.id, `Updated Disbursement #${updated.id} (Status: ${updated.status})`, currentUser || undefined);
        addToast('Disbursement updated successfully.', 'success');
        onSaved();
        onClose();
      } else {
        const created = disbursementRepo.create(payload, currentUser?.username);
        auditRepo.log('CREATE_RECORD', 'Disbursements', created.id, `Created Disbursement #${created.id} (Status: ${created.status})`, currentUser || undefined);
        onSaved();

        if (willKeepOpen) {
          addToast('Disbursement created successfully! Ready for next entry.', 'success');
          resetForm();
        } else {
          addToast('Disbursement created successfully.', 'success');
          onClose();
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Error saving disbursement entry.', 'error');
    }
  };

  const handleReceiverPhoneChange = (val: string) => {
    // Only numeric values accepted, max length 11 characters
    const numericOnly = val.replace(/\D/g, '').slice(0, 11);
    setReceiverPhone(numericOnly);
  };

  const handleSubmit = (e?: React.FormEvent, addAnotherMode?: boolean) => {
    if (e) e.preventDefault();

    // Validation 1: Receiver Phone Number must be 11 numeric digits if provided
    if (receiverPhone.trim()) {
      if (receiverPhone.trim().length !== 11) {
        addToast('Receiver Phone Number must be exactly 11 digits (e.g. 01819000000).', 'error');
        return;
      }
      if (!/^\d{11}$/.test(receiverPhone.trim())) {
        addToast('Receiver Phone Number accepts only numeric values.', 'error');
        return;
      }
    }

    // Validation 2: Disbursement Date must be strictly less than Judgement Date
    if (receivingDate.trim() && judgementDate.trim()) {
      const cDisb = toCanonicalDate(receivingDate);
      const cJudg = toCanonicalDate(judgementDate);
      if (cDisb && cJudg && cDisb >= cJudg) {
        addToast(
          `Disbursement Date (${toDisplayDate(cDisb)}) must be less than Judgement Date (${toDisplayDate(cJudg)}).`,
          'error'
        );
        return;
      }
    }

    const isCompletelyBlank =
      !serialNumber.trim() &&
      !caseNumber.trim() &&
      !donationName.trim() &&
      !donationAmount.trim() &&
      !receiverName.trim() &&
      !receiverPhone.trim() &&
      !receivingDate.trim() &&
      !judgementDate.trim() &&
      !remarks.trim();

    if (isCompletelyBlank && settings.requireConfirmBlank) {
      showConfirm({
        title: 'Save Blank Disbursement Record?',
        message: 'All fields in this disbursement entry are blank. In accordance with CCMS rules, this will save an unpopulated pending record. Proceed?',
        confirmLabel: 'Save Blank Disbursement',
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
              {isEdit ? `Edit Disbursement Entry #${recordId}` : 'New Donation Disbursement'}
            </h2>
            <p className="text-[11px] text-slate-300">
              Populates from Donation records while allowing independent overrides
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

          {/* Row 1: Serial Number */}
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
                placeholder="e.g. DIS-00001"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Disbursement Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DisbursementStatus)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 font-medium"
              >
                <option value="New Entry">New Entry</option>
                <option value="Received">Received</option>
                <option value="Delivered">Delivered</option>
                <option value="Problem">Problem</option>
                <option value="Hold">Hold</option>
              </select>
            </div>
          </div>

          {/* Source Donation Population Box */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#0f3a5d]" />
                Select Source Donation Record
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualOverride(!isManualOverride);
                  if (!isManualOverride) {
                    setSelectedDonationId(null);
                    setMatchedDonation(null);
                  }
                }}
                className="text-[11px] text-teal-800 hover:underline flex items-center gap-1"
              >
                {isManualOverride ? (
                  <>
                    <LinkIcon className="w-3 h-3" />
                    Link to Registered Donation
                  </>
                ) : (
                  <>
                    <Unlink className="w-3 h-3" />
                    Enter Standalone Values
                  </>
                )}
              </button>
            </div>

            {!isManualOverride && (
              <div className="space-y-2">
                <select
                  value={selectedDonationId || ''}
                  onChange={e => handleSelectDonation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">-- Select from Existing Donations --</option>
                  {availableDonations.map(don => (
                    <option key={don.id} value={don.id}>
                      Record #{don.id}: {don.case_number ? `Case ${don.case_number}` : 'No Case'} · {don.donation_name || 'No Name'} {don.donation_amount ? `(${settings.currencySymbol} ${Number(don.donation_amount).toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>

                {selectedDonationId && (
                  <div className="p-2.5 bg-teal-50 border border-teal-200 rounded text-teal-900 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>Populated from Donation Record <strong>#{selectedDonationId}</strong> {caseNumber ? `(Case: ${caseNumber})` : ''}</span>
                    </div>
                    <span className="font-mono font-semibold text-teal-800">
                      {donationAmount ? `${settings.currencySymbol} ${parseFloat(donationAmount).toLocaleString()}` : ''}
                    </span>
                  </div>
                )}

                <span className="text-[10px] text-slate-400 block">
                  Donation records automatically populate Case Number, Entity Name, Amount, and Judgement Date.
                </span>
              </div>
            )}

            {/* Populated / Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Case Number
                </label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={e => setCaseNumber(e.target.value)}
                  placeholder="e.g. CC-104/2026"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Donation Entity Name
                </label>
                <input
                  type="text"
                  value={donationName}
                  onChange={e => setDonationName(e.target.value)}
                  placeholder="Entity name"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Amount ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={donationAmount}
                  onChange={e => setDonationAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Receiver Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Receiver Name
              </label>
              <input
                type="text"
                value={receiverName}
                onChange={e => setReceiverName(e.target.value)}
                onBlur={handleCheckDuplicate}
                placeholder="Full name of authorized recipient"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Receiver Phone (11-digit numeric)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={receiverPhone}
                onChange={e => handleReceiverPhoneChange(e.target.value)}
                placeholder="e.g. 01819000000 (11 digits)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {receiverPhone ? `${receiverPhone.length}/11 digits` : 'Only numeric values accepted (11 characters)'}
              </span>
            </div>
          </div>

          {/* Dates: Disbursement Date & Judgement Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <DatePicker
                label="Disbursement Date"
                value={receivingDate}
                onChange={setReceivingDate}
                placeholder="dd-MM-yyyy"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Must be less than Judgement Date
              </span>
            </div>

            <div>
              <DatePicker
                label="Judgement Date"
                value={judgementDate}
                onChange={setJudgementDate}
                placeholder="dd-MM-yyyy"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Populated from donation decree or entered
              </span>
            </div>
          </div>

          {/* Inline alert if Disbursement Date is not less than Judgement Date */}
          {receivingDate.trim() && judgementDate.trim() && toCanonicalDate(receivingDate) >= toCanonicalDate(judgementDate) && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-300 text-rose-800 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                <strong>Date Rule Conflict:</strong> Disbursement Date ({toDisplayDate(receivingDate)}) must be strictly less than Judgement Date ({toDisplayDate(judgementDate)}).
              </span>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Delivery receipts, cheque details, witness notes"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 italic">
                All 10 fields optional.
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
                  title="Save and keep form open to enter another disbursement"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Add Another
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded font-semibold transition-colors shadow-xs"
              >
                {isEdit ? 'Update Disbursement' : 'Save Disbursement'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
