import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { ApplicationRecord } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { X, Sparkles, AlertCircle, Plus } from 'lucide-react';

interface Props {
  recordId: number | null | undefined; // null = new, number = edit, undefined = closed
  onClose: () => void;
  onSaved: () => void;
}

export const ApplicationFormModal: React.FC<Props> = ({ recordId, onClose, onSaved }) => {
  const { currentUser, addToast, showConfirm, settings } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [donationName, setDonationName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [applicationDate, setApplicationDate] = useState(''); // Canonical YYYY-MM-DD
  const [remarks, setRemarks] = useState('');

  const [serialConflictWarning, setSerialConflictWarning] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);

  // Load existing if edit mode
  useEffect(() => {
    if (isEdit && recordId) {
      const existing = applicationRepo.getById(recordId);
      if (existing) {
        setSerialNumber(existing.serial_number || '');
        setDonationName(existing.donation_name || '');
        setAddress(existing.address || '');
        setPhoneNumber(existing.phone_number || '');
        setBankName(existing.bank_name || '');
        setBranchName(existing.branch_name || '');
        setBankAccountNumber(existing.bank_account_number || '');
        setRoutingNumber(existing.routing_number || '');
        setApplicationDate(existing.application_date || '');
        setRemarks(existing.remarks || '');
      }
    } else if (recordId === null) {
      // New record: offer auto serial
      setSerialNumber(applicationRepo.getNextSerialNumber());
      setDonationName('');
      setAddress('');
      setPhoneNumber('');
      setBankName('');
      setBranchName('');
      setBankAccountNumber('');
      setRoutingNumber('');
      setApplicationDate('');
      setRemarks('');
    }
  }, [recordId, isEdit]);

  // Check serial conflict on blur
  const checkSerial = (val: string) => {
    if (!val.trim()) {
      setSerialConflictWarning(null);
      return;
    }
    const hasConflict = applicationRepo.checkSerialConflict(val, isEdit ? recordId! : undefined);
    if (hasConflict) {
      setSerialConflictWarning(`Warning: Serial Number "${val}" is already assigned to another record.`);
    } else {
      setSerialConflictWarning(null);
    }
  };

  const handleGenerateSerial = () => {
    const next = applicationRepo.getNextSerialNumber();
    setSerialNumber(next);
    setSerialConflictWarning(null);
  };

  const resetForm = () => {
    setSerialNumber(applicationRepo.getNextSerialNumber());
    setDonationName('');
    setAddress('');
    setPhoneNumber('');
    setBankName('');
    setBranchName('');
    setBankAccountNumber('');
    setRoutingNumber('');
    setApplicationDate('');
    setRemarks('');
    setSerialConflictWarning(null);
  };

  const doSave = (addAnotherMode?: boolean) => {
    try {
      const payload: Partial<ApplicationRecord> = {
        serial_number: serialNumber.trim(),
        donation_name: donationName.trim(),
        address: address.trim(),
        phone_number: phoneNumber.trim(),
        bank_name: bankName.trim(),
        branch_name: branchName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        routing_number: routingNumber.trim(),
        application_date: applicationDate.trim(),
        remarks: remarks.trim()
      };

      const willKeepOpen = !isEdit && (addAnotherMode !== undefined ? addAnotherMode : keepOpen);

      if (isEdit && recordId) {
        const updated = applicationRepo.update(recordId, payload);
        auditRepo.log('UPDATE_RECORD', 'Applications', updated.id, `Updated Application #${updated.id} (${updated.serial_number || 'No Serial'})`, currentUser || undefined);
        addToast('Application updated successfully.', 'success');
        onSaved();
        onClose();
      } else {
        const created = applicationRepo.create(payload, currentUser?.username);
        auditRepo.log('CREATE_RECORD', 'Applications', created.id, `Created Application #${created.id} (${created.serial_number || 'No Serial'})`, currentUser || undefined);
        onSaved();

        if (willKeepOpen) {
          addToast('Application created successfully! Ready for next entry.', 'success');
          resetForm();
        } else {
          addToast('Application created successfully.', 'success');
          onClose();
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Error saving application.', 'error');
    }
  };

  const handlePhoneChange = (val: string) => {
    // Only numeric values accepted, max length 11 characters
    const numericOnly = val.replace(/\D/g, '').slice(0, 11);
    setPhoneNumber(numericOnly);
  };

  const handleBankAccountChange = (val: string) => {
    // Only numeric values accepted
    const numericOnly = val.replace(/\D/g, '');
    setBankAccountNumber(numericOnly);
  };

  const handleRoutingChange = (val: string) => {
    // Only numeric values accepted
    const numericOnly = val.replace(/\D/g, '');
    setRoutingNumber(numericOnly);
  };

  const handleSubmit = (e?: React.FormEvent, addAnotherMode?: boolean) => {
    if (e) e.preventDefault();

    // Validation 1: Phone Number must be exactly 11 numeric digits if provided
    if (phoneNumber.trim()) {
      if (phoneNumber.trim().length !== 11) {
        addToast('Phone Number must be exactly 11 digits (e.g. 01711000000).', 'error');
        return;
      }
      if (!/^\d{11}$/.test(phoneNumber.trim())) {
        addToast('Phone Number accepts only numeric values.', 'error');
        return;
      }
    }

    // Validation 2: Bank Account Number numeric values only
    if (bankAccountNumber.trim() && !/^\d+$/.test(bankAccountNumber.trim())) {
      addToast('Bank Account Number accepts only numeric values.', 'error');
      return;
    }

    // Validation 3: Routing Number numeric values only
    if (routingNumber.trim() && !/^\d+$/.test(routingNumber.trim())) {
      addToast('Routing Number accepts only numeric values.', 'error');
      return;
    }

    // Check if every single field is empty
    const isCompletelyBlank =
      !serialNumber.trim() &&
      !donationName.trim() &&
      !address.trim() &&
      !phoneNumber.trim() &&
      !bankName.trim() &&
      !branchName.trim() &&
      !bankAccountNumber.trim() &&
      !routingNumber.trim() &&
      !applicationDate.trim() &&
      !remarks.trim();

    if (isCompletelyBlank && settings.requireConfirmBlank) {
      showConfirm({
        title: 'Save Blank Application Record?',
        message: 'All fields in this form are currently blank. As all fields are optional in CCMS, this will create an unpopulated pending record. Would you like to proceed?',
        confirmLabel: 'Yes, Save Blank Record',
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
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#0f3a5d] text-white flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-sm font-bold tracking-wide">
              {isEdit ? `Edit Application Entry #${recordId}` : 'New Application Entry'}
            </h2>
            <p className="text-[11px] text-slate-300">
              Court Application Record · All fields optional
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {serialConflictWarning && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{serialConflictWarning}</span>
            </div>
          )}

          {/* Row 1: Serial Number & Donation Name */}
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
                onBlur={e => checkSerial(e.target.value)}
                placeholder="e.g. APP-00001"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Donation Name (Entity / Organization)
              </label>
              <input
                type="text"
                value={donationName}
                onChange={e => setDonationName(e.target.value)}
                placeholder="e.g. Acme Industrial Corp Ltd"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Populates selectable donation names for Donation Entry
              </span>
            </div>
          </div>

          {/* Row 2: Address & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Registered business address"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Phone Number (11-digit numeric)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={phoneNumber}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="e.g. 01711000000 (11 digits)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {phoneNumber ? `${phoneNumber.length}/11 digits` : 'Only numeric values accepted (11 characters)'}
              </span>
            </div>
          </div>

          {/* Row 3: Bank Details */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider text-teal-800">
              Bank Account Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. Sonali Bank PLC"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  placeholder="e.g. Principal Branch, Motijheel"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Bank Account Number (Numeric only)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bankAccountNumber}
                  onChange={e => handleBankAccountChange(e.target.value)}
                  placeholder="e.g. 0021487654321 (numeric only)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Routing Number (Numeric only)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={routingNumber}
                  onChange={e => handleRoutingChange(e.target.value)}
                  placeholder="e.g. 200271458 (numeric only)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Application Date & Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <DatePicker
                label="Application Date"
                value={applicationDate}
                onChange={setApplicationDate}
                placeholder="dd-MM-yyyy"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Remarks
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Case notes or administrative references"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 italic">
                All 10 fields are optional.
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
                  title="Save and keep form open to enter another application"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Add Another
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded font-semibold transition-colors shadow-xs"
              >
                {isEdit ? 'Update Application' : 'Save Application'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
