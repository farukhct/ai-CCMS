/**
 * Company Court Management System (CCMS)
 * Core Domain Type Definitions
 */

export type RoleName = 
  | 'Super Administrator'
  | 'Administrator'
  | 'Data Entry Operator'
  | 'Reviewer'
  | 'Read-Only User';

export type Permission =
  | 'view_records'
  | 'create_records'
  | 'edit_records'
  | 'delete_records'
  | 'import_records'
  | 'export_reports'
  | 'print_reports'
  | 'backup_database'
  | 'restore_database'
  | 'manage_users'
  | 'change_settings'
  | 'view_audit_logs';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email?: string;
  role: RoleName;
  is_active: number; // 1 or 0
  created_at: string; // ISO string
  updated_at: string;
}

export interface RoleDefinition {
  name: RoleName;
  description: string;
  permissions: Permission[];
}

export interface ApplicationRecord {
  id: number;
  serial_number: string;
  donation_name: string;
  address: string;
  phone_number: string;
  bank_name: string;
  branch_name: string;
  bank_account_number: string;
  routing_number: string;
  application_date: string; // ISO YYYY-MM-DD or empty
  remarks: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DonationRecord {
  id: number;
  serial_number: string;
  case_number: string;
  application_id?: number | null; // internal link to ApplicationRecord
  donation_name: string;
  donation_amount: number | null; // numeric amount
  judgement_date: string; // ISO YYYY-MM-DD or empty
  remarks: string;
  is_unlinked: number; // 0 = linked to application, 1 = unlinked / manual
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type DisbursementStatus = 'New Entry' | 'Received' | 'Delivered' | 'Problem' | 'Hold';

export interface DisbursementRecord {
  id: number;
  serial_number: string;
  donation_id?: number | null; // internal link to DonationRecord
  pay_order_id?: number | null; // internal link to PayOrderRecord
  case_number: string;
  donation_name: string;
  pay_order_number?: string; // Pay Order name / number
  po_date?: string; // PO Date ISO YYYY-MM-DD or empty
  bank_name?: string; // Bank Name
  branch_name?: string; // Branch Name
  donation_amount: number | null;
  receiver_name: string;
  receiver_phone: string;
  receiving_date: string; // ISO YYYY-MM-DD or empty
  judgement_date: string; // ISO YYYY-MM-DD or empty
  status: DisbursementStatus;
  remarks: string;
  is_unlinked: number; // 0 = linked to donation, 1 = unlinked / manual
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PayOrderRecord {
  id: number;
  serial_number: string;
  donation_id?: number | null; // internal link to DonationRecord
  case_number: string;
  donation_name: string;
  donation_amount?: number | null; // auto-populated from Donation Entry Form
  judgement_date?: string; // ISO YYYY-MM-DD or empty, auto-populated from Donation Entry Form
  pay_order_number: string;
  po_date: string; // ISO YYYY-MM-DD or empty
  bank_name: string;
  branch_name: string;
  remarks: string;
  is_unlinked: number; // 0 = linked to donation, 1 = unlinked / manual
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRecord {
  id: number;
  timestamp: string; // ISO string
  user_id: number | null;
  username: string;
  action_type: 
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'CREATE_RECORD'
    | 'UPDATE_RECORD'
    | 'DELETE_RECORD'
    | 'CSV_IMPORT'
    | 'REPORT_EXPORT'
    | 'DB_BACKUP'
    | 'DB_RESTORE'
    | 'DB_PURGE'
    | 'USER_MANAGEMENT'
    | 'SETTINGS_CHANGE'
    | 'SYSTEM_SETUP';
  entity_name: string; // e.g., 'Applications', 'Donations', 'Disbursements', 'Users', 'Settings'
  entity_id?: string | number | null;
  summary: string;
  ip_address?: string;
}

export interface AppSettings {
  appName: string;
  appSubtitle: string;
  orgName: string;
  orgAddress: string;
  orgContactPhone: string;
  orgContactEmail: string;
  currencyCode: string; // e.g. BDT
  currencySymbol: string; // e.g. ৳
  decimalPrecision: number;
  dateFormat: string; // default DD-MM-YYYY
  defaultPageSize: number;
  sessionTimeoutMinutes: number;
  tableDensity: 'comfortable' | 'compact';
  defaultOrientation: 'portrait' | 'landscape';
  defaultExportDirectory: string;
  backupReminderDays: number;
  duplicateWarningPolicy: 'warn' | 'block' | 'allow';
  requireConfirmBlank: boolean;
  statusOptions: string[];
}

export interface ImportValidationRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
}

export interface DatabaseBackupManifest {
  version: string;
  schemaVersion: number;
  backupTimestamp: string;
  recordCounts: {
    users: number;
    applications: number;
    donations: number;
    disbursements: number;
    payOrders: number;
    auditLogs: number;
  };
  checksum?: string;
}

export type ActiveNavTab =
  | 'dashboard'
  | 'applications'
  | 'donations'
  | 'disbursements'
  | 'pay_orders'
  | 'all_records'
  | 'search'
  | 'reports'
  | 'import'
  | 'backup'
  | 'users'
  | 'settings'
  | 'audit'
  | 'help';
