import React, { useState, useEffect } from 'react';
import { useApp, InitialPayOrderData } from '../../context/AppContext';
import { disbursementRepo } from '../../database/repositories/disbursementRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { payOrderRepo } from '../../database/repositories/payOrderRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { DisbursementRecord, DisbursementStatus, PayOrderRecord } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { toCanonicalDate, toDisplayDate } from '../../services/dateUtils';
import {
  X,
  Sparkles,
  AlertCircle,
  Coins,
  CheckCircle2,
  Plus,
  CreditCard
} from 'lucide-react';

interface Props {
  recordId: number | null | undefined;
  initialDonationId?: number | null;
  initialPayOrderData?: InitialPayOrderData;
  onClose: () => void;
  onSaved: () => void;
}

export const DisbursementFormModal: React.FC<Props> = ({
  recordId,
  initialDonationId,
  initialPayOrderData,
  onClose,
  onSaved
}) => {
  const { currentUser, addToast, showConfirm, settings, openPayOrderModal } = useApp();

  const isEdit = typeof recordId === 'number';

  const [serialNumber, setSerialNumber] = useState('');
  const [selectedDonationId, setSelectedDonationId] = useState<number | null>(null);
  const [caseNumber, setCaseNumber] = useState('');
  const [donationName, setDonationName] = useState('');
  const [donationAmount, setDonationAmount] = useState('');

  // Pay Order Fields
  const [selectedPayOrderId, setSelectedPayOrderId] = useState<number | null>(null);
  const [payOrderNumber, setPayOrderNumber] = useState('');
  const [poDate, setPoDate] = useState(''); // Canonical YYYY-MM-DD
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');

  // Receiver & Date Fields
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receivingDate, setReceivingDate] = useState(''); // Canonical YYYY-MM-DD (Disbursement Date)
  const [judgementDate, setJudgementDate] = useState(''); // Canonical YYYY-MM-DD
  const [status, setStatus] = useState<DisbursementStatus>('New Entry');
  const [remarks, setRemarks] = useState('');

  const [availablePayOrders, setAvailablePayOrders] = useState<PayOrderRecord[]>([]);
  const [matchedPayOrder, setMatchedPayOrder] = useState<PayOrderRecord | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    // Load selectable Pay Orders
    const poList = payOrderRepo.getSelectablePayOrders();
    setAvailablePayOrders(poList);

    if (isEdit && recordId) {
      const existing = disbursementRepo.getById(recordId);
      if (existing) {
        setSerialNumber(existing.serial_number || '');
        setSelectedDonationId(existing.donation_id ?? null);
        setSelectedPayOrderId(existing.pay_order_id ?? null);
        setCaseNumber(existing.case_number || '');
        setDonationName(existing.donation_name || '');
        setDonationAmount(existing.donation_amount !== null && existing.donation_amount !== undefined ? String(existing.donation_amount) : '');
        setPayOrderNumber(existing.pay_order_number || '');
        setPoDate(existing.po_date || '');
        setBankName(existing.bank_name || '');
        setBranchName(existing.branch_name || '');
        setReceiverName(existing.receiver_name || '');
        setReceiverPhone(existing.receiver_phone || '');
        setReceivingDate(existing.receiving_date || '');
        setJudgementDate(existing.judgement_date || '');
        setStatus(existing.status || 'New Entry');
        setRemarks(existing.remarks || '');

        if (existing.pay_order_id) {
          const po = payOrderRepo.getById(existing.pay_order_id);
          setMatchedPayOrder(po);
        }
      }
    } else if (recordId === null) {
      // New Disbursement entry
      setSerialNumber(disbursementRepo.getNextSerialNumber());
      setReceiverName('');
      setReceiverPhone('');
      setReceivingDate('');
      setStatus('New Entry');
      setRemarks('');
      setDuplicateWarning(null);

      // 1. If opened with initialPayOrderData from PayOrderFormModal
      if (initialPayOrderData) {
        if (initialPayOrderData.payOrderId) {
          setSelectedPayOrderId(initialPayOrderData.payOrderId);
          const po = payOrderRepo.getById(initialPayOrderData.payOrderId);
          if (po) {
            setMatchedPayOrder(po);
            if (!initialPayOrderData.caseNumber && po.case_number) setCaseNumber(po.case_number);
            if (!initialPayOrderData.donationName && po.donation_name) setDonationName(po.donation_name);
            if ((initialPayOrderData.donationAmount === undefined || initialPayOrderData.donationAmount === null || initialPayOrderData.donationAmount === '') && po.donation_amount !== null && po.donation_amount !== undefined) {
              setDonationAmount(String(po.donation_amount));
            }
            if (!initialPayOrderData.payOrderNumber && po.pay_order_number) setPayOrderNumber(po.pay_order_number);
            if (!initialPayOrderData.poDate && po.po_date) setPoDate(po.po_date);
            if (!initialPayOrderData.bankName && po.bank_name) setBankName(po.bank_name);
            if (!initialPayOrderData.branchName && po.branch_name) setBranchName(po.branch_name);
            if (!initialPayOrderData.judgementDate && po.judgement_date) setJudgementDate(po.judgement_date);
          }
        }

        // Populate all 8 fields directly from initialPayOrderData:
        setCaseNumber(initialPayOrderData.caseNumber || '');
        setDonationName(initialPayOrderData.donationName || '');
        if (initialPayOrderData.donationAmount !== undefined && initialPayOrderData.donationAmount !== null && initialPayOrderData.donationAmount !== '') {
          setDonationAmount(String(initialPayOrderData.donationAmount));
        } else if (!initialPayOrderData.payOrderId) {
          setDonationAmount('');
        }
        setPayOrderNumber(initialPayOrderData.payOrderNumber || '');
        setPoDate(initialPayOrderData.poDate || '');
        setBankName(initialPayOrderData.bankName || '');
        setBranchName(initialPayOrderData.branchName || '');
        if (initialPayOrderData.judgementDate) {
          setJudgementDate(initialPayOrderData.judgementDate);
        }

        if (initialPayOrderData.donationId) {
          setSelectedDonationId(initialPayOrderData.donationId);
          const don = donationRepo.getById(initialPayOrderData.donationId);
          if (don) {
            if (!initialPayOrderData.caseNumber && don.case_number) setCaseNumber(don.case_number);
            if (!initialPayOrderData.donationName && don.donation_name) setDonationName(don.donation_name);
            if ((initialPayOrderData.donationAmount === undefined || initialPayOrderData.donationAmount === null || initialPayOrderData.donationAmount === '') && don.donation_amount !== null && don.donation_amount !== undefined) {
              setDonationAmount(String(don.donation_amount));
            }
            if (!initialPayOrderData.judgementDate && don.judgement_date) setJudgementDate(don.judgement_date);
          }
        }
        return;
      }

      // 2. If opened with initialDonationId (auto-checks if donation has a linked pay order)
      if (initialDonationId) {
        setSelectedDonationId(initialDonationId);
        const linkedPOs = payOrderRepo.getByDonationId(initialDonationId);
        if (linkedPOs.length > 0) {
          const firstPo = linkedPOs[0];
          setSelectedPayOrderId(firstPo.id);
          setMatchedPayOrder(firstPo);
          setCaseNumber(firstPo.case_number || '');
          setDonationName(firstPo.donation_name || '');
          if (firstPo.donation_amount !== null && firstPo.donation_amount !== undefined) {
            setDonationAmount(String(firstPo.donation_amount));
          }
          setPayOrderNumber(firstPo.pay_order_number || '');
          setPoDate(firstPo.po_date || '');
          setBankName(firstPo.bank_name || '');
          setBranchName(firstPo.branch_name || '');
          if (firstPo.judgement_date) {
            setJudgementDate(firstPo.judgement_date);
          }
        } else {
          const don = donationRepo.getById(initialDonationId);
          if (don) {
            setCaseNumber(don.case_number || '');
            setDonationName(don.donation_name || '');
            setDonationAmount(don.donation_amount !== null && don.donation_amount !== undefined ? String(don.donation_amount) : '');
            setJudgementDate(don.judgement_date || '');
          }
          setSelectedPayOrderId(null);
          setMatchedPayOrder(null);
          setPayOrderNumber('');
          setPoDate('');
          setBankName('');
          setBranchName('');
        }
        return;
      }

      // 3. Clean fresh blank form
      setSelectedDonationId(null);
      setSelectedPayOrderId(null);
      setMatchedPayOrder(null);
      setCaseNumber('');
      setDonationName('');
      setDonationAmount('');
      setPayOrderNumber('');
      setPoDate('');
      setBankName('');
      setBranchName('');
      setJudgementDate('');
    }
  }, [recordId, isEdit, initialDonationId, initialPayOrderData]);

  // When user selects a pay order from dropdown:
  // All fields [Case Number, Donation Entry Name, Amount, Pay Order Number, PO Date, Bank Name, Branch Name, Judgement Date] populate
  const handleSelectPayOrder = (poIdStr: string) => {
    if (!poIdStr) {
      setSelectedPayOrderId(null);
      setMatchedPayOrder(null);
      return;
    }

    const id = parseInt(poIdStr, 10);
    setSelectedPayOrderId(id);
    const po = payOrderRepo.getById(id);
    if (po) {
      setMatchedPayOrder(po);
      // 1. Case Number
      if (po.case_number) setCaseNumber(po.case_number);
      // 2. Donation Entry Name
      if (po.donation_name) setDonationName(po.donation_name);
      // 3. Amount
      if (po.donation_amount !== null && po.donation_amount !== undefined) {
        setDonationAmount(String(po.donation_amount));
      }
      // 4. Pay Order Number
      setPayOrderNumber(po.pay_order_number || '');
      // 5. PO Date
      setPoDate(po.po_date || '');
      // 6. Bank Name
      setBankName(po.bank_name || '');
      // 7. Branch Name
      setBranchName(po.branch_name || '');
      // 8. Judgement Date
      if (po.judgement_date) {
        setJudgementDate(po.judgement_date);
      }

      // Link donation_id in the background if present on this Pay Order
      if (po.donation_id) {
        setSelectedDonationId(po.donation_id);
        const don = donationRepo.getById(po.donation_id);
        if (don) {
          if (!po.case_number && don.case_number) setCaseNumber(don.case_number);
          if (!po.donation_name && don.donation_name) setDonationName(don.donation_name);
          if ((po.donation_amount === null || po.donation_amount === undefined) && don.donation_amount !== null && don.donation_amount !== undefined) {
            setDonationAmount(String(don.donation_amount));
          }
          if (!po.judgement_date && don.judgement_date) {
            setJudgementDate(don.judgement_date);
          }
        }
      }
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
    setSelectedPayOrderId(null);
    setMatchedPayOrder(null);
    setCaseNumber('');
    setDonationName('');
    setDonationAmount('');
    setPayOrderNumber('');
    setPoDate('');
    setBankName('');
    setBranchName('');
    setReceiverName('');
    setReceiverPhone('');
    setReceivingDate('');
    setJudgementDate('');
    setStatus('New Entry');
    setRemarks('');
    setDuplicateWarning(null);
    setAvailablePayOrders(payOrderRepo.getSelectablePayOrders());
  };

  const doSave = (addAnotherMode?: boolean) => {
    try {
      // Strict Check: Judgement Date must be strictly less than Disbursement Date before inserting data into database
      if (judgementDate.trim() && receivingDate.trim()) {
        const cJudg = toCanonicalDate(judgementDate);
        const cDisb = toCanonicalDate(receivingDate);
        if (cJudg && cDisb && cJudg >= cDisb) {
          addToast(
            `Validation Error: Judgement Date (${toDisplayDate(cJudg)}) must be less than Disbursement Date (${toDisplayDate(cDisb)}). Record cannot be inserted into the database.`,
            'error'
          );
          return;
        }
      }

      const cleanAmount = donationAmount.trim() ? parseFloat(donationAmount.replace(/,/g, '')) : null;

      const payload: Partial<DisbursementRecord> = {
        serial_number: serialNumber.trim(),
        donation_id: selectedDonationId || matchedPayOrder?.donation_id || null,
        pay_order_id: selectedPayOrderId,
        case_number: caseNumber.trim(),
        donation_name: donationName.trim(),
        pay_order_number: payOrderNumber.trim(),
        po_date: poDate.trim(),
        bank_name: bankName.trim(),
        branch_name: branchName.trim(),
        donation_amount: cleanAmount,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        receiving_date: receivingDate.trim(),
        judgement_date: judgementDate.trim(),
        status: status,
        remarks: remarks.trim(),
        is_unlinked: selectedPayOrderId ? 0 : (!selectedDonationId ? 1 : 0)
      };

      const willKeepOpen = !isEdit && (addAnotherMode !== undefined ? addAnotherMode : keepOpen);

      if (isEdit && recordId) {
        const updated = disbursementRepo.update(recordId, payload);
        auditRepo.log(
          'UPDATE_RECORD',
          'Disbursements',
          updated.id,
          `Updated Disbursement #${updated.id} (Status: ${updated.status}, PO: ${updated.pay_order_number || 'N/A'})`,
          currentUser || undefined
        );
        addToast('Disbursement updated successfully.', 'success');
        onSaved();
        onClose();
      } else {
        const created = disbursementRepo.create(payload, currentUser?.username);
        auditRepo.log(
          'CREATE_RECORD',
          'Disbursements',
          created.id,
          `Created Disbursement #${created.id} (Receiver: ${created.receiver_name}, Amount: ${created.donation_amount || 0}, Status: ${created.status})`,
          currentUser || undefined
        );
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

    // Validation 2: Judgement Date must be strictly less than Disbursement Date before inserting data into database
    if (judgementDate.trim() && receivingDate.trim()) {
      const cJudg = toCanonicalDate(judgementDate);
      const cDisb = toCanonicalDate(receivingDate);

      if (!cJudg) {
        addToast('Invalid Judgement Date format. Please enter a valid date (dd-MM-yyyy).', 'error');
        return;
      }
      if (!cDisb) {
        addToast('Invalid Disbursement Date format. Please enter a valid date (dd-MM-yyyy).', 'error');
        return;
      }

      if (cJudg >= cDisb) {
        addToast(
          `Validation Error: Judgement Date (${toDisplayDate(cJudg)}) must be less than Disbursement Date (${toDisplayDate(cDisb)}). Record cannot be inserted into the database.`,
          'error'
        );
        return;
      }
    }

    const isCompletelyBlank =
      !serialNumber.trim() &&
      !caseNumber.trim() &&
      !donationName.trim() &&
      !payOrderNumber.trim() &&
      !poDate.trim() &&
      !bankName.trim() &&
      !branchName.trim() &&
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
              Populates directly from Pay Order instruments and judicial decrees
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

          {/* Row 1: Serial Number & Disbursement Status */}
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

          {/* Section 2: Pay Order Details (Primary Source Instrument) */}
          <div className="bg-indigo-50/60 p-3.5 rounded border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-700" />
                Pay Order Details (Primary Source Instrument)
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openPayOrderModal(undefined, selectedDonationId || undefined, {
                    caseNumber,
                    donationName,
                    donationAmount,
                    judgementDate
                  });
                }}
                className="text-[11px] text-indigo-800 hover:text-indigo-950 font-medium underline flex items-center gap-1"
                title="Open Pay Order Entry Form to register or edit a Pay Order"
              >
                + Open Pay Order Form →
              </button>
            </div>

            {/* Pay Order Selector Dropdown */}
            <div className="space-y-2">
              <select
                value={selectedPayOrderId || ''}
                onChange={e => handleSelectPayOrder(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 text-xs"
              >
                <option value="">-- Select from Existing Pay Orders (Auto-fills All 8 Fields) --</option>
                {availablePayOrders.map(po => (
                  <option key={po.id} value={po.id}>
                    PO #{po.id}: {po.pay_order_number ? `PO-${po.pay_order_number}` : 'No Number'} · Case {po.case_number || 'N/A'} · {po.donation_name || 'No Entity'} {po.donation_amount ? `(${settings.currencySymbol} ${Number(po.donation_amount).toLocaleString()})` : ''} · {po.bank_name || 'Bank Unspecified'} {po.branch_name ? `(${po.branch_name})` : ''} {po.po_date ? `[PO Date: ${toDisplayDate(po.po_date)}]` : ''} {po.judgement_date ? `[Decree: ${toDisplayDate(po.judgement_date)}]` : ''}
                  </option>
                ))}
              </select>

              {(selectedPayOrderId || payOrderNumber) && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-950 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        All Fields Populated from Pay Order {selectedPayOrderId ? `#${selectedPayOrderId}` : ''}: <strong>{payOrderNumber || '(No Number)'}</strong>
                      </span>
                    </div>
                    {donationAmount && (
                      <span className="font-mono font-bold text-emerald-800">
                        {settings.currencySymbol} {parseFloat(donationAmount.replace(/,/g, '')).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/60 font-mono">
                    <div><span className="text-emerald-600 font-semibold">Case No:</span> {caseNumber || '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">Entity:</span> {donationName || '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">PO Number:</span> {payOrderNumber || '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">PO Date:</span> {poDate ? toDisplayDate(poDate) : '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">Bank:</span> {bankName || '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">Branch:</span> {branchName || '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">Amount:</span> {donationAmount ? `${settings.currencySymbol} ${Number(donationAmount).toLocaleString()}` : '-'}</div>
                    <div><span className="text-emerald-600 font-semibold">Decree Date:</span> {judgementDate ? toDisplayDate(judgementDate) : '-'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* 4 Pay Order Instrument Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Pay Order Name / Number
                </label>
                <input
                  type="text"
                  value={payOrderNumber}
                  onChange={e => setPayOrderNumber(e.target.value)}
                  placeholder="e.g. PO-8492015"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-teal-700"
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
                  placeholder="e.g. Supreme Court Branch"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Decreed Case & Donation Details (Populated from Pay Order) */}
          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#0f3a5d]" />
              Decreed Case & Donation Details (Populated from Pay Order)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

          {/* Section 4: Receiver Information */}
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

          {/* Section 5: Dates: Disbursement Date & Judgement Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <DatePicker
                label="Disbursement Date"
                value={receivingDate}
                onChange={setReceivingDate}
                placeholder="dd-MM-yyyy"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Must be greater than Judgement Date
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
                Must be less than Disbursement Date
              </span>
            </div>

            {/* Real-time date sequence warning */}
            {receivingDate.trim() && judgementDate.trim() && toCanonicalDate(judgementDate) && toCanonicalDate(receivingDate) && toCanonicalDate(judgementDate) >= toCanonicalDate(receivingDate) && (
              <div className="col-span-1 md:col-span-2 p-2.5 rounded bg-rose-50 border border-rose-300 text-rose-800 text-[11px] flex items-center gap-2 font-medium animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Validation Error: Judgement Date ({toDisplayDate(judgementDate)}) must be less than Disbursement Date ({toDisplayDate(receivingDate)}). Record will not be inserted into the database.
                </span>
              </div>
            )}
          </div>

          {/* Section 6: Remarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Court verification notes, check delivery receipt reference"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          {/* Continuous Entry Facilities & Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 italic">
                All fields optional. Blank saves generate pending records.
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

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Add Another
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded text-xs font-semibold shadow-xs transition-colors"
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
