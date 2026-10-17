/**
 * CCMS Application Global Context
 * Manages Auth, Roles, RBAC permissions, App Settings, Navigation, Modals, and Inactivity Lock
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Permission, AppSettings, ActiveNavTab, RoleName } from '../types';
import { getDatabase, reseedDatabase } from '../database/engine';
import { userRepo } from '../database/repositories/userRepo';
import { settingsRepo, DEFAULT_APP_SETTINGS } from '../database/repositories/settingsRepo';
import { auditRepo } from '../database/repositories/auditRepo';
import { backupService, FactoryResetServiceOptions, FactoryResetServiceResult } from '../services/backupService';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface InitialPayOrderData {
  payOrderId?: number | null;
  payOrderNumber?: string;
  poDate?: string;
  bankName?: string;
  branchName?: string;
  caseNumber?: string;
  donationName?: string;
  donationAmount?: number | string | null;
  judgementDate?: string;
  donationId?: number | null;
}

export interface InitialPayOrderModalData {
  caseNumber?: string;
  donationName?: string;
  donationAmount?: number | string | null;
  judgementDate?: string;
}

interface AppContextType {
  isInitialized: boolean;
  currentUser: User | null;
  permissions: Permission[];
  hasPermission: (perm: Permission) => boolean;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isLocked: boolean;
  lockSession: () => void;
  unlockSession: (password: string) => boolean;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  hasUsers: boolean;
  refreshUsersCheck: () => void;
  reseedData: () => void;
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  confirmDialog: ConfirmDialogOptions | null;
  showConfirm: (opts: ConfirmDialogOptions) => void;
  closeConfirm: () => void;
  openApplicationModal: (id?: number) => void;
  openDonationModal: (id?: number, applicationId?: number) => void;
  openDisbursementModal: (id?: number, donationId?: number, initialPayOrderData?: InitialPayOrderData) => void;
  openPayOrderModal: (id?: number, donationId?: number, initialData?: InitialPayOrderModalData) => void;
  appModalId: number | null | undefined;
  donationModalId: number | null | undefined;
  donationApplicationId: number | null | undefined;
  disbursementModalId: number | null | undefined;
  disbursementDonationId: number | null | undefined;
  disbursementPayOrderData: InitialPayOrderData | undefined;
  payOrderModalId: number | null | undefined;
  payOrderDonationId: number | null | undefined;
  payOrderInitialData: InitialPayOrderModalData | undefined;
  dataVersion: number;
  refreshData: () => void;
  closeAllModals: () => void;
  isFactoryResetModalOpen: boolean;
  openFactoryResetModal: () => void;
  closeFactoryResetModal: () => void;
  executeFactoryReset: (options: FactoryResetServiceOptions) => Promise<FactoryResetServiceResult>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataVersion, setDataVersion] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const [appModalId, setAppModalId] = useState<number | null | undefined>(undefined);
  const [donationModalId, setDonationModalId] = useState<number | null | undefined>(undefined);
  const [donationApplicationId, setDonationApplicationId] = useState<number | null | undefined>(undefined);
  const [disbursementModalId, setDisbursementModalId] = useState<number | null | undefined>(undefined);
  const [disbursementDonationId, setDisbursementDonationId] = useState<number | null | undefined>(undefined);
  const [disbursementPayOrderData, setDisbursementPayOrderData] = useState<InitialPayOrderData | undefined>(undefined);
  const [payOrderModalId, setPayOrderModalId] = useState<number | null | undefined>(undefined);
  const [payOrderDonationId, setPayOrderDonationId] = useState<number | null | undefined>(undefined);
  const [payOrderInitialData, setPayOrderInitialData] = useState<InitialPayOrderModalData | undefined>(undefined);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);

  const openFactoryResetModal = useCallback(() => {
    setIsFactoryResetModalOpen(true);
  }, []);

  const closeFactoryResetModal = useCallback(() => {
    setIsFactoryResetModalOpen(false);
  }, []);

  const refreshData = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showConfirm = useCallback((opts: ConfirmDialogOptions) => {
    setConfirmDialog(opts);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const hasPermission = useCallback((perm: Permission) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Administrator') return true;
    return permissions.includes(perm);
  }, [currentUser, permissions]);

  const refreshUsersCheck = useCallback(() => {
    const usersExist = userRepo.hasAnyUser();
    setHasUsers(usersExist);
  }, []);

  // Initialize DB and settings on startup
  useEffect(() => {
    let mounted = true;
    getDatabase()
      .then(() => {
        if (!mounted) return;
        const currentSettings = settingsRepo.getSettings();
        setSettingsState(currentSettings);
        const usersExist = userRepo.hasAnyUser();
        setHasUsers(usersExist);

        // Auto-login as default Super Administrator so the user can immediately experience the full system
        const defaultAdmin = userRepo.getByUsername('admin');
        if (defaultAdmin) {
          setCurrentUser(defaultAdmin);
          setPermissions(userRepo.getRolePermissions(defaultAdmin.role));
        }

        setIsInitialized(true);
      })
      .catch(err => {
        console.error('Database initialization error:', err);
        addToast('Error initializing local database', 'error');
        if (mounted) {
          setIsInitialized(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [addToast]);

  // Session Inactivity Monitor
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (currentUser && !isLocked && settings.sessionTimeoutMinutes > 0) {
      const timeoutMs = settings.sessionTimeoutMinutes * 60 * 1000;
      inactivityTimerRef.current = setTimeout(() => {
        setIsLocked(true);
        addToast('Session locked due to inactivity.', 'warning');
      }, timeoutMs);
    }
  }, [currentUser, isLocked, settings.sessionTimeoutMinutes, addToast]);

  useEffect(() => {
    const handleActivity = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [resetInactivityTimer]);

  const login = useCallback((username: string, pass: string): { success: boolean; error?: string } => {
    const user = userRepo.getByUsername(username);
    if (!user) {
      auditRepo.log('LOGIN_FAILED', 'Users', null, `Failed login attempt for user "${username}"`);
      return { success: false, error: 'Invalid username or password.' };
    }

    if (!user.is_active) {
      auditRepo.log('LOGIN_FAILED', 'Users', user.id, `Inactive user "${username}" tried to log in`);
      return { success: false, error: 'Account is deactivated. Contact an administrator.' };
    }

    const valid = userRepo.verifyPassword(pass, user.password_hash);
    if (!valid) {
      auditRepo.log('LOGIN_FAILED', 'Users', user.id, `Password mismatch for user "${username}"`);
      return { success: false, error: 'Invalid username or password.' };
    }

    const perms = userRepo.getRolePermissions(user.role);
    setCurrentUser(user);
    setPermissions(perms);
    setIsLocked(false);
    auditRepo.log('LOGIN_SUCCESS', 'Users', user.id, `User "${user.username}" (${user.role}) logged in successfully`, user);
    addToast(`Welcome, ${user.full_name}`, 'success');
    return { success: true };
  }, [addToast]);

  const logout = useCallback(() => {
    if (currentUser) {
      auditRepo.log('LOGOUT', 'Users', currentUser.id, `User "${currentUser.username}" logged out`, currentUser);
    }
    setCurrentUser(null);
    setPermissions([]);
    setIsLocked(false);
    setActiveTab('dashboard');
    addToast('Logged out successfully', 'info');
  }, [currentUser, addToast]);

  const lockSession = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockSession = useCallback((password: string): boolean => {
    if (!currentUser) return false;
    const ok = userRepo.verifyPassword(password, currentUser.password_hash);
    if (ok) {
      setIsLocked(false);
      resetInactivityTimer();
      addToast('Screen unlocked', 'success');
      return true;
    }
    return false;
  }, [currentUser, resetInactivityTimer, addToast]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    settingsRepo.saveSettings(newSettings);
    const updated = settingsRepo.getSettings();
    setSettingsState(updated);
    auditRepo.log('SETTINGS_CHANGE', 'AppSettings', null, 'Application settings updated', currentUser || undefined);
    addToast('Settings saved successfully', 'success');
  }, [currentUser, addToast]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const openApplicationModal = useCallback((id?: number) => {
    setAppModalId(id ?? null);
  }, []);

  const openDonationModal = useCallback((id?: number, applicationId?: number) => {
    setDonationModalId(id ?? null);
    setDonationApplicationId(applicationId ?? null);
  }, []);

  const openDisbursementModal = useCallback((id?: number, donationId?: number, initialPayOrderData?: InitialPayOrderData) => {
    setDisbursementModalId(id ?? null);
    setDisbursementDonationId(donationId ?? null);
    setDisbursementPayOrderData(initialPayOrderData);
  }, []);

  const openPayOrderModal = useCallback((id?: number, donationId?: number, initialData?: InitialPayOrderModalData) => {
    setPayOrderModalId(id ?? null);
    setPayOrderDonationId(donationId ?? null);
    setPayOrderInitialData(initialData);
  }, []);

  const closeAllModals = useCallback(() => {
    setAppModalId(undefined);
    setDonationModalId(undefined);
    setDonationApplicationId(undefined);
    setDisbursementModalId(undefined);
    setDisbursementDonationId(undefined);
    setDisbursementPayOrderData(undefined);
    setPayOrderModalId(undefined);
    setPayOrderDonationId(undefined);
    setPayOrderInitialData(undefined);
  }, []);

  const reseedData = useCallback(() => {
    reseedDatabase();
    const currentSettings = settingsRepo.getSettings();
    setSettingsState(currentSettings);
    const usersExist = userRepo.hasAnyUser();
    setHasUsers(usersExist);
    const defaultAdmin = userRepo.getByUsername('admin');
    if (defaultAdmin) {
      setCurrentUser(defaultAdmin);
      setPermissions(userRepo.getRolePermissions(defaultAdmin.role));
    }
    addToast('Sample court data reloaded successfully.', 'success');
  }, [addToast]);

  const executeFactoryReset = useCallback(async (options: FactoryResetServiceOptions): Promise<FactoryResetServiceResult> => {
    const res = await backupService.executeFactoryReset({
      ...options,
      currentUserId: currentUser?.id,
      user: currentUser
    });

    // 1. Invalidate and re-query data across all registers
    refreshData();
    refreshUsersCheck();

    // 2. Refresh settings state
    setSettingsState(settingsRepo.getSettings());

    // 3. Handle session state based on reset mode
    if (options.mode === 'first_run_setup') {
      setCurrentUser(null);
      setPermissions([]);
      setHasUsers(false);
      setActiveTab('dashboard');
    } else {
      const usersExist = userRepo.hasAnyUser();
      setHasUsers(usersExist);

      if (options.preserveCurrentUser && currentUser) {
        const refreshedUser = userRepo.getByUsername(currentUser.username);
        if (refreshedUser) {
          setCurrentUser(refreshedUser);
          setPermissions(userRepo.getRolePermissions(refreshedUser.role));
        } else {
          const defaultAdmin = userRepo.getByUsername('admin');
          if (defaultAdmin) {
            setCurrentUser(defaultAdmin);
            setPermissions(userRepo.getRolePermissions(defaultAdmin.role));
          }
        }
      } else {
        const defaultAdmin = userRepo.getByUsername('admin');
        if (defaultAdmin) {
          setCurrentUser(defaultAdmin);
          setPermissions(userRepo.getRolePermissions(defaultAdmin.role));
        }
      }
      setActiveTab('dashboard');
    }

    closeAllModals();
    setIsFactoryResetModalOpen(false);
    addToast(res.message, 'success');
    return res;
  }, [currentUser, refreshData, refreshUsersCheck, closeAllModals, addToast]);

  return (
    <AppContext.Provider
      value={{
        isInitialized,
        currentUser,
        permissions,
        hasPermission,
        settings,
        updateSettings,
        activeTab,
        setActiveTab,
        isSidebarCollapsed,
        toggleSidebar,
        isLocked,
        lockSession,
        unlockSession,
        login,
        logout,
        hasUsers,
        refreshUsersCheck,
        reseedData,
        toasts,
        addToast,
        removeToast,
        confirmDialog,
        showConfirm,
        closeConfirm,
        openApplicationModal,
        openDonationModal,
        openDisbursementModal,
        openPayOrderModal,
        appModalId,
        donationModalId,
        donationApplicationId,
        disbursementModalId,
        disbursementDonationId,
        disbursementPayOrderData,
        payOrderModalId,
        payOrderDonationId,
        payOrderInitialData,
        dataVersion,
        refreshData,
        closeAllModals,
        isFactoryResetModalOpen,
        openFactoryResetModal,
        closeFactoryResetModal,
        executeFactoryReset
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
