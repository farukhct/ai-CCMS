/**
 * Company Court Management System (CCMS)
 * SQLite Schema Definitions and Migrations
 */

export const SCHEMA_VERSION = 1;

export const INITIAL_SCHEMA_SQL = `
-- Schema Migrations Table
CREATE TABLE IF NOT EXISTS SchemaMigrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Roles Table
CREATE TABLE IF NOT EXISTS Roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL -- JSON array of permission strings
);

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Applications Table
CREATE TABLE IF NOT EXISTS Applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number TEXT,
  donation_name TEXT,
  address TEXT,
  phone_number TEXT,
  bank_name TEXT,
  branch_name TEXT,
  bank_account_number TEXT,
  routing_number TEXT,
  application_date TEXT, -- Stored as ISO YYYY-MM-DD or empty
  remarks TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Donations Table
CREATE TABLE IF NOT EXISTS Donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number TEXT,
  case_number TEXT,
  application_id INTEGER,
  donation_name TEXT,
  donation_amount REAL,
  judgement_date TEXT, -- Stored as ISO YYYY-MM-DD or empty
  remarks TEXT,
  is_unlinked INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE SET NULL
);

-- Disbursements Table
CREATE TABLE IF NOT EXISTS Disbursements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number TEXT,
  donation_id INTEGER,
  pay_order_id INTEGER,
  case_number TEXT,
  donation_name TEXT,
  pay_order_number TEXT,
  po_date TEXT,
  bank_name TEXT,
  branch_name TEXT,
  donation_amount REAL,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiving_date TEXT, -- Stored as ISO YYYY-MM-DD or empty
  judgement_date TEXT, -- Stored as ISO YYYY-MM-DD or empty
  status TEXT NOT NULL DEFAULT 'New Entry',
  remarks TEXT,
  is_unlinked INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (donation_id) REFERENCES Donations(id) ON DELETE SET NULL,
  FOREIGN KEY (pay_order_id) REFERENCES PayOrders(id) ON DELETE SET NULL
);

-- Pay Orders Table
CREATE TABLE IF NOT EXISTS PayOrders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number TEXT,
  donation_id INTEGER,
  case_number TEXT,
  donation_name TEXT,
  pay_order_number TEXT,
  po_date TEXT, -- Stored as ISO YYYY-MM-DD or empty
  bank_name TEXT,
  branch_name TEXT,
  remarks TEXT,
  is_unlinked INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (donation_id) REFERENCES Donations(id) ON DELETE SET NULL
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS AuditLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  user_id INTEGER,
  username TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  ip_address TEXT
);

-- Application Settings Table
CREATE TABLE IF NOT EXISTS AppSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Import Jobs Table
CREATE TABLE IF NOT EXISTS ImportJobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  imported_rows INTEGER NOT NULL,
  skipped_rows INTEGER NOT NULL,
  error_rows INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes for high-performance querying and reporting
CREATE INDEX IF NOT EXISTS idx_applications_donation_name ON Applications(donation_name);
CREATE INDEX IF NOT EXISTS idx_applications_serial ON Applications(serial_number);
CREATE INDEX IF NOT EXISTS idx_donations_case_number ON Donations(case_number);
CREATE INDEX IF NOT EXISTS idx_donations_donation_name ON Donations(donation_name);
CREATE INDEX IF NOT EXISTS idx_donations_application_id ON Donations(application_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_status ON Disbursements(status);
CREATE INDEX IF NOT EXISTS idx_disbursements_receiver_name ON Disbursements(receiver_name);
CREATE INDEX IF NOT EXISTS idx_disbursements_donation_id ON Disbursements(donation_id);
CREATE INDEX IF NOT EXISTS idx_payorders_case_number ON PayOrders(case_number);
CREATE INDEX IF NOT EXISTS idx_payorders_po_number ON PayOrders(pay_order_number);
CREATE INDEX IF NOT EXISTS idx_payorders_donation_id ON PayOrders(donation_id);
CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(timestamp);
CREATE INDEX IF NOT EXISTS idx_auditlogs_action ON AuditLogs(action_type);
`;
