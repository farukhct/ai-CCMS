/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TitleBar } from './components/layout/TitleBar';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/common/Toast';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { LockScreenModal } from './components/common/LockScreenModal';

import { SetupWizard } from './components/views/SetupWizard';
import { LoginView } from './components/views/LoginView';
import { DashboardView } from './components/views/DashboardView';
import { ApplicationEntryView } from './components/views/ApplicationEntryView';
import { DonationEntryView } from './components/views/DonationEntryView';
import { DisbursementEntryView } from './components/views/DisbursementEntryView';
import { PayOrderEntryView } from './components/views/PayOrderEntryView';
import { AllRecordsView } from './components/views/AllRecordsView';
import { GlobalSearchView } from './components/views/GlobalSearchView';
import { ReportsView } from './components/views/ReportsView';
import { ImportView } from './components/views/ImportView';
import { BackupRestoreView } from './components/views/BackupRestoreView';
import { UserManagementView } from './components/views/UserManagementView';
import { SettingsView } from './components/views/SettingsView';
import { AuditLogView } from './components/views/AuditLogView';
import { HelpView } from './components/views/HelpView';

import { ApplicationFormModal } from './components/forms/ApplicationFormModal';
import { DonationFormModal } from './components/forms/DonationFormModal';
import { DisbursementFormModal } from './components/forms/DisbursementFormModal';
import { PayOrderFormModal } from './components/forms/PayOrderFormModal';
import { Scale } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    isInitialized,
    hasUsers,
    currentUser,
    activeTab,
    appModalId,
    donationModalId,
    disbursementModalId,
    disbursementDonationId,
    payOrderModalId,
    payOrderDonationId,
    payOrderInitialData,
    closeAllModals
  } = useApp();

  // 1. Initializing SQLite storage
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="w-12 h-12 rounded-xl bg-teal-700/30 text-teal-400 flex items-center justify-center mb-4 animate-pulse">
          <Scale className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold tracking-wide">
          Company Court Management System
        </h2>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Mounting local SQLite database (ccms.db)...
        </p>
      </div>
    );
  }

  // 2. First-Run Setup Wizard
  if (!hasUsers) {
    return <SetupWizard />;
  }

  // 3. User Authentication
  if (!currentUser) {
    return <LoginView />;
  }

  // 4. Authenticated Application Desktop Interface
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'applications':
        return <ApplicationEntryView />;
      case 'donations':
        return <DonationEntryView />;
      case 'disbursements':
        return <DisbursementEntryView />;
      case 'pay_orders':
        return <PayOrderEntryView />;
      case 'all_records':
        return <AllRecordsView />;
      case 'search':
        return <GlobalSearchView />;
      case 'reports':
        return <ReportsView />;
      case 'import':
        return <ImportView />;
      case 'backup':
        return <BackupRestoreView />;
      case 'users':
        return <UserManagementView />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditLogView />;
      case 'help':
        return <HelpView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 antialiased font-sans select-none overflow-hidden h-screen">
      {/* Title Bar (Desktop Shell) */}
      <TitleBar />

      {/* Administrative Header */}
      <Header />

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-100/90 focus:outline-none">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals */}
      <ApplicationFormModal
        recordId={appModalId}
        onClose={closeAllModals}
        onSaved={closeAllModals}
      />
      <DonationFormModal
        recordId={donationModalId}
        onClose={closeAllModals}
        onSaved={closeAllModals}
      />
      <DisbursementFormModal
        recordId={disbursementModalId}
        initialDonationId={disbursementDonationId}
        onClose={closeAllModals}
        onSaved={closeAllModals}
      />
      <PayOrderFormModal
        recordId={payOrderModalId}
        initialDonationId={payOrderDonationId}
        initialCaseNumber={payOrderInitialData?.caseNumber}
        initialDonationName={payOrderInitialData?.donationName}
        onClose={closeAllModals}
        onSaved={closeAllModals}
      />

      {/* System Overlay Controls */}
      <ConfirmDialog />
      <ToastContainer />
      <LockScreenModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
