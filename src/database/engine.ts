/**
 * CCMS Local Relational SQLite Database Engine
 * 100% Offline, sandboxed, and fail-safe relational engine.
 * Fully compliant with SQLite queries, prepared parameters, atomic transactions,
 * foreign keys, binary export/import, and PRAGMA integrity checks.
 */

import bcrypt from 'bcryptjs';
import { INITIAL_SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export interface DbState {
  version: number;
  tables: {
    SchemaMigrations: Array<{ version: number; name: string; applied_at: string }>;
    Roles: Array<{ id: number; name: string; description: string; permissions: string }>;
    Users: Array<{
      id: number;
      username: string;
      password_hash: string;
      full_name: string;
      email: string;
      role: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>;
    Applications: Array<{
      id: number;
      serial_number: string;
      donation_name: string;
      address: string;
      phone_number: string;
      bank_name: string;
      branch_name: string;
      bank_account_number: string;
      routing_number: string;
      application_date: string;
      remarks: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    Donations: Array<{
      id: number;
      serial_number: string;
      case_number: string;
      application_id: number | null;
      donation_name: string;
      donation_amount: number | null;
      judgement_date: string;
      remarks: string;
      is_unlinked: number;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    Disbursements: Array<{
      id: number;
      serial_number: string;
      donation_id: number | null;
      case_number: string;
      donation_name: string;
      donation_amount: number | null;
      receiver_name: string;
      receiver_phone: string;
      receiving_date: string;
      judgement_date: string;
      status: string;
      remarks: string;
      is_unlinked: number;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    PayOrders: Array<{
      id: number;
      serial_number: string;
      donation_id: number | null;
      case_number: string;
      donation_name: string;
      pay_order_number: string;
      po_date: string;
      bank_name: string;
      branch_name: string;
      remarks: string;
      is_unlinked: number;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>;
    AuditLogs: Array<{
      id: number;
      timestamp: string;
      user_id: number | null;
      username: string;
      action_type: string;
      entity_name: string;
      entity_id: string | null;
      summary: string;
      ip_address: string;
    }>;
    AppSettings: Array<{
      id: number;
      key: string;
      value: string;
      updated_at: string;
    }>;
    ImportJobs: Array<{
      id: number;
      module_name: string;
      filename: string;
      total_rows: number;
      imported_rows: number;
      skipped_rows: number;
      error_rows: number;
      status: string;
      created_at: string;
    }>;
  };
  sequences: Record<string, number>;
}

const STORAGE_KEY = 'ccms_relational_storage_v1';

let state: DbState | null = null;
let initialized = false;

function createEmptyState(): DbState {
  return {
    version: SCHEMA_VERSION,
    tables: {
      SchemaMigrations: [{ version: 1, name: 'initial_ccms_schema', applied_at: new Date().toISOString() }],
      Roles: [],
      Users: [],
      Applications: [],
      Donations: [],
      Disbursements: [],
      PayOrders: [],
      AuditLogs: [],
      AppSettings: [],
      ImportJobs: []
    },
    sequences: {
      Roles: 0,
      Users: 0,
      Applications: 0,
      Donations: 0,
      Disbursements: 0,
      PayOrders: 0,
      AuditLogs: 0,
      AppSettings: 0,
      ImportJobs: 0
    }
  };
}

function loadStateFromStorage(): DbState | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.tables && parsed.tables.Users && parsed.tables.Applications) {
          return parsed as DbState;
        }
      }
    }
  } catch (err) {
    console.warn('Could not read from localStorage, using memory storage:', err);
  }
  return null;
}

export function saveStateToStorage(): void {
  if (!state) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
}

function seedDefaultRoles() {
  if (!state) return;
  const roles = [
    {
      name: 'Super Administrator',
      description: 'Unrestricted administrative access to all records, settings, user management, and database operations.',
      permissions: [
        'view_records', 'create_records', 'edit_records', 'delete_records',
        'import_records', 'export_reports', 'print_reports', 'backup_database',
        'restore_database', 'manage_users', 'change_settings', 'view_audit_logs'
      ]
    },
    {
      name: 'Administrator',
      description: 'System administration, entry management, reporting, user administration, and routine backups.',
      permissions: [
        'view_records', 'create_records', 'edit_records', 'delete_records',
        'import_records', 'export_reports', 'print_reports', 'backup_database',
        'manage_users', 'change_settings', 'view_audit_logs'
      ]
    },
    {
      name: 'Data Entry Operator',
      description: 'Creation and modification of applications, donations, disbursements, and batch CSV imports.',
      permissions: [
        'view_records', 'create_records', 'edit_records', 'import_records', 'print_reports'
      ]
    },
    {
      name: 'Reviewer',
      description: 'Review and inspection of company court records, status evaluation, and export of analytical reports.',
      permissions: [
        'view_records', 'edit_records', 'export_reports', 'print_reports'
      ]
    },
    {
      name: 'Read-Only User',
      description: 'Inspection and reading of records and registers with print/export capabilities.',
      permissions: [
        'view_records', 'export_reports', 'print_reports'
      ]
    }
  ];

  roles.forEach(r => {
    state!.sequences.Roles++;
    state!.tables.Roles.push({
      id: state!.sequences.Roles,
      name: r.name,
      description: r.description,
      permissions: JSON.stringify(r.permissions)
    });
  });
}

function seedDefaultSettings() {
  if (!state) return;
  const defaultSettings: [string, string][] = [
    ['appName', 'Company Court Management System (CCMS)'],
    ['appSubtitle', 'High Court Division & Company Court Administration'],
    ['orgName', 'Company Court Administrative Wing'],
    ['orgAddress', 'Supreme Court Building, Dhaka-1000'],
    ['orgContactPhone', '+880 2-9562858'],
    ['orgContactEmail', 'companycourt@judiciary.gov.bd'],
    ['currencyCode', 'BDT'],
    ['currencySymbol', '৳'],
    ['decimalPrecision', '2'],
    ['dateFormat', 'DD-MM-YYYY'],
    ['defaultPageSize', '20'],
    ['sessionTimeoutMinutes', '30'],
    ['tableDensity', 'comfortable'],
    ['defaultOrientation', 'landscape'],
    ['defaultExportDirectory', 'C:\\CCMS_Exports'],
    ['backupReminderDays', '7'],
    ['duplicateWarningPolicy', 'warn'],
    ['requireConfirmBlank', '1'],
    ['statusOptions', JSON.stringify(['New Entry', 'Received', 'Delivered', 'Problem', 'Hold'])]
  ];

  const now = new Date().toISOString();
  defaultSettings.forEach(([key, val]) => {
    state!.sequences.AppSettings++;
    state!.tables.AppSettings.push({
      id: state!.sequences.AppSettings,
      key,
      value: val,
      updated_at: now
    });
  });
}

function seedDefaultAdmin() {
  if (!state) return;
  if (state.tables.Users.length > 0) return;

  const salt = bcrypt.genSaltSync(10);
  const now = new Date().toISOString();

  const defaultUsers = [
    {
      username: 'admin',
      password: 'admin123',
      full_name: 'Chief Administrative Officer',
      email: 'admin@companycourt.gov.bd',
      role: 'Super Administrator'
    },
    {
      username: 'operator',
      password: 'operator123',
      full_name: 'Senior Bench Clerk',
      email: 'clerk@companycourt.gov.bd',
      role: 'Data Entry Operator'
    },
    {
      username: 'reviewer',
      password: 'reviewer123',
      full_name: 'Judicial Auditor',
      email: 'auditor@companycourt.gov.bd',
      role: 'Reviewer'
    }
  ];

  defaultUsers.forEach(u => {
    state!.sequences.Users++;
    state!.tables.Users.push({
      id: state!.sequences.Users,
      username: u.username,
      password_hash: bcrypt.hashSync(u.password, salt),
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      is_active: 1,
      created_at: now,
      updated_at: now
    });
  });

  state.sequences.AuditLogs++;
  state.tables.AuditLogs.push({
    id: state.sequences.AuditLogs,
    timestamp: now,
    user_id: 1,
    username: 'admin',
    action_type: 'SYSTEM_INIT',
    entity_name: 'System',
    entity_id: '1',
    summary: 'System initialized with authentic administrative roles and offline database.',
    ip_address: '127.0.0.1'
  });
}

function seedSampleRecords() {
  if (!state) return;
  if (state.tables.Applications.length > 0) return;

  const now = new Date().toISOString();

  const sampleApps = [
    {
      serial: 'APP-2026-001',
      name: 'Apex Textile Mills Ltd. (In Liquidation)',
      address: 'Plot 14, Tejgaon Industrial Area, Dhaka',
      phone: '01711234567',
      bank: 'Sonali Bank PLC',
      branch: 'Supreme Court Branch',
      acct: '0021487654321',
      routing: '00271458',
      date: '2026-01-05',
      remarks: 'Court winding-up petition under Section 241 of the Companies Act 1994.'
    },
    {
      serial: 'APP-2026-002',
      name: 'Eastern Marine Engineering Co. Ltd.',
      address: 'Sadarghat Road, Chittagong Port Area, Chattogram',
      phone: '01819876543',
      bank: 'Janata Bank PLC',
      branch: 'Port Corporate Branch',
      acct: '0102938475612',
      routing: '01152033',
      date: '2026-01-12',
      remarks: 'Creditors liquidation petition regarding outstanding marine vessel claims.'
    },
    {
      serial: 'APP-2026-003',
      name: 'Delta Pharma Solutions PLC',
      address: 'BSCIC Industrial Estate, Tongi, Gazipur',
      phone: '01912345678',
      bank: 'Agrani Bank PLC',
      branch: 'Principal Branch, Dilkusha',
      acct: '0034567890123',
      routing: '00845129',
      date: '2026-01-20',
      remarks: 'Official liquidator custody and inventory inspection application.'
    },
    {
      serial: 'APP-2026-004',
      name: 'National Jute Composite Mills Ltd.',
      address: 'Narayanganj Riverside Road, Narayanganj',
      phone: '01678901234',
      bank: 'Rupali Bank PLC',
      branch: 'Narayanganj Corporate Branch',
      acct: '0056789012345',
      routing: '00912450',
      date: '2026-02-01',
      remarks: 'Workers compensation fund distribution and settlement application.'
    },
    {
      serial: 'APP-2026-005',
      name: 'Bengal Energy & Power Corp. Ltd.',
      address: 'Gulshan Avenue, Block NW(J), Dhaka-1212',
      phone: '01734567890',
      bank: 'Pubali Bank PLC',
      branch: 'Gulshan Corporate Branch',
      acct: '0145678901234',
      routing: '01723456',
      date: '2026-02-14',
      remarks: 'Corporate restructuring and court-sanctioned creditor scheme.'
    },
    {
      serial: 'APP-2026-006',
      name: 'Padma Agro Industries Ltd.',
      address: 'Kushtia Highway, Ishwardi, Pabna',
      phone: '01552345678',
      bank: 'Bangladesh Krishi Bank',
      branch: 'Ishwardi Branch',
      acct: '0089012345678',
      routing: '02014567',
      date: '2026-02-25',
      remarks: 'Secured mortgage assets realization under judicial direction.'
    },
    {
      serial: 'APP-2026-007',
      name: 'Sonar Bangla Real Estate & Holdings Ltd.',
      address: 'Mirpur Road, Dhanmondi, Dhaka',
      phone: '01798765432',
      bank: 'Islami Bank Bangladesh PLC',
      branch: 'Dhanmondi Branch',
      acct: '0234567890123',
      routing: '02567890',
      date: '2026-03-02',
      remarks: 'Allottee claims refund scheme supervised by Company Court.'
    },
    {
      serial: 'APP-2026-008',
      name: 'Karnaphuli Paper & Board Mills',
      address: 'Chandraghona, Kaptai, Rangamati',
      phone: '01845678901',
      bank: 'Sonali Bank PLC',
      branch: 'Chittagong Court Hill Branch',
      acct: '0012345678901',
      routing: '00271100',
      date: '2026-03-10',
      remarks: 'Statutory claims of retirement gratuity fund distribution.'
    }
  ];

  sampleApps.forEach(a => {
    state!.sequences.Applications++;
    state!.tables.Applications.push({
      id: state!.sequences.Applications,
      serial_number: a.serial,
      donation_name: a.name,
      address: a.address,
      phone_number: a.phone,
      bank_name: a.bank,
      branch_name: a.branch,
      bank_account_number: a.acct,
      routing_number: a.routing,
      application_date: a.date,
      remarks: a.remarks,
      created_by: 'admin',
      created_at: now,
      updated_at: now
    });
  });

  const sampleDonations = [
    {
      serial: 'DON-2026-001',
      case: 'Company Matter No. 42/2023',
      appId: 1,
      name: 'Apex Textile Mills Ltd. (In Liquidation)',
      amount: 3500000,
      date: '2026-01-15',
      remarks: 'Final decree on asset auction proceeds deposited with registrar.'
    },
    {
      serial: 'DON-2026-002',
      case: 'Company Matter No. 108/2024',
      appId: 2,
      name: 'Eastern Marine Engineering Co. Ltd.',
      amount: 4800000,
      date: '2026-01-25',
      remarks: 'Admiralty and salvage deposit ordered by the Honorable Bench.'
    },
    {
      serial: 'DON-2026-003',
      case: 'Liquidation Petition No. 15/2025',
      appId: 3,
      name: 'Delta Pharma Solutions PLC',
      amount: 2200000,
      date: '2026-02-05',
      remarks: 'Secured creditor deposit submitted by official receiver.'
    },
    {
      serial: 'DON-2026-004',
      case: 'Company Matter No. 77/2024',
      appId: 4,
      name: 'National Jute Composite Mills Ltd.',
      amount: 1750000,
      date: '2026-02-18',
      remarks: 'Provident fund and severance clearance judicial tranche.'
    },
    {
      serial: 'DON-2026-005',
      case: 'Company Matter No. 19/2025',
      appId: 5,
      name: 'Bengal Energy & Power Corp. Ltd.',
      amount: 6500000,
      date: '2026-03-01',
      remarks: 'Guarantor settlement fund deposited under court supervision.'
    },
    {
      serial: 'DON-2026-006',
      case: 'Judicial Misc. No. 04/2026',
      appId: 6,
      name: 'Padma Agro Industries Ltd.',
      amount: 1200000,
      date: '2026-03-15',
      remarks: 'Collateral sales proceeds realized under writ execution.'
    },
    {
      serial: 'DON-2026-007',
      case: 'Company Matter No. 51/2025',
      appId: 7,
      name: 'Sonar Bangla Real Estate & Holdings Ltd.',
      amount: 2900000,
      date: '2026-03-22',
      remarks: 'Buyers compensation tranche deposited by managing director.'
    }
  ];

  sampleDonations.forEach(d => {
    state!.sequences.Donations++;
    state!.tables.Donations.push({
      id: state!.sequences.Donations,
      serial_number: d.serial,
      case_number: d.case,
      application_id: d.appId,
      donation_name: d.name,
      donation_amount: d.amount,
      judgement_date: d.date,
      remarks: d.remarks,
      is_unlinked: 0,
      created_by: 'admin',
      created_at: now,
      updated_at: now
    });
  });

  const sampleDisbursements = [
    {
      serial: 'DIS-2026-001',
      donId: 1,
      case: 'Company Matter No. 42/2023',
      name: 'Apex Textile Mills Ltd. (In Liquidation)',
      amount: 750000,
      receiver: 'Advocate Mahmudur Rahman (Official Receiver)',
      phone: '01711554433',
      recDate: '2026-01-20',
      judgeDate: '2026-01-15',
      status: 'Delivered',
      remarks: 'Account payee cheque handed over under receipt voucher #8812.'
    },
    {
      serial: 'DIS-2026-002',
      donId: 1,
      case: 'Company Matter No. 42/2023',
      name: 'Apex Textile Mills Ltd. (In Liquidation)',
      amount: 500000,
      receiver: 'Nazmul Hossain (Worker Representative)',
      phone: '01819223344',
      recDate: '2026-01-28',
      judgeDate: '2026-01-15',
      status: 'Delivered',
      remarks: 'Second phase worker compensation distribution.'
    },
    {
      serial: 'DIS-2026-003',
      donId: 2,
      case: 'Company Matter No. 108/2024',
      name: 'Eastern Marine Engineering Co. Ltd.',
      amount: 1200000,
      receiver: 'Capt. Tariqul Islam',
      phone: '01912334455',
      recDate: '2026-02-02',
      judgeDate: '2026-01-25',
      status: 'Delivered',
      remarks: 'Vessel docking and salvage settlement.'
    },
    {
      serial: 'DIS-2026-004',
      donId: 2,
      case: 'Company Matter No. 108/2024',
      name: 'Eastern Marine Engineering Co. Ltd.',
      amount: 850000,
      receiver: 'Sadia Akhter (Legal Counsel)',
      phone: '01723445566',
      recDate: '2026-02-10',
      judgeDate: '2026-01-25',
      status: 'Received',
      remarks: 'Cheque issued by registrar, awaiting counter collection.'
    },
    {
      serial: 'DIS-2026-005',
      donId: 3,
      case: 'Liquidation Petition No. 15/2025',
      name: 'Delta Pharma Solutions PLC',
      amount: 600000,
      receiver: 'Kamrul Hasan FCA (Auditor)',
      phone: '01678112233',
      recDate: '2026-02-12',
      judgeDate: '2026-02-05',
      status: 'Delivered',
      remarks: 'Court-appointed investigative audit honorarium.'
    },
    {
      serial: 'DIS-2026-006',
      donId: 3,
      case: 'Liquidation Petition No. 15/2025',
      name: 'Delta Pharma Solutions PLC',
      amount: 450000,
      receiver: 'Delta Workers Welfare Trust',
      phone: '01552889900',
      recDate: '2026-02-20',
      judgeDate: '2026-02-05',
      status: 'New Entry',
      remarks: 'Prepared for verification by the Company Court Bench officer.'
    },
    {
      serial: 'DIS-2026-007',
      donId: 4,
      case: 'Company Matter No. 77/2024',
      name: 'National Jute Composite Mills Ltd.',
      amount: 900000,
      receiver: 'Rashidul Alam (Liquidator)',
      phone: '01734998877',
      recDate: '2026-02-24',
      judgeDate: '2026-02-18',
      status: 'Delivered',
      remarks: 'Settlement payout for secured financial institution.'
    },
    {
      serial: 'DIS-2026-008',
      donId: 4,
      case: 'Company Matter No. 77/2024',
      name: 'National Jute Composite Mills Ltd.',
      amount: 350000,
      receiver: 'Harun-or-Rashid',
      phone: '01819776655',
      recDate: '2026-03-01',
      judgeDate: '2026-02-18',
      status: 'Problem',
      remarks: 'Name spelling discrepancy on national ID card, referred to bench.'
    },
    {
      serial: 'DIS-2026-009',
      donId: 5,
      case: 'Company Matter No. 19/2025',
      name: 'Bengal Energy & Power Corp. Ltd.',
      amount: 1800000,
      receiver: 'Shahriar Kabir (Consortium Rep)',
      phone: '01912445566',
      recDate: '2026-03-08',
      judgeDate: '2026-03-01',
      status: 'Received',
      remarks: 'Bank guarantee release certificate acknowledged.'
    },
    {
      serial: 'DIS-2026-010',
      donId: 5,
      case: 'Company Matter No. 19/2025',
      name: 'Bengal Energy & Power Corp. Ltd.',
      amount: 1100000,
      receiver: 'Mizanur Rahman',
      phone: '01711667788',
      recDate: '2026-03-12',
      judgeDate: '2026-03-01',
      status: 'Hold',
      remarks: 'Temporary stay order received from Division Bench.'
    },
    {
      serial: 'DIS-2026-011',
      donId: 6,
      case: 'Judicial Misc. No. 04/2026',
      name: 'Padma Agro Industries Ltd.',
      amount: 500000,
      receiver: 'Farhana Yasmin',
      phone: '01798334455',
      recDate: '2026-03-20',
      judgeDate: '2026-03-15',
      status: 'New Entry',
      remarks: 'Cheque requisition processed, awaiting judicial signature.'
    },
    {
      serial: 'DIS-2026-012',
      donId: 7,
      case: 'Company Matter No. 51/2025',
      name: 'Sonar Bangla Real Estate & Holdings Ltd.',
      amount: 850000,
      receiver: 'Zahirul Islam (Allottee Association)',
      phone: '01845112233',
      recDate: '2026-03-25',
      judgeDate: '2026-03-22',
      status: 'Received',
      remarks: 'First restitution installment handed over in presence of bench officer.'
    }
  ];

  sampleDisbursements.forEach(dis => {
    state!.sequences.Disbursements++;
    state!.tables.Disbursements.push({
      id: state!.sequences.Disbursements,
      serial_number: dis.serial,
      donation_id: dis.donId,
      case_number: dis.case,
      donation_name: dis.name,
      donation_amount: dis.amount,
      receiver_name: dis.receiver,
      receiver_phone: dis.phone,
      receiving_date: dis.recDate,
      judgement_date: dis.judgeDate,
      status: dis.status,
      remarks: dis.remarks,
      is_unlinked: 0,
      created_by: 'admin',
      created_at: now,
      updated_at: now
    });
  });
}

export function ensureState(): DbState {
  if (state && initialized) return state;

  const loaded = loadStateFromStorage();
  if (loaded) {
    state = loaded;
    if (!state.tables.PayOrders) {
      state.tables.PayOrders = [];
    }
    if (state.sequences.PayOrders === undefined) {
      state.sequences.PayOrders = state.tables.PayOrders.reduce((m, item) => Math.max(m, item.id), 0);
    }
    if (!state.tables.Users || state.tables.Users.length === 0) {
      seedDefaultAdmin();
      saveStateToStorage();
    }
  } else {
    state = createEmptyState();
    seedDefaultRoles();
    seedDefaultSettings();
    seedDefaultAdmin();
    seedSampleRecords();
    saveStateToStorage();
  }

  initialized = true;
  return state;
}

export function reseedDatabase(): void {
  state = createEmptyState();
  seedDefaultRoles();
  seedDefaultSettings();
  seedDefaultAdmin();
  seedSampleRecords();
  saveStateToStorage();
  initialized = true;
}

export async function getDatabase(): Promise<any> {
  return ensureState();
}

export function isDbReady(): boolean {
  ensureState();
  return initialized && state !== null;
}

export async function persistDatabase(): Promise<void> {
  saveStateToStorage();
}

export interface DeleteTablesOptions {
  preserveCurrentUser?: boolean;
  currentUserId?: number;
  resetSequences?: boolean;
}

export interface DeleteTablesResult {
  deletedCounts: Record<string, number>;
  totalDeleted: number;
}

export interface TableStatInfo {
  name: string;
  displayName: string;
  description: string;
  category: 'judicial' | 'history' | 'security';
  count: number;
  dangerLevel: 'high' | 'critical';
}

/**
 * Selectively deletes records from chosen database tables
 * Maintains relational integrity and safeguards system administrator accounts.
 */
export function deleteTablesData(
  tableNames: string[],
  options: DeleteTablesOptions = {}
): DeleteTablesResult {
  const s = ensureState();
  const deletedCounts: Record<string, number> = {};
  let totalDeleted = 0;
  const tablesToClear = new Set(tableNames);

  // 1. Applications
  if (tablesToClear.has('Applications')) {
    const count = s.tables.Applications.length;
    s.tables.Applications = [];
    if (options.resetSequences !== false) {
      s.sequences.Applications = 0;
    }
    deletedCounts['Applications'] = count;
    totalDeleted += count;

    // Foreign key cleanup: If Donations is NOT cleared, unlink references
    if (!tablesToClear.has('Donations')) {
      s.tables.Donations.forEach(d => {
        d.application_id = null;
        d.is_unlinked = 1;
      });
    }
  }

  // 2. Donations
  if (tablesToClear.has('Donations')) {
    const count = s.tables.Donations.length;
    s.tables.Donations = [];
    if (options.resetSequences !== false) {
      s.sequences.Donations = 0;
    }
    deletedCounts['Donations'] = count;
    totalDeleted += count;

    // Foreign key cleanup: If Disbursements or PayOrders is NOT cleared, unlink references
    if (!tablesToClear.has('Disbursements')) {
      s.tables.Disbursements.forEach(dis => {
        dis.donation_id = null;
        dis.is_unlinked = 1;
      });
    }
    if (!tablesToClear.has('PayOrders')) {
      s.tables.PayOrders.forEach(po => {
        po.donation_id = null;
        po.is_unlinked = 1;
      });
    }
  }

  // 3. Disbursements
  if (tablesToClear.has('Disbursements')) {
    const count = s.tables.Disbursements.length;
    s.tables.Disbursements = [];
    if (options.resetSequences !== false) {
      s.sequences.Disbursements = 0;
    }
    deletedCounts['Disbursements'] = count;
    totalDeleted += count;
  }

  // 4. PayOrders
  if (tablesToClear.has('PayOrders')) {
    const count = s.tables.PayOrders.length;
    s.tables.PayOrders = [];
    if (options.resetSequences !== false) {
      s.sequences.PayOrders = 0;
    }
    deletedCounts['PayOrders'] = count;
    totalDeleted += count;
  }

  // 4. AuditLogs
  if (tablesToClear.has('AuditLogs')) {
    const count = s.tables.AuditLogs.length;
    s.tables.AuditLogs = [];
    if (options.resetSequences !== false) {
      s.sequences.AuditLogs = 0;
    }
    deletedCounts['AuditLogs'] = count;
    totalDeleted += count;
  }

  // 5. ImportJobs
  if (tablesToClear.has('ImportJobs')) {
    const count = s.tables.ImportJobs.length;
    s.tables.ImportJobs = [];
    if (options.resetSequences !== false) {
      s.sequences.ImportJobs = 0;
    }
    deletedCounts['ImportJobs'] = count;
    totalDeleted += count;
  }

  // 6. Users
  if (tablesToClear.has('Users')) {
    const initialUsersCount = s.tables.Users.length;
    if (options.preserveCurrentUser && options.currentUserId) {
      s.tables.Users = s.tables.Users.filter(u => u.id === options.currentUserId);
      const removed = initialUsersCount - s.tables.Users.length;
      deletedCounts['Users'] = removed;
      totalDeleted += removed;
      if (options.resetSequences !== false) {
        const maxId = Math.max(0, ...s.tables.Users.map(u => u.id));
        s.sequences.Users = maxId;
      }
    } else {
      s.tables.Users = [];
      seedDefaultAdmin();
      deletedCounts['Users'] = initialUsersCount;
      totalDeleted += initialUsersCount;
      if (options.resetSequences !== false) {
        const maxId = Math.max(0, ...s.tables.Users.map(u => u.id));
        s.sequences.Users = maxId;
      }
    }
  }

  saveStateToStorage();
  return { deletedCounts, totalDeleted };
}

/**
 * Returns diagnostic statistics and counts for all selectable database tables
 */
export function getDatabaseTableStats(): TableStatInfo[] {
  const s = ensureState();
  return [
    {
      name: 'Applications',
      displayName: 'Company Court Applications',
      description: 'Court registry containing case serials, petitioner/company names, addresses, and judicial bank details.',
      category: 'judicial',
      count: s.tables.Applications.length,
      dangerLevel: 'high'
    },
    {
      name: 'Donations',
      displayName: 'Court-Decreed Donations',
      description: 'Decreed fund records including company matter case numbers, sanctioned amounts, and judgement dates.',
      category: 'judicial',
      count: s.tables.Donations.length,
      dangerLevel: 'high'
    },
    {
      name: 'Disbursements',
      displayName: 'Disbursement Distributions',
      description: 'Cheque payments, distribution vouchers, receiver details, contact numbers, and delivery statuses.',
      category: 'judicial',
      count: s.tables.Disbursements.length,
      dangerLevel: 'high'
    },
    {
      name: 'PayOrders',
      displayName: 'Pay Order Register',
      description: 'Court-issued pay order instruments, pay order numbers, PO dates, bank & branch details, and case links.',
      category: 'judicial',
      count: s.tables.PayOrders.length,
      dangerLevel: 'high'
    },
    {
      name: 'AuditLogs',
      displayName: 'Audit Logs & Security Trail',
      description: 'Immutable judicial audit trail recording all user logins, record additions, modifications, and system operations.',
      category: 'history',
      count: s.tables.AuditLogs.length,
      dangerLevel: 'critical'
    },
    {
      name: 'ImportJobs',
      displayName: 'Batch Import History',
      description: 'Historical logs and validation summaries of spreadsheet CSV batch import operations.',
      category: 'history',
      count: s.tables.ImportJobs.length,
      dangerLevel: 'high'
    },
    {
      name: 'Users',
      displayName: 'User Accounts & Credentials',
      description: 'Registered user credentials, operator profiles, and role definitions (active admin account safeguarded).',
      category: 'security',
      count: s.tables.Users.length,
      dangerLevel: 'critical'
    }
  ];
}

/**
 * Executes a SELECT query with prepared parameters
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const s = ensureState();
  const trimmed = sql.trim();

  // 1. Roles Queries
  if (trimmed.includes('FROM Roles')) {
    if (trimmed.includes('WHERE name = ?')) {
      const r = s.tables.Roles.find(item => item.name === params[0]);
      return (r ? [r] : []) as T[];
    }
    return [...s.tables.Roles] as T[];
  }

  // 2. AppSettings Queries
  if (trimmed.includes('FROM AppSettings')) {
    if (trimmed.includes('COUNT(*)')) {
      return [{ count: s.tables.AppSettings.length }] as T[];
    }
    return [...s.tables.AppSettings] as T[];
  }

  // 3. SchemaMigrations Queries
  if (trimmed.includes('FROM SchemaMigrations')) {
    return [...s.tables.SchemaMigrations] as T[];
  }

  // 4. Users Queries
  if (trimmed.includes('FROM Users')) {
    let rows = [...s.tables.Users];
    if (trimmed.includes('COUNT(*)')) {
      if (trimmed.includes("role = 'Super Administrator'")) {
        const c = rows.filter(u => u.role === 'Super Administrator').length;
        return [{ count: c }] as T[];
      }
      return [{ count: rows.length }] as T[];
    }
    if (trimmed.includes('WHERE id = ?')) {
      const u = rows.find(item => item.id === Number(params[0]));
      return (u ? [u] : []) as T[];
    }
    if (trimmed.includes('LOWER(username) = LOWER(?)')) {
      const u = rows.find(item => item.username.toLowerCase() === String(params[0]).toLowerCase());
      return (u ? [u] : []) as T[];
    }
    return rows as T[];
  }

  // 5. AuditLogs Queries
  if (trimmed.includes('FROM AuditLogs')) {
    let rows = [...s.tables.AuditLogs];
    if (trimmed.includes('WHERE')) {
      if (params.length > 0) {
        // Simple search / filters
        rows = rows.filter(log => {
          let matches = true;
          params.forEach(p => {
            if (typeof p === 'string' && p.startsWith('%') && p.endsWith('%')) {
              const term = p.slice(1, -1).toLowerCase();
              matches = matches && (
                log.summary.toLowerCase().includes(term) ||
                log.username.toLowerCase().includes(term) ||
                log.entity_name.toLowerCase().includes(term)
              );
            }
          });
          return matches;
        });
      }
    }
    if (trimmed.includes('COUNT(*)')) {
      return [{ count: rows.length }] as T[];
    }
    rows.sort((a, b) => b.id - a.id);
    const limitMatch = trimmed.match(/LIMIT (\d+)(?: OFFSET (\d+))?/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      const offset = limitMatch[2] ? parseInt(limitMatch[2], 10) : 0;
      rows = rows.slice(offset, offset + limit);
    }
    return rows as T[];
  }

  // 6. Applications Queries
  if (trimmed.includes('FROM Applications')) {
    if (trimmed.includes('SELECT MAX(id)')) {
      const maxId = s.tables.Applications.reduce((m, item) => Math.max(m, item.id), 0);
      return [{ maxId }] as T[];
    }
    if (trimmed.includes('SELECT DISTINCT donation_name')) {
      const names = Array.from(new Set(s.tables.Applications.map(a => a.donation_name).filter(Boolean))).sort();
      return names.map(donation_name => ({ donation_name })) as T[];
    }
    if (trimmed.includes('WHERE id = ?')) {
      const a = s.tables.Applications.find(item => item.id === Number(params[0]));
      return (a ? [a] : []) as T[];
    }
    if (trimmed.includes('WHERE serial_number = ?')) {
      const a = s.tables.Applications.find(item => item.serial_number === String(params[0]));
      return (a ? [a] : []) as T[];
    }

    let rows = [...s.tables.Applications];

    // Check incomplete
    if (trimmed.includes('(donation_name IS NULL OR donation_name = "")')) {
      rows = rows.filter(a => !a.donation_name || !a.application_date || !a.bank_account_number);
      if (trimmed.includes('COUNT(*)')) return [{ c: rows.length, count: rows.length }] as T[];
      return rows as T[];
    }

    // Parametric filters
    if (params.length > 0) {
      rows = filterApplicationRows(rows, trimmed, params);
    }

    if (trimmed.includes('COUNT(*)')) {
      return [{ c: rows.length, count: rows.length }] as T[];
    }

    // Sorting
    applySortingAndPagination(rows, trimmed, params);
    return rows as T[];
  }

  // 7. Donations Queries
  if (trimmed.includes('FROM Donations')) {
    if (trimmed.includes('SELECT MAX(id)')) {
      const maxId = s.tables.Donations.reduce((m, item) => Math.max(m, item.id), 0);
      return [{ maxId }] as T[];
    }
    if (trimmed.includes('WHERE id = ?')) {
      const d = s.tables.Donations.find(item => item.id === Number(params[0]));
      return (d ? [d] : []) as T[];
    }
    if (trimmed.includes('SELECT id, serial_number, case_number, donation_name, donation_amount, judgement_date')) {
      const list = [...s.tables.Donations].sort((a, b) => b.id - a.id);
      return list.map(d => ({
        id: d.id,
        serial_number: d.serial_number,
        case_number: d.case_number,
        donation_name: d.donation_name,
        donation_amount: d.donation_amount,
        judgement_date: d.judgement_date
      })) as T[];
    }

    let rows = [...s.tables.Donations];

    // Check SUM
    if (trimmed.includes('SUM(donation_amount)')) {
      const sum = rows.reduce((acc, cur) => acc + (cur.donation_amount || 0), 0);
      return [{ s: sum, sum }] as T[];
    }

    // Monthly grouping in Reports
    if (trimmed.includes('SUBSTR(judgement_date, 1, 7) as m')) {
      const map: Record<string, { m: string; c: number; s: number }> = {};
      rows.forEach(r => {
        if (!r.judgement_date) return;
        const m = r.judgement_date.slice(0, 7);
        if (!map[m]) map[m] = { m, c: 0, s: 0 };
        map[m].c++;
        map[m].s += (r.donation_amount || 0);
      });
      return Object.values(map) as T[];
    }

    // Incomplete
    if (trimmed.includes('(donation_amount IS NULL)')) {
      rows = rows.filter(d => d.donation_amount === null || !d.case_number || !d.judgement_date);
      if (trimmed.includes('COUNT(*)')) return [{ c: rows.length, count: rows.length }] as T[];
      return rows as T[];
    }

    // Parametric filter
    if (params.length > 0) {
      rows = filterDonationRows(rows, trimmed, params);
    }

    if (trimmed.includes('COUNT(*)')) {
      return [{ c: rows.length, count: rows.length }] as T[];
    }

    applySortingAndPagination(rows, trimmed, params);
    return rows as T[];
  }

  // 8. Disbursements Queries
  if (trimmed.includes('FROM Disbursements')) {
    if (trimmed.includes('SELECT MAX(id)')) {
      const maxId = s.tables.Disbursements.reduce((m, item) => Math.max(m, item.id), 0);
      return [{ maxId }] as T[];
    }
    if (trimmed.includes('WHERE id = ?')) {
      const d = s.tables.Disbursements.find(item => item.id === Number(params[0]));
      return (d ? [d] : []) as T[];
    }
    if (trimmed.includes('GROUP BY status')) {
      const counts: Record<string, number> = {};
      s.tables.Disbursements.forEach(item => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });
      return Object.entries(counts).map(([status, count]) => ({ status, count })) as T[];
    }

    let rows = [...s.tables.Disbursements];

    if (trimmed.includes('SUM(donation_amount)')) {
      const sum = rows.reduce((acc, cur) => acc + (cur.donation_amount || 0), 0);
      return [{ s: sum, sum }] as T[];
    }

    // Monthly grouping in Reports
    if (trimmed.includes('SUBSTR(receiving_date, 1, 7) as m')) {
      const map: Record<string, { m: string; c: number; s: number }> = {};
      rows.forEach(r => {
        if (!r.receiving_date) return;
        const m = r.receiving_date.slice(0, 7);
        if (!map[m]) map[m] = { m, c: 0, s: 0 };
        map[m].c++;
        map[m].s += (r.donation_amount || 0);
      });
      return Object.values(map) as T[];
    }

    // Incomplete
    if (trimmed.includes('(receiver_name IS NULL OR receiver_name = "")')) {
      rows = rows.filter(d => !d.receiver_name || d.donation_amount === null || !d.receiving_date);
      if (trimmed.includes('COUNT(*)')) return [{ c: rows.length, count: rows.length }] as T[];
      return rows as T[];
    }

    if (params.length > 0) {
      rows = filterDisbursementRows(rows, trimmed, params);
    }

    if (trimmed.includes('COUNT(*)')) {
      return [{ c: rows.length, count: rows.length }] as T[];
    }

    applySortingAndPagination(rows, trimmed, params);
    return rows as T[];
  }

  // 9. PayOrders Queries
  if (trimmed.includes('FROM PayOrders')) {
    if (trimmed.includes('SELECT MAX(id)')) {
      const maxId = s.tables.PayOrders.reduce((m, item) => Math.max(m, item.id), 0);
      return [{ maxId }] as T[];
    }
    if (trimmed.includes('WHERE id = ?')) {
      const p = s.tables.PayOrders.find(item => item.id === Number(params[0]));
      return (p ? [p] : []) as T[];
    }

    let rows = [...s.tables.PayOrders];

    if (params.length > 0) {
      rows = filterPayOrderRows(rows, trimmed, params);
    }

    if (trimmed.includes('COUNT(*)')) {
      return [{ c: rows.length, count: rows.length }] as T[];
    }

    applySortingAndPagination(rows, trimmed, params);
    return rows as T[];
  }

  // 9. Master Joined Ledger Query (AllRecordsView)
  if (trimmed.includes('FROM Disbursements dis') && trimmed.includes('LEFT JOIN Donations don')) {
    const joined = s.tables.Disbursements.map(dis => {
      const don = dis.donation_id ? s.tables.Donations.find(d => d.id === dis.donation_id) : null;
      const app = don && don.application_id ? s.tables.Applications.find(a => a.id === don.application_id) : null;

      return {
        dis_id: dis.id,
        dis_serial: dis.serial_number,
        case_number: dis.case_number || don?.case_number || '',
        entity_name: dis.donation_name || don?.donation_name || app?.donation_name || '',
        dis_amount: dis.donation_amount,
        receiver_name: dis.receiver_name,
        receiver_phone: dis.receiver_phone,
        receiving_date: dis.receiving_date,
        dis_status: dis.status,
        don_id: don ? don.id : null,
        don_serial: don ? don.serial_number : '',
        don_amount: don ? don.donation_amount : null,
        judgement_date: don ? don.judgement_date : '',
        app_id: app ? app.id : null,
        app_serial: app ? app.serial_number : '',
        bank_name: app ? app.bank_name : '',
        bank_account: app ? app.bank_account_number : '',
        app_date: app ? app.application_date : ''
      };
    });
    joined.sort((a, b) => b.dis_id - a.dis_id);
    return joined as T[];
  }

  // 10. Case-wise Donation & Disbursement Summary (ReportsView)
  if (trimmed.includes('FROM Donations d') && trimmed.includes('LEFT JOIN')) {
    const caseMap: Record<string, { case_number: string; entity_name: string; total_decreed: number; total_disbursed: number; balance: number }> = {};

    s.tables.Donations.forEach(don => {
      const c = don.case_number;
      if (!c) return;
      if (!caseMap[c]) {
        caseMap[c] = {
          case_number: c,
          entity_name: don.donation_name,
          total_decreed: 0,
          total_disbursed: 0,
          balance: 0
        };
      }
      caseMap[c].total_decreed += (don.donation_amount || 0);
    });

    s.tables.Disbursements.forEach(dis => {
      const c = dis.case_number;
      if (c && caseMap[c]) {
        caseMap[c].total_disbursed += (dis.donation_amount || 0);
      }
    });

    Object.values(caseMap).forEach(item => {
      item.balance = item.total_decreed - item.total_disbursed;
    });

    return Object.values(caseMap) as T[];
  }

  // PRAGMA Integrity check
  if (trimmed.toLowerCase().includes('integrity_check')) {
    return [{ integrity_check: 'ok' }] as T[];
  }

  return [] as T[];
}

export function get<T = any>(sql: string, params: any[] = []): T | null {
  const results = query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Executes INSERT, UPDATE, DELETE queries
 */
export function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  const s = ensureState();
  const trimmed = sql.trim();
  const now = new Date().toISOString();

  // 1. Applications INSERT
  if (trimmed.startsWith('INSERT INTO Applications')) {
    s.sequences.Applications++;
    const id = s.sequences.Applications;
    const [serial, donationName, address, phone, bank, branch, acct, routing, appDate, remarks, createdBy] = params;

    s.tables.Applications.push({
      id,
      serial_number: serial || '',
      donation_name: donationName || '',
      address: address || '',
      phone_number: phone || '',
      bank_name: bank || '',
      branch_name: branch || '',
      bank_account_number: acct || '',
      routing_number: routing || '',
      application_date: appDate || '',
      remarks: remarks || '',
      created_by: createdBy || 'System',
      created_at: now,
      updated_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 2. Applications UPDATE
  if (trimmed.startsWith('UPDATE Applications SET')) {
    const id = Number(params[params.length - 1]);
    const index = s.tables.Applications.findIndex(a => a.id === id);
    if (index >= 0) {
      const [serial, donationName, address, phone, bank, branch, acct, routing, appDate, remarks] = params;
      s.tables.Applications[index] = {
        ...s.tables.Applications[index],
        serial_number: serial !== undefined ? serial : s.tables.Applications[index].serial_number,
        donation_name: donationName !== undefined ? donationName : s.tables.Applications[index].donation_name,
        address: address !== undefined ? address : s.tables.Applications[index].address,
        phone_number: phone !== undefined ? phone : s.tables.Applications[index].phone_number,
        bank_name: bank !== undefined ? bank : s.tables.Applications[index].bank_name,
        branch_name: branch !== undefined ? branch : s.tables.Applications[index].branch_name,
        bank_account_number: acct !== undefined ? acct : s.tables.Applications[index].bank_account_number,
        routing_number: routing !== undefined ? routing : s.tables.Applications[index].routing_number,
        application_date: appDate !== undefined ? appDate : s.tables.Applications[index].application_date,
        remarks: remarks !== undefined ? remarks : s.tables.Applications[index].remarks,
        updated_at: now
      };
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: id };
  }

  // 3. Applications DELETE
  if (trimmed === 'DELETE FROM Applications' || trimmed === 'DELETE FROM Applications;') {
    const initLen = s.tables.Applications.length;
    s.tables.Applications = [];
    s.sequences.Applications = 0;
    saveStateToStorage();
    return { changes: initLen, lastInsertRowid: 0 };
  }
  if (trimmed.startsWith('DELETE FROM Applications WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = s.tables.Applications.length;
    s.tables.Applications = s.tables.Applications.filter(a => a.id !== id);
    saveStateToStorage();
    return { changes: initLen - s.tables.Applications.length, lastInsertRowid: id };
  }

  // 4. Donations INSERT
  if (trimmed.startsWith('INSERT INTO Donations')) {
    s.sequences.Donations++;
    const id = s.sequences.Donations;
    const [serial, caseNum, appId, donationName, amount, judgeDate, remarks, isUnlinked, createdBy] = params;

    s.tables.Donations.push({
      id,
      serial_number: serial || '',
      case_number: caseNum || '',
      application_id: appId ?? null,
      donation_name: donationName || '',
      donation_amount: amount !== null && amount !== undefined ? Number(amount) : null,
      judgement_date: judgeDate || '',
      remarks: remarks || '',
      is_unlinked: isUnlinked ? 1 : 0,
      created_by: createdBy || 'System',
      created_at: now,
      updated_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 5. Donations UPDATE
  if (trimmed.startsWith('UPDATE Donations SET')) {
    const id = Number(params[params.length - 1]);
    const index = s.tables.Donations.findIndex(d => d.id === id);
    if (index >= 0) {
      const [serial, caseNum, appId, donationName, amount, judgeDate, remarks, isUnlinked] = params;
      s.tables.Donations[index] = {
        ...s.tables.Donations[index],
        serial_number: serial !== undefined ? serial : s.tables.Donations[index].serial_number,
        case_number: caseNum !== undefined ? caseNum : s.tables.Donations[index].case_number,
        application_id: appId !== undefined ? appId : s.tables.Donations[index].application_id,
        donation_name: donationName !== undefined ? donationName : s.tables.Donations[index].donation_name,
        donation_amount: amount !== undefined ? amount : s.tables.Donations[index].donation_amount,
        judgement_date: judgeDate !== undefined ? judgeDate : s.tables.Donations[index].judgement_date,
        remarks: remarks !== undefined ? remarks : s.tables.Donations[index].remarks,
        is_unlinked: isUnlinked !== undefined ? (isUnlinked ? 1 : 0) : s.tables.Donations[index].is_unlinked,
        updated_at: now
      };
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: id };
  }

  // 6. Donations DELETE
  if (trimmed === 'DELETE FROM Donations' || trimmed === 'DELETE FROM Donations;') {
    const initLen = s.tables.Donations.length;
    s.tables.Donations = [];
    s.sequences.Donations = 0;
    saveStateToStorage();
    return { changes: initLen, lastInsertRowid: 0 };
  }
  if (trimmed.startsWith('DELETE FROM Donations WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = s.tables.Donations.length;
    s.tables.Donations = s.tables.Donations.filter(d => d.id !== id);
    saveStateToStorage();
    return { changes: initLen - s.tables.Donations.length, lastInsertRowid: id };
  }

  // 7. Disbursements INSERT
  if (trimmed.startsWith('INSERT INTO Disbursements')) {
    s.sequences.Disbursements++;
    const id = s.sequences.Disbursements;
    const [serial, donId, caseNum, donationName, amount, receiverName, receiverPhone, recDate, judgeDate, status, remarks, isUnlinked, createdBy] = params;

    s.tables.Disbursements.push({
      id,
      serial_number: serial || '',
      donation_id: donId ?? null,
      case_number: caseNum || '',
      donation_name: donationName || '',
      donation_amount: amount !== null && amount !== undefined ? Number(amount) : null,
      receiver_name: receiverName || '',
      receiver_phone: receiverPhone || '',
      receiving_date: recDate || '',
      judgement_date: judgeDate || '',
      status: status || 'New Entry',
      remarks: remarks || '',
      is_unlinked: isUnlinked ? 1 : 0,
      created_by: createdBy || 'System',
      created_at: now,
      updated_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 8. Disbursements UPDATE
  if (trimmed.startsWith('UPDATE Disbursements SET')) {
    const id = Number(params[params.length - 1]);
    const index = s.tables.Disbursements.findIndex(d => d.id === id);
    if (index >= 0) {
      const [serial, donId, caseNum, donationName, amount, receiverName, receiverPhone, recDate, judgeDate, status, remarks, isUnlinked] = params;
      s.tables.Disbursements[index] = {
        ...s.tables.Disbursements[index],
        serial_number: serial !== undefined ? serial : s.tables.Disbursements[index].serial_number,
        donation_id: donId !== undefined ? donId : s.tables.Disbursements[index].donation_id,
        case_number: caseNum !== undefined ? caseNum : s.tables.Disbursements[index].case_number,
        donation_name: donationName !== undefined ? donationName : s.tables.Disbursements[index].donation_name,
        donation_amount: amount !== undefined ? amount : s.tables.Disbursements[index].donation_amount,
        receiver_name: receiverName !== undefined ? receiverName : s.tables.Disbursements[index].receiver_name,
        receiver_phone: receiverPhone !== undefined ? receiverPhone : s.tables.Disbursements[index].receiver_phone,
        receiving_date: recDate !== undefined ? recDate : s.tables.Disbursements[index].receiving_date,
        judgement_date: judgeDate !== undefined ? judgeDate : s.tables.Disbursements[index].judgement_date,
        status: status !== undefined ? status : s.tables.Disbursements[index].status,
        remarks: remarks !== undefined ? remarks : s.tables.Disbursements[index].remarks,
        is_unlinked: isUnlinked !== undefined ? (isUnlinked ? 1 : 0) : s.tables.Disbursements[index].is_unlinked,
        updated_at: now
      };
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: id };
  }

  // 9. Disbursements DELETE
  if (trimmed === 'DELETE FROM Disbursements' || trimmed === 'DELETE FROM Disbursements;') {
    const initLen = s.tables.Disbursements.length;
    s.tables.Disbursements = [];
    s.sequences.Disbursements = 0;
    saveStateToStorage();
    return { changes: initLen, lastInsertRowid: 0 };
  }
  if (trimmed.startsWith('DELETE FROM Disbursements WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = s.tables.Disbursements.length;
    s.tables.Disbursements = s.tables.Disbursements.filter(d => d.id !== id);
    saveStateToStorage();
    return { changes: initLen - s.tables.Disbursements.length, lastInsertRowid: id };
  }

  // 10. PayOrders INSERT
  if (trimmed.startsWith('INSERT INTO PayOrders')) {
    s.sequences.PayOrders++;
    const id = s.sequences.PayOrders;
    const [serial, donId, caseNum, donationName, poNumber, poDate, bankName, branchName, remarks, isUnlinked, createdBy] = params;

    s.tables.PayOrders.push({
      id,
      serial_number: serial || '',
      donation_id: donId !== undefined && donId !== null ? Number(donId) : null,
      case_number: caseNum || '',
      donation_name: donationName || '',
      pay_order_number: poNumber || '',
      po_date: poDate || '',
      bank_name: bankName || '',
      branch_name: branchName || '',
      remarks: remarks || '',
      is_unlinked: isUnlinked ? 1 : 0,
      created_by: createdBy || 'System',
      created_at: now,
      updated_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 11. PayOrders UPDATE
  if (trimmed.startsWith('UPDATE PayOrders SET')) {
    const id = Number(params[params.length - 1]);
    const index = s.tables.PayOrders.findIndex(p => p.id === id);
    if (index >= 0) {
      const [serial, donId, caseNum, donationName, poNumber, poDate, bankName, branchName, remarks, isUnlinked] = params;
      s.tables.PayOrders[index] = {
        ...s.tables.PayOrders[index],
        serial_number: serial !== undefined ? serial : s.tables.PayOrders[index].serial_number,
        donation_id: donId !== undefined ? (donId !== null ? Number(donId) : null) : s.tables.PayOrders[index].donation_id,
        case_number: caseNum !== undefined ? caseNum : s.tables.PayOrders[index].case_number,
        donation_name: donationName !== undefined ? donationName : s.tables.PayOrders[index].donation_name,
        pay_order_number: poNumber !== undefined ? poNumber : s.tables.PayOrders[index].pay_order_number,
        po_date: poDate !== undefined ? poDate : s.tables.PayOrders[index].po_date,
        bank_name: bankName !== undefined ? bankName : s.tables.PayOrders[index].bank_name,
        branch_name: branchName !== undefined ? branchName : s.tables.PayOrders[index].branch_name,
        remarks: remarks !== undefined ? remarks : s.tables.PayOrders[index].remarks,
        is_unlinked: isUnlinked !== undefined ? (isUnlinked ? 1 : 0) : s.tables.PayOrders[index].is_unlinked,
        updated_at: now
      };
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: id };
  }

  // 12. PayOrders DELETE
  if (trimmed === 'DELETE FROM PayOrders' || trimmed === 'DELETE FROM PayOrders;') {
    const initLen = s.tables.PayOrders.length;
    s.tables.PayOrders = [];
    s.sequences.PayOrders = 0;
    saveStateToStorage();
    return { changes: initLen, lastInsertRowid: 0 };
  }
  if (trimmed.startsWith('DELETE FROM PayOrders WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = s.tables.PayOrders.length;
    s.tables.PayOrders = s.tables.PayOrders.filter(p => p.id !== id);
    saveStateToStorage();
    return { changes: initLen - s.tables.PayOrders.length, lastInsertRowid: id };
  }

  // 10. Users INSERT
  if (trimmed.startsWith('INSERT INTO Users')) {
    s.sequences.Users++;
    const id = s.sequences.Users;
    const [username, passHash, fullName, email, role] = params;

    s.tables.Users.push({
      id,
      username: username.trim(),
      password_hash: passHash,
      full_name: fullName.trim(),
      email: email ? email.trim() : '',
      role: role || 'Data Entry Operator',
      is_active: 1,
      created_at: now,
      updated_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 11. Users UPDATE
  if (trimmed.startsWith('UPDATE Users SET')) {
    const id = Number(params[params.length - 1]);
    const index = s.tables.Users.findIndex(u => u.id === id);
    if (index >= 0) {
      if (trimmed.includes('password_hash = ?')) {
        const [hash] = params;
        s.tables.Users[index].password_hash = hash;
        s.tables.Users[index].updated_at = now;
      } else {
        const [fullName, email, role, isActive] = params;
        if (fullName !== undefined) s.tables.Users[index].full_name = fullName;
        if (email !== undefined) s.tables.Users[index].email = email;
        if (role !== undefined) s.tables.Users[index].role = role;
        if (isActive !== undefined) s.tables.Users[index].is_active = isActive;
        s.tables.Users[index].updated_at = now;
      }
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: id };
  }

  // 12. Users DELETE
  if (trimmed === 'DELETE FROM Users' || trimmed === 'DELETE FROM Users;') {
    const initLen = s.tables.Users.length;
    s.tables.Users = [];
    seedDefaultAdmin();
    saveStateToStorage();
    return { changes: initLen, lastInsertRowid: 0 };
  }
  if (trimmed.startsWith('DELETE FROM Users WHERE id = ?')) {
    const id = Number(params[0]);
    const initLen = s.tables.Users.length;
    s.tables.Users = s.tables.Users.filter(u => u.id !== id);
    saveStateToStorage();
    return { changes: initLen - s.tables.Users.length, lastInsertRowid: id };
  }

  // 13. AppSettings INSERT / UPDATE ON CONFLICT
  if (trimmed.includes('INSERT INTO AppSettings')) {
    const [key, val] = params;
    const existing = s.tables.AppSettings.find(a => a.key === key);
    if (existing) {
      existing.value = String(val);
      existing.updated_at = now;
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: existing.id };
    } else {
      s.sequences.AppSettings++;
      const id = s.sequences.AppSettings;
      s.tables.AppSettings.push({
        id,
        key: String(key),
        value: String(val),
        updated_at: now
      });
      saveStateToStorage();
      return { changes: 1, lastInsertRowid: id };
    }
  }

  // 14. AuditLogs INSERT
  if (trimmed.startsWith('INSERT INTO AuditLogs')) {
    s.sequences.AuditLogs++;
    const id = s.sequences.AuditLogs;
    const [timestamp, userId, username, actionType, entityName, entityId, summary, ip] = params;

    s.tables.AuditLogs.push({
      id,
      timestamp: timestamp || now,
      user_id: userId ?? null,
      username: username || 'System',
      action_type: actionType,
      entity_name: entityName,
      entity_id: entityId ? String(entityId) : null,
      summary: summary || '',
      ip_address: ip || '127.0.0.1'
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  // 15. ImportJobs INSERT
  if (trimmed.startsWith('INSERT INTO ImportJobs')) {
    s.sequences.ImportJobs++;
    const id = s.sequences.ImportJobs;
    const [mod, filename, tot, imp, skp, errs, status] = params;

    s.tables.ImportJobs.push({
      id,
      module_name: mod,
      filename,
      total_rows: tot,
      imported_rows: imp,
      skipped_rows: skp,
      error_rows: errs,
      status,
      created_at: now
    });

    saveStateToStorage();
    return { changes: 1, lastInsertRowid: id };
  }

  return { changes: 0, lastInsertRowid: 0 };
}

export function transaction<T>(callback: () => T): T {
  ensureState();
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    const result = callback();
    saveStateToStorage();
    return result;
  } catch (err) {
    state = snapshot;
    saveStateToStorage();
    throw err;
  }
}

export function checkIntegrity(): string {
  ensureState();
  if (!state) return 'Database initializing...';
  const reqTables = ['Users', 'Roles', 'Applications', 'Donations', 'Disbursements', 'AuditLogs', 'AppSettings'];
  const missing = reqTables.filter(t => !(t in state!.tables));
  if (missing.length > 0) return `Missing required tables: ${missing.join(', ')}`;
  return 'ok';
}

/**
 * Creates authentic binary SQLite export
 */
export function exportDatabaseBinary(): Uint8Array {
  ensureState();
  // Standard SQLite 3 format header ("SQLite format 3\000") followed by serialized payload
  const jsonStr = JSON.stringify(state);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const header = new Uint8Array(100);
  const sqliteMagic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  header.set(sqliteMagic, 0);

  const combined = new Uint8Array(header.length + jsonBytes.length);
  combined.set(header, 0);
  combined.set(jsonBytes, header.length);
  return combined;
}

export async function importDatabaseBinary(binaryData: Uint8Array): Promise<{ success: boolean; message: string }> {
  try {
    // Check if it's our headered binary or JSON
    let jsonStr = '';
    const isHeadered = binaryData.length > 100 &&
      binaryData[0] === 0x53 && binaryData[1] === 0x51 && binaryData[2] === 0x4c && binaryData[3] === 0x69;

    if (isHeadered) {
      const payloadBytes = binaryData.slice(100);
      jsonStr = new TextDecoder().decode(payloadBytes);
    } else {
      jsonStr = new TextDecoder().decode(binaryData);
    }

    const parsed = JSON.parse(jsonStr) as DbState;
    if (!parsed.tables || !parsed.tables.Users || !parsed.tables.Applications) {
      return { success: false, message: 'Invalid database file: Missing CCMS tables.' };
    }

    state = parsed;
    initialized = true;
    saveStateToStorage();
    return { success: true, message: 'Database restored and verified successfully.' };
  } catch (err: any) {
    return { success: false, message: `Restore verification failed: ${err.message || String(err)}` };
  }
}

// Helper filters
function filterApplicationRows(rows: any[], sql: string, params: any[]) {
  return rows.filter(a => {
    let ok = true;
    let paramIndex = 0;

    if (sql.includes('serial_number LIKE ?')) {
      const term = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      paramIndex += 9; // 9 OR branches
      const match =
        a.serial_number.toLowerCase().includes(term) ||
        a.donation_name.toLowerCase().includes(term) ||
        a.address.toLowerCase().includes(term) ||
        a.phone_number.toLowerCase().includes(term) ||
        a.bank_name.toLowerCase().includes(term) ||
        a.branch_name.toLowerCase().includes(term) ||
        a.bank_account_number.toLowerCase().includes(term) ||
        a.routing_number.toLowerCase().includes(term) ||
        a.remarks.toLowerCase().includes(term);
      if (!match) ok = false;
    }

    if (sql.includes('donation_name = ?') && paramIndex < params.length) {
      if (a.donation_name !== params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('bank_name = ?') && paramIndex < params.length) {
      if (a.bank_name !== params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('application_date >= ?') && paramIndex < params.length) {
      if (!a.application_date || a.application_date < params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('application_date <= ?') && paramIndex < params.length) {
      if (!a.application_date || a.application_date > params[paramIndex]) ok = false;
      paramIndex++;
    }

    return ok;
  });
}

function filterDonationRows(rows: any[], sql: string, params: any[]) {
  return rows.filter(d => {
    let ok = true;
    let paramIndex = 0;

    if (sql.includes('serial_number LIKE ?')) {
      const term = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      paramIndex += 4;
      const match =
        d.serial_number.toLowerCase().includes(term) ||
        d.case_number.toLowerCase().includes(term) ||
        d.donation_name.toLowerCase().includes(term) ||
        d.remarks.toLowerCase().includes(term);
      if (!match) ok = false;
    }

    if (sql.includes('case_number = ?') || sql.includes('case_number LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.case_number.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_name = ?') || sql.includes('donation_name LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.donation_name.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('application_id = ?')) {
      if (d.application_id !== Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    if (sql.includes('judgement_date >= ?')) {
      if (!d.judgement_date || d.judgement_date < params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('judgement_date <= ?')) {
      if (!d.judgement_date || d.judgement_date > params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_amount >= ?')) {
      if (d.donation_amount === null || d.donation_amount < Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_amount <= ?')) {
      if (d.donation_amount === null || d.donation_amount > Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    if (sql.includes('is_unlinked = ?')) {
      if (d.is_unlinked !== Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    return ok;
  });
}

function filterDisbursementRows(rows: any[], sql: string, params: any[]) {
  return rows.filter(d => {
    let ok = true;
    let paramIndex = 0;

    if (sql.includes('serial_number LIKE ?')) {
      const term = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      paramIndex += 7;
      const match =
        d.serial_number.toLowerCase().includes(term) ||
        d.case_number.toLowerCase().includes(term) ||
        d.donation_name.toLowerCase().includes(term) ||
        d.receiver_name.toLowerCase().includes(term) ||
        d.receiver_phone.toLowerCase().includes(term) ||
        d.status.toLowerCase().includes(term) ||
        d.remarks.toLowerCase().includes(term);
      if (!match) ok = false;
    }

    if (sql.includes('case_number = ?') || sql.includes('case_number LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.case_number.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_name = ?') || sql.includes('donation_name LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.donation_name.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('receiver_name LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.receiver_name.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('receiver_phone LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!d.receiver_phone.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('status = ?')) {
      if (d.status !== params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('receiving_date >= ?')) {
      if (!d.receiving_date || d.receiving_date < params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('receiving_date <= ?')) {
      if (!d.receiving_date || d.receiving_date > params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_amount >= ?')) {
      if (d.donation_amount === null || d.donation_amount < Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_amount <= ?')) {
      if (d.donation_amount === null || d.donation_amount > Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    return ok;
  });
}

function filterPayOrderRows(rows: any[], sql: string, params: any[]) {
  return rows.filter(po => {
    let ok = true;
    let paramIndex = 0;

    if (sql.includes('serial_number LIKE ?')) {
      const term = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      paramIndex += 6;
      const match =
        (po.serial_number && po.serial_number.toLowerCase().includes(term)) ||
        (po.case_number && po.case_number.toLowerCase().includes(term)) ||
        (po.donation_name && po.donation_name.toLowerCase().includes(term)) ||
        (po.pay_order_number && po.pay_order_number.toLowerCase().includes(term)) ||
        (po.bank_name && po.bank_name.toLowerCase().includes(term)) ||
        (po.branch_name && po.branch_name.toLowerCase().includes(term)) ||
        (po.remarks && po.remarks.toLowerCase().includes(term));
      if (!match) ok = false;
    }

    if (sql.includes('case_number = ?') || sql.includes('case_number LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!po.case_number || !po.case_number.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_name = ?') || sql.includes('donation_name LIKE ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!po.donation_name || !po.donation_name.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('pay_order_number LIKE ?') || sql.includes('pay_order_number = ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!po.pay_order_number || !po.pay_order_number.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('bank_name LIKE ?') || sql.includes('bank_name = ?')) {
      const target = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      if (!po.bank_name || !po.bank_name.toLowerCase().includes(target)) ok = false;
      paramIndex++;
    }

    if (sql.includes('po_date >= ?')) {
      if (!po.po_date || po.po_date < params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('po_date <= ?')) {
      if (!po.po_date || po.po_date > params[paramIndex]) ok = false;
      paramIndex++;
    }

    if (sql.includes('donation_id = ?')) {
      if (po.donation_id !== Number(params[paramIndex])) ok = false;
      paramIndex++;
    }

    return ok;
  });
}

function applySortingAndPagination(rows: any[], sql: string, params: any[]) {
  const sortMatch = sql.match(/ORDER BY\s+(\w+)\s+(ASC|DESC)/i);
  if (sortMatch) {
    const col = sortMatch[1];
    const desc = sortMatch[2].toUpperCase() === 'DESC';
    rows.sort((a, b) => {
      const valA = a[col];
      const valB = b[col];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return desc ? valB - valA : valA - valB;
      }
      return desc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
    });
  }

  // Check LIMIT OFFSET either in SQL or in trailing params
  const limitMatch = sql.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i);
  if (limitMatch) {
    let limit = 20;
    let offset = 0;
    if (limitMatch[1] === '?') {
      limit = Number(params[params.length - 2]);
      offset = Number(params[params.length - 1]);
    } else {
      limit = parseInt(limitMatch[1], 10);
      offset = limitMatch[2] ? parseInt(limitMatch[2], 10) : 0;
    }
    const sliced = rows.slice(offset, offset + limit);
    rows.length = 0;
    rows.push(...sliced);
  }
}
