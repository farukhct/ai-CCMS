import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { payOrderRepo } from '../../database/repositories/payOrderRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { PayOrderRecord } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { X, Sparkles, AlertCircle, Coins, Link as LinkIcon, Unlink, CheckCircle2, Plus } from 'lucide-react';

interface Props {
  recordId: number | null | undefined;
  initialDonationId?: number | null;
  initialCaseNumber?: string;
  initialDonationName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const PayOrderFormModal: React.FC<Props> = ({
  recordId,
  initialDonationId,
  initialCaseNumber,
  initialDonationName,
  onClose,
  onSaved
}) => {
  const { currentUser, addToast, showConfirm, settings } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [selectedDonationId, setSelectedDonationId] = useState<number | null>(null);
  const [caseNumber, setCaseNumber] = useState('');
  const [donationName, setDonationName] = useState('');
  const [payOrderNumber, setPayOrderNumber] = useState('');
  const [poDate, setPoDate] = useState(''); // Canonical YYYY-MM-DD
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
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
      const existing = payOrderRepo.getById(recordId);
      if (existing) {
        setSerialNumber(existing.serial_number || '');
        setSelectedDonationId(existing.donation_id ?? null);
        setCaseNumber(existing.case_number || '');
        setDonationName(existing.donation_name || '');
        setPayOrderNumber(existing.pay_order_number || '');
        setPoDate(existing.po_date || '');
        setBankName(existing.bank_name || '');
        setBranchName(existing.branch_name || '');
        setRemarks(existing.remarks || '');
        setIsManualOverride(existing.is_unlinked === 1);

        if (existing.donation_id) {
          const don = donationRepo.getById(existing.donation_id);
          setMatchedDonation(don);
        }
      }
    } else if (recordId === null) {
      // New Pay Order
      setSerialNumber(payOrderRepo.getNextSerialNumber());
      setPayOrderNumber('');
      setPoDate('');
      setBankName('');
      setBranchName('');
      setRemarks('');

      if (initialCaseNumber || initialDonationName) {
        setCaseNumber(initialCaseNumber || '');
        setDonationName(initialDonationName || '');
        if (initialDonationId) {
          setSelectedDonationId(initialDonationId);
          const don = donationRepo.getById(initialDonationId);
          if (don) setMatchedDonation(don);
        }
        setIsManualOverride(false);
        return;
      }

      if (initialDonationId) {
        const don = donationRepo.getById(initialDonationId);
        if (don) {
          setSelectedDonationId(don.id);
          setMatchedDonation(don);
          setCaseNumber(don.case_number || '');
          setDonationName(don.donation_name || '');
          setIsManualOverride(false);
          return;
        }
      }

      setSelectedDonationId(null);
      setCaseNumber('');
      setDonationName('');
      setMatchedDonation(null);
      setIsManualOverride(false);
    }
  }, [recordId, isEdit, initialDonationId, initialCaseNumber, initialDonationName]);

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
      setIsManualOverride(false);
    }
  };

  const handleCheckDuplicate = () => {
    if (caseNumber.trim() && payOrderNumber.trim()) {
      const dups = payOrderRepo.checkPossibleDuplicate(
        caseNumber.trim(),
        payOrderNumber.trim(),
        isEdit ? recordId! : undefined
      );
      if (dups.length > 0) {
        setDuplicateWarning(
          `Pay Order Number "${payOrderNumber}" for Case "${caseNumber}" already exists in record #${dups[0].id}.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleGenerateSerial = () => {
    const next = payOrderRepo.getNextSerialNumber();
    setSerialNumber(next);
  };

  const resetForm = () => {
    setSerialNumber(payOrderRepo.getNextSerialNumber());
    setPayOrderNumber('');
    setPoDate('');
    setBankName('');
    setBranchName('');
    setRemarks('');
    setDuplicateWarning(null);
    // Reload selectable donations
    setAvailableDonations(donationRepo.getSelectableDonations());
  };

  const doSave = (addAnotherMode?: boolean) => {
    try {
      const payload: Partial<PayOrderRecord> = {
        serial_number: serialNumber.trim(),
        donation_id: isManualOverride ? null : selectedDonationId,
        case_number: caseNumber.trim(),
        donation_name: donationName.trim(),
        pay_order_number: payOrderNumber.trim(),
        po_date: poDate.trim(),
        bank_name: bankName.trim(),
        branch_name: branchName.trim(),
        remarks: remarks.trim(),
        is_unlinked: isManualOverride || !selectedDonationId ? 1 : 0
      };

      const willKeepOpen = !isEdit && (addAnotherMode !== undefined ? addAnotherMode : keepOpen);

      if (isEdit && recordId) {
        const updated = payOrderRepo.update(recordId, payload);
        auditRepo.log(
          'UPDATE_RECORD',
          'PayOrders',
          updated.id,
          `Updated Pay Order #${updated.id} (PO: ${updated.pay_order_number || 'N/A'}, Case: ${updated.case_number || 'N/A'})`,
          currentUser || undefined
        );
        addToast('Pay Order updated successfully.', 'success');
        onSaved();
        onClose();
      } else {
        const created = payOrderRepo.create(payload, currentUser?.username);
        auditRepo.log(
          'CREATE_RECORD',
          'PayOrders',
          created.id,
          `Created Pay Order #${created.id} (PO: ${created.pay_order_number || 'N/A'}, Case: ${created.case_number || 'N/A'})`,
          currentUser || undefined
        );
        onSaved();

        if (willKeepOpen) {
          addToast('Pay Order created successfully! Ready for next entry.', 'success');
          resetForm();
        } else {
          addToast('Pay Order created successfully.', 'success');
          onClose();
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Error saving pay order entry.', 'error');
    }
  };

  const handleSubmit = (e?: React.FormEvent, addAnotherMode?: boolean) => {
    if (e) e.preventDefault();

    const isCompletelyBlank =
      !serialNumber.trim() &&
      !caseNumber.trim() &&
      !donationName.trim() &&
      !payOrderNumber.trim() &&
      !poDate.trim() &&
      !bankName.trim() &&
      !branchName.trim() &&
      !remarks.trim();

    if (isCompletelyBlank && settings.requireConfirmBlank) {
      showConfirm({
        title: 'Save Blank Pay Order Record?',
        message: 'All fields in this pay order entry are blank. In accordance with CCMS rules, this will save an unpopulated pending record. Proceed?',
        confirmLabel: 'Save Blank Pay Order',
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
              {isEdit ? `Edit Pay Order Entry #${recordId}` : 'New Pay Order Entry'}
            </h2>
            <p className="text-[11px] text-slate-300">
              Pay Order record linked to court-decreed Donation or standalone case instrument
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
        <form onSubmit={e => handleSubmit(e)} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {duplicateWarning && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Row 1: Serial & Auto-Gen */}
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
                placeholder="e.g. PO-00001"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Case Number
              </label>
              <input
                type="text"
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                onBlur={handleCheckDuplicate}
                placeholder="e.g. CC-104/2026 or Company Matter 42/2025"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          {/* Row 2: Linked Donation Selector */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-700" />
                Populate from Donation Record
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
                    Switch to Linked Donation Dropdown
                  </>
                ) : (
                  <>
                    <Unlink className="w-3 h-3" />
                    Manual Case / Donation Entry
                  </>
                )}
              </button>
            </div>

            {!isManualOverride ? (
              <div>
                <select
                  value={selectedDonationId || ''}
                  onChange={e => handleSelectDonation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">-- Select Decreed Donation to Populate Case & Entity --</option>
                  {availableDonations.map(don => (
                    <option key={don.id} value={don.id}>
                      Record #{don.id}: {don.case_number ? `Case ${don.case_number}` : 'No Case'} · {don.donation_name || 'No Name'} {don.donation_amount ? `(${settings.currencySymbol} ${Number(don.donation_amount).toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Selecting a donation automatically populates Case Number and Donation Name.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-amber-700 italic">
                  Manual mode active: You can specify custom Case Number and Donation Name directly without linking to an existing Donation record.
                </p>
              </div>
            )}
          </div>

          {/* Donation Name Field */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Donation Name / Company / Beneficiary Entity
            </label>
            <input
              type="text"
              value={donationName}
              onChange={e => setDonationName(e.target.value)}
              placeholder="e.g. Apex Textile Mills Ltd. or Anjuman Mufidul Islam"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* Row 3: Pay Order Number & PO Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pay Order Number
              </label>
              <input
                type="text"
                value={payOrderNumber}
                onChange={e => setPayOrderNumber(e.target.value)}
                onBlur={handleCheckDuplicate}
                placeholder="e.g. PO-8492015"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <DatePicker
                label="PO Date"
                value={poDate}
                onChange={setPoDate}
                placeholder="dd-MM-yyyy"
              />
            </div>
          </div>

          {/* Row 4: Bank Name & Branch Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="e.g. Sonali Bank PLC or Agrani Bank"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={branchName}
                onChange={e => setBranchName(e.target.value)}
                placeholder="e.g. Supreme Court Branch"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          {/* Row 5: Remarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Instrument clearance notes, court registry remarks"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 italic">
                All 8 fields optional.
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
                  title="Save and keep form open to enter another pay order"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Add Another
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded font-semibold transition-colors shadow-xs"
              >
                {isEdit ? 'Update Pay Order' : 'Save Pay Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
