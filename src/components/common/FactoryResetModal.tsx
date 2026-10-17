import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AlertOctagon,
  AlertTriangle,
  Download,
  RotateCcw,
  Sparkles,
  UserCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';

export const FactoryResetModal: React.FC = () => {
  const {
    isFactoryResetModalOpen,
    closeFactoryResetModal,
    executeFactoryReset,
    currentUser,
    hasPermission,
    addToast
  } = useApp();

  const [resetMode, setResetMode] = useState<'clean_slate' | 'sample_data' | 'first_run_setup'>('clean_slate');
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [preserveAdmin, setPreserveAdmin] = useState(true);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isFactoryResetModalOpen) return null;

  const isConfirmed = confirmPhrase.trim().toUpperCase() === 'FACTORY RESET';

  const handleExecute = async () => {
    if (!hasPermission('change_settings') && currentUser?.role !== 'Super Administrator') {
      addToast('Permission denied: Only Super Administrators can perform a Factory Reset.', 'error');
      return;
    }

    if (!isConfirmed) {
      addToast('Please type "FACTORY RESET" exactly to confirm this action.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      await executeFactoryReset({
        mode: resetMode,
        createSafetyBackup,
        preserveCurrentUser: resetMode === 'clean_slate' ? preserveAdmin : false
      });
      setConfirmPhrase('');
    } catch (err: any) {
      addToast(`Factory reset failed: ${err.message || String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-rose-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-850 to-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/40 border border-rose-400/40 rounded-lg text-rose-200">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Application Factory Reset Facility
              </h2>
              <p className="text-xs text-rose-200 mt-0.5">
                Permanent restoration of CCMS database and settings to original factory specifications
              </p>
            </div>
          </div>
          <button
            onClick={closeFactoryResetModal}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Warning Banner */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-900">
            <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-xs">Irreversible Administrative Operation</div>
              <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                A factory reset restores the application to its initial state. All court petition applications, decreed donations, bank pay orders, and disbursement vouchers will be cleared according to the selected mode.
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block font-bold text-slate-900 mb-2">
              1. Choose Factory Reset Mode:
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Clean Slate */}
              <label
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  resetMode === 'clean_slate'
                    ? 'border-rose-500 bg-rose-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="factoryResetMode"
                  checked={resetMode === 'clean_slate'}
                  onChange={() => setResetMode('clean_slate')}
                  className="mt-1 text-rose-700 focus:ring-rose-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      Production Clean Slate (0 Court Records)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Wipes all operational court data (Applications, Donations, Pay Orders, Disbursements, and Import Jobs) and zeroes all numbering sequences. Resets application preferences to defaults. Leaves the database pristine for fresh institutional deployment.
                  </p>
                </div>
              </label>

              {/* Option 2: Sample Data */}
              <label
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  resetMode === 'sample_data'
                    ? 'border-teal-500 bg-teal-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="factoryResetMode"
                  checked={resetMode === 'sample_data'}
                  onChange={() => setResetMode('sample_data')}
                  className="mt-1 text-teal-700 focus:ring-teal-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      Factory Demo State (With Official Sample Data)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                      Demo / Training
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Resets the database and re-seeds the 8 official Company Court petition applications, 7 decreed donation funds, pay orders, and 12 disbursement distributions. Restores default administrative credentials (<code className="font-mono bg-slate-100 px-1 py-0.2 rounded">admin</code> / <code className="font-mono bg-slate-100 px-1 py-0.2 rounded">admin123</code>).
                  </p>
                </div>
              </label>

              {/* Option 3: First Run Setup */}
              <label
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  resetMode === 'first_run_setup'
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="factoryResetMode"
                  checked={resetMode === 'first_run_setup'}
                  onChange={() => setResetMode('first_run_setup')}
                  className="mt-1 text-indigo-700 focus:ring-indigo-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      First-Run Setup Wizard (Out-of-the-Box Fresh Install)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                      Full Wipe
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Completely resets everything including user logins and operator accounts. The system will immediately open the First-Run Setup Wizard so a new organization and master administrator can be set up from scratch.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Safety & Credential Options */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="font-semibold text-slate-800 text-xs">
              2. Data Protection & Safety Precautions:
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={createSafetyBackup}
                onChange={e => setCreateSafetyBackup(e.target.checked)}
                className="w-4 h-4 text-[#0f3a5d] rounded focus:ring-0"
              />
              <span className="font-medium text-xs">
                Download an automatic pre-reset safety backup (<code className="font-mono text-slate-800">.db</code> + JSON manifest) before wiping data
              </span>
            </label>

            {resetMode === 'clean_slate' && (
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={preserveAdmin}
                  onChange={e => setPreserveAdmin(e.target.checked)}
                  className="w-4 h-4 text-[#0f3a5d] rounded focus:ring-0"
                />
                <span className="font-medium text-xs">
                  Preserve current administrator account (<strong className="font-mono text-slate-900">{currentUser?.username || 'admin'}</strong>) instead of reverting to default password
                </span>
              </label>
            )}
          </div>

          {/* Confirmation Phrase Guard */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-900">
              3. Security Confirmation:
            </label>
            <p className="text-[11px] text-slate-500">
              To prevent accidental deletion, type <strong className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">FACTORY RESET</strong> below to enable execution:
            </p>
            <input
              type="text"
              value={confirmPhrase}
              onChange={e => setConfirmPhrase(e.target.value)}
              placeholder="Type FACTORY RESET"
              className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-rose-600"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Audited & verified locally in SQLite</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeFactoryResetModal}
              disabled={isProcessing}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!isConfirmed || isProcessing}
              className="px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Factory Reset...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Execute Factory Reset</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
