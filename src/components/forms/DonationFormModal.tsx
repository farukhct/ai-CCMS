import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { donationRepo } from '../../database/repositories/donationRepo';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { payOrderRepo } from '../../database/repositories/payOrderRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DonationRecord, ApplicationRecord, PayOrderRecord } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { toDisplayDate } from '../../services/dateUtils';
import { X, Sparkles, AlertCircle, Building2, Link as LinkIcon, Unlink, Plus, CreditCard, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface Props {
  recordId: number | null | undefined;
  initialApplicationId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export const DonationFormModal: React.FC<Props> = ({ recordId, initialApplicationId, onClose, onSaved }) => {
  const { currentUser, addToast, showConfirm, settings, openPayOrderModal } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [donationName, setDonationName] = useState('');
  const [isManualName, setIsManualName] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [judgementDate, setJudgementDate] = useState(''); // Canonical YYYY-MM-DD
  const [remarks, setRemarks] = useState('');

  // Pay Order Module fields (Integrated within Donation Entry)
  const [showPayOrderSection, setShowPayOrderSection] = useState(false);
  const [payOrderNumber, setPayOrderNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [poBankName, setPoBankName] = useState('');
  const [poBranchName, setPoBranchName] = useState('');
  const [poRemarks, setPoRemarks] = useState('');

  // Dropdown options from Applications
  const [availableApplications, setAvailableApplications] = useState<ApplicationRecord[]>([]);
  const [matchedApp, setMatchedApp] = useState<ApplicationRecord | null>(null);
  const [distinctNames, setDistinctNames] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    // Load all applications that have donation_name or id
    const res = applicationRepo.getAll({ pageSize: 10000, sortBy: 'donation_name', sortOrder: 'ASC' });
    setAvailableApplications(res.data);
    setDistinctNames(applicationRepo.getDistinctDonationNames());

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
        } else if (existing.donation_name) {
          const matched = res.data.find(a => a.donation_name && a.donation_name.trim().toLowerCase() === existing.donation_name.trim().toLowerCase());
          if (matched) setMatchedApp(matched);
        }
      }
    } else if (recordId === null) {
      setSerialNumber(donationRepo.getNextSerialNumber());
      setCaseNumber('');
      setDonationAmount('');
      setJudgementDate('');
      setRemarks('');
      setDuplicateWarning(null);

      // Auto-populate immediately if opened with initialApplicationId from Application Entry!
      if (initialApplicationId) {
        setSelectedAppId(initialApplicationId);
        const app = applicationRepo.getById(initialApplicationId);
        if (app) {
          setMatchedApp(app);
          setDonationName(app.donation_name || '');
          setIsManualName(false);
          return;
        }
      }

      setSelectedAppId(null);
      setDonationName('');
      setIsManualName(false);
      setMatchedApp(null);
    }
  }, [recordId, isEdit, initialApplicationId]);

  // When selected application changes from dropdown (populates donation name directly)
  const handleSelectApplication = (appIdStr: string) => {
    if (!appIdStr) {
      setSelectedAppId(null);
      setMatchedApp(null);
      return;
    }

    const id = parseInt(appIdStr, 10);
    setSelectedAppId(id);
    const app = applicationRepo.getById(id) || availableApplications.find(a => a.id === id);
    if (app) {
      setMatchedApp(app);
      setDonationName(app.donation_name || '');
      setIsManualName(false);
      addToast(`Donation Name populated from Application Entry: "${app.donation_name || `App #${app.id}`}"`, 'info');
    }
  };

  // When user edits or types into Donation Name (auto-links if matches application entry)
  const handleDonationNameChange = (val: string) => {
    setDonationName(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setSelectedAppId(null);
      setMatchedApp(null);
      return;
    }

    const match = availableApplications.find(
      a => a.donation_name && a.donation_name.trim().toLowerCase() === trimmed
    );
    if (match) {
      setSelectedAppId(match.id);
      setMatchedApp(match);
      setIsManualName(false);
    } else {
      setIsManualName(true);
      setSelectedAppId(null);
      setMatchedApp(null);
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
    setJudgementDate('');
    setRemarks('');
    setDuplicateWarning(null);
    setIsManualName(false);
    setShowPayOrderSection(false);
    setPayOrderNumber('');
    setPoDate('');
    setPoBankName('');
    setPoBranchName('');
    setPoRemarks('');
  };

  const doSave = (addAnotherMode?: boolean, openPayOrderAfter?: boolean) => {
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

      let savedDonationId: number;
      let finalCase = payload.case_number || '';
      let finalName = payload.donation_name || '';

      if (isEdit && recordId) {
        const updated = donationRepo.update(recordId, payload);
        savedDonationId = updated.id;
        finalCase = updated.case_number || '';
        finalName = updated.donation_name || '';
        auditRepo.log('UPDATE_RECORD', 'Donations', updated.id, `Updated Donation #${updated.id} (Case: ${updated.case_number || 'N/A'})`, currentUser || undefined);
        addToast('Donation updated successfully.', 'success');
      } else {
        const created = donationRepo.create(payload, currentUser?.username);
        savedDonationId = created.id;
        finalCase = created.case_number || '';
        finalName = created.donation_name || '';
        auditRepo.log('CREATE_RECORD', 'Donations', created.id, `Created Donation #${created.id} (Case: ${created.case_number || 'N/A'})`, currentUser || undefined);
      }

      // If integrated Pay Order section has data, create linked Pay Order
      if (showPayOrderSection && (payOrderNumber.trim() || poBankName.trim() || poDate.trim() || poBranchName.trim())) {
        try {
          const poPayload: Partial<PayOrderRecord> = {
            serial_number: payOrderRepo.getNextSerialNumber(),
            donation_id: savedDonationId,
            case_number: finalCase,
            donation_name: finalName,
            donation_amount: cleanAmount,
            judgement_date: judgementDate.trim(),
            pay_order_number: payOrderNumber.trim(),
            po_date: poDate.trim(),
            bank_name: poBankName.trim(),
            branch_name: poBranchName.trim(),
            remarks: poRemarks.trim(),
            is_unlinked: 0
          };
          const poCreated = payOrderRepo.create(poPayload, currentUser?.username);
          auditRepo.log(
            'CREATE_RECORD',
            'PayOrders',
            poCreated.id,
            `Created Pay Order #${poCreated.id} (PO: ${poCreated.pay_order_number || 'N/A'}, Case: ${finalCase}) linked from Donation #${savedDonationId}`,
            currentUser || undefined
          );
          addToast(`Pay Order #${poCreated.pay_order_number || poCreated.id} saved for this donation.`, 'success');
        } catch (poErr: any) {
          addToast(`Donation saved, but error saving pay order: ${poErr.message}`, 'warning');
        }
      }

      onSaved();

      if (openPayOrderAfter) {
        onClose();
        openPayOrderModal(undefined, savedDonationId, {
          caseNumber: finalCase,
          donationName: finalName,
          donationAmount: cleanAmount !== null && cleanAmount !== undefined ? String(cleanAmount) : '',
          judgementDate: judgementDate.trim()
        });
        return;
      }

      if (isEdit) {
        onClose();
      } else {
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

  const handleSubmit = (e?: React.FormEvent, addAnotherMode?: boolean, openPayOrderAfter?: boolean) => {
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
      !remarks.trim() &&
      !payOrderNumber.trim();

    if (isCompletelyBlank && settings.requireConfirmBlank) {
      showConfirm({
        title: 'Save Blank Donation Record?',
        message: 'All optional fields other than Case Number and Judgement Date are blank in this donation record. Would you like to proceed?',
        confirmLabel: 'Save Donation Record',
        onConfirm: () => doSave(addAnotherMode, openPayOrderAfter)
      });
      return;
    }

    doSave(addAnotherMode, openPayOrderAfter);
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                openPayOrderModal(undefined, recordId || undefined, {
                  caseNumber,
                  donationName,
                  donationAmount,
                  judgementDate
                });
              }}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
              title="Populate Case Number, Donation Name, and Amount to new Pay Order"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Create Pay Order</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

          {/* Row 2: Application Entry Selection & Populated Donation Name */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                <Building2 className="w-4 h-4 text-[#0f3a5d]" />
                Application Entry & Donation Name
              </label>
              {availableApplications.length > 0 && (
                <span className="text-[11px] text-teal-800 font-medium">
                  {availableApplications.length} Application Entries Available
                </span>
              )}
            </div>

            {/* Application Entry Selector Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Select Application Entry (Auto-populates Donation Name)
                </label>
                {availableApplications.length > 0 && !selectedAppId && (
                  <button
                    type="button"
                    onClick={() => handleSelectApplication(String(availableApplications[0].id))}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Populate from Latest Application
                  </button>
                )}
              </div>
              <select
                value={selectedAppId || ''}
                onChange={e => handleSelectApplication(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 text-xs font-medium"
              >
                <option value="">-- Choose Application Entry to Populate Donation Name --</option>
                {availableApplications.map(app => (
                  <option key={app.id} value={app.id}>
                    {app.donation_name ? app.donation_name : '(No Name)'} · {app.serial_number || `App #${app.id}`} {app.application_date ? `· Date: ${toDisplayDate(app.application_date)}` : ''} {app.bank_name ? `· ${app.bank_name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Donation Name Input Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>Donation Name</span>
                  {matchedApp && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300">
                      Populated from Application Entry
                    </span>
                  )}
                </label>
                {selectedAppId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAppId(null);
                      setMatchedApp(null);
                      setIsManualName(true);
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Clear Application Link
                  </button>
                )}
              </div>
              <input
                type="text"
                list="application-donation-names-list"
                value={donationName}
                onChange={e => handleDonationNameChange(e.target.value)}
                onBlur={handleCheckDuplicate}
                placeholder="Donation name (auto-populated when application entry is selected)"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <datalist id="application-donation-names-list">
                {distinctNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {matchedApp ? (
                  <span className="text-emerald-700 font-medium">
                    ✓ Linked to Application Entry {matchedApp.serial_number ? `(${matchedApp.serial_number})` : `#${matchedApp.id}`}.
                  </span>
                ) : (
                  <span>
                    Select an Application Entry above to auto-populate this field, or choose from registered names in the suggestions list.
                  </span>
                )}
              </span>
            </div>

            {/* Matched Application Preview Card */}
            {matchedApp && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-950 text-[11px] space-y-1.5">
                <div className="font-semibold text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Application Record #{matchedApp.id}: <strong>{matchedApp.donation_name || '(No Name)'}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded border border-emerald-200">
                    {matchedApp.serial_number || 'No Serial'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/60 font-mono">
                  <div><span className="font-medium text-emerald-900 font-sans">Address:</span> {matchedApp.address || '-'}</div>
                  <div><span className="font-medium text-emerald-900 font-sans">Phone:</span> {matchedApp.phone_number || '-'}</div>
                  <div><span className="font-medium text-emerald-900 font-sans">Bank:</span> {matchedApp.bank_name || '-'} {matchedApp.branch_name ? `(${matchedApp.branch_name})` : ''}</div>
                  <div><span className="font-medium text-emerald-900 font-sans">Account:</span> {matchedApp.bank_account_number || '-'}</div>
                  <div><span className="font-medium text-emerald-900 font-sans">App Date:</span> {matchedApp.application_date ? toDisplayDate(matchedApp.application_date) : '-'}</div>
                  <div><span className="font-medium text-emerald-900 font-sans">Routing:</span> {matchedApp.routing_number || '-'}</div>
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

          {/* Integrated Pay Order Entry Section */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs select-none">
                <input
                  type="checkbox"
                  checked={showPayOrderSection}
                  onChange={e => setShowPayOrderSection(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 w-4 h-4"
                />
                <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                  Add Pay Order with this Donation (Optional)
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openPayOrderModal(undefined, recordId || undefined, {
                    caseNumber,
                    donationName,
                    donationAmount,
                    judgementDate
                  });
                }}
                className="text-[11px] text-emerald-800 hover:text-emerald-950 font-medium underline flex items-center gap-1"
                title="Open dedicated Pay Order Entry Form with populated Case, Entity & Amount"
              >
                Open Pay Order Form →
              </button>
            </div>

            {showPayOrderSection && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="p-2 rounded bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-[11px] flex items-center justify-between">
                  <span>
                    Populated from Donation: <strong>Case:</strong> {caseNumber || '(Pending)'} · <strong>Entity:</strong> {donationName || '(Pending)'} · <strong>Amount:</strong> {donationAmount ? `${settings.currencySymbol} ${parseFloat(donationAmount.replace(/,/g, '')).toLocaleString()}` : '(Pending)'}
                  </span>
                  <span className="text-emerald-700 text-[10px] italic">
                    PayOrderModule Fields
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pay Order Number
                    </label>
                    <input
                      type="text"
                      value={payOrderNumber}
                      onChange={e => setPayOrderNumber(e.target.value)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={poBankName}
                      onChange={e => setPoBankName(e.target.value)}
                      placeholder="e.g. Sonali Bank PLC"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={poBranchName}
                      onChange={e => setPoBranchName(e.target.value)}
                      placeholder="e.g. Supreme Court Branch"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pay Order Remarks
                  </label>
                  <input
                    type="text"
                    value={poRemarks}
                    onChange={e => setPoRemarks(e.target.value)}
                    placeholder="Clearance status, scroll reference, or registry notes"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>
            )}
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

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(undefined, false, true)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium transition-colors shadow-xs flex items-center gap-1.5 text-xs"
                title="Save Donation and immediately open Pay Order entry form with populated Case & Entity"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Save & Add Pay Order</span>
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
