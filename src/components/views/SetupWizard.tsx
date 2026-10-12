import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { userRepo } from '../../database/repositories/userRepo';
import { settingsRepo } from '../../database/repositories/settingsRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { checkIntegrity } from '../../database/engine';
import { ShieldCheck, Building2, UserPlus, CheckCircle2, ArrowRight } from 'lucide-react';

export const SetupWizard: React.FC = () => {
  const { refreshUsersCheck, updateSettings, addToast, reseedData } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Setup form states
  const [orgName, setOrgName] = useState('Company Court Administrative Wing');
  const [appSubtitle, setAppSubtitle] = useState('High Court Division & Company Court Administration');
  const [orgAddress, setOrgAddress] = useState('Supreme Court Building, Dhaka-1000');
  const [contactPhone, setContactPhone] = useState('+880 2-9562858');
  const [contactEmail, setContactEmail] = useState('companycourt@judiciary.gov.bd');
  const [currencySymbol, setCurrencySymbol] = useState('৳');

  // Admin Account
  const [username, setUsername] = useState('admin');
  const [fullName, setFullName] = useState('Super Administrator');
  const [email, setEmail] = useState('admin@companycourt.gov.bd');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Organization name is required.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // 1. Verify DB integrity
      const integrity = checkIntegrity();
      if (integrity !== 'ok') {
        throw new Error(`Database check failed: ${integrity}`);
      }

      // 2. Save Organization Settings
      updateSettings({
        orgName: orgName.trim(),
        appSubtitle: appSubtitle.trim(),
        orgAddress: orgAddress.trim(),
        orgContactPhone: contactPhone.trim(),
        orgContactEmail: contactEmail.trim(),
        currencySymbol: currencySymbol.trim()
      });

      // 3. Create Super Administrator user
      const admin = userRepo.create({
        username: username.trim(),
        full_name: fullName.trim() || 'Super Administrator',
        email: email.trim(),
        password: password,
        role: 'Super Administrator'
      });

      auditRepo.log('SYSTEM_SETUP', 'Users', admin.id, 'First-run setup completed. Super Administrator created.', admin);

      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize administrator account.');
    }
  };

  const handleFinish = () => {
    refreshUsersCheck();
    addToast('System initialized successfully. Please log in with your new credentials.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* Container */}
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-xl bg-[#0f3a5d] text-teal-300 mb-3 border border-slate-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Company Court Management System (CCMS)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Offline Windows Desktop Application · First-Run Configuration Wizard
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between mb-8 px-4 text-xs">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-teal-400 font-semibold' : 'text-slate-500'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-mono">1</span>
            <span>Court Entity</span>
          </div>
          <div className="flex-1 h-px bg-slate-700 mx-3" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-teal-400 font-semibold' : 'text-slate-500'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-mono">2</span>
            <span>Initial Admin</span>
          </div>
          <div className="flex-1 h-px bg-slate-700 mx-3" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-teal-400 font-semibold' : 'text-slate-500'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-mono">3</span>
            <span>Ready</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Court & Organization Settings */}
        {step === 1 && (
          <form onSubmit={handleNextStep1} className="space-y-4">
            <div className="border-b border-slate-700 pb-2 mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                Organization & Court Configuration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Establish the authority headers and contact coordinates printed on court reports.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Court / Wing Name *
              </label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Division / Subtitle
              </label>
              <input
                type="text"
                value={appSubtitle}
                onChange={e => setAppSubtitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Court Address
                </label>
                <input
                  type="text"
                  value={orgAddress}
                  onChange={e => setOrgAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={e => setCurrencySymbol(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telephone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  reseedData();
                  refreshUsersCheck();
                  addToast('Court system initialized with sample records and admin account.', 'success');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-teal-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Quick Setup with Sample Court Data
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                Continue to Admin Setup
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Super Admin Account */}
        {step === 2 && (
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="border-b border-slate-700 pb-2 mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-400" />
                Create Initial Super Administrator
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Passwords are automatically hashed with salted bcrypt. Plaintext passwords are never stored.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Secure Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-400"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium text-xs flex items-center gap-2 transition-colors"
              >
                Initialize & Create Account
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Confirmation */}
        {step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-base font-bold text-white">
              System Successfully Configured!
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              The SQLite database <code className="text-teal-400 font-mono">ccms.db</code> has been validated and the Super Administrator account was registered. You are ready to log in.
            </p>

            <div className="p-3 bg-slate-900 rounded border border-slate-700 max-w-sm mx-auto text-left text-xs font-mono space-y-1">
              <div className="text-slate-400">Username: <span className="text-white">{username}</span></div>
              <div className="text-slate-400">Role: <span className="text-teal-400">Super Administrator</span></div>
              <div className="text-slate-400">Storage: <span className="text-white">ccms.db (Offline)</span></div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-semibold text-xs transition-colors shadow-lg"
              >
                Proceed to Login Screen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
