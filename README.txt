================================================================================
COMPANY COURT MANAGEMENT SYSTEM (CCMS)
OFFLINE WINDOWS DESKTOP APPLICATION - TECHNICAL SPECIFICATION & SYSTEM README
================================================================================

1. PROJECT OVERVIEW
--------------------------------------------------------------------------------
The Company Court Management System (CCMS) is a dedicated, production-grade 
desktop application engineered specifically for judicial administration, 
company court registers, decreed donation management, and beneficiary 
disbursement tracking. 

Designed under strict offline-first principles, CCMS executes completely 
disconnected from the internet, ensuring data privacy, local sovereignty, 
and instant workstation query response.


2. KEY SYSTEM MODULES & CAPABILITIES
--------------------------------------------------------------------------------
1. Application Entry:
   - Registers petition metadata: Serial Number, Donation Entity Name, Address,
     Phone Number, Bank Name, Branch, Account Number, Routing Number, Date, Remarks.
   - All fields optional; accommodates unpopulated or pending records.
   - Preserves leading zeros as exact strings for accounts and phone numbers.
   - Populates selectable entities for subsequent donation decrees.

2. Donation Entry:
   - Links court case decrees to registered application entities or unlinked entries.
   - Captures Case Number, Donation Name, Decreed Amount, Judgement Date, Remarks.
   - Decimal-safe financial precision with configurable minor currency units.

3. Donation Disbursement:
   - Tracks beneficiary disbursements: Receiver Name, Receiver Phone, Receiving
     Date, Judgement Date, Status, Remarks.
   - Automatically populates Case Number, Entity Name, and Amount from selected
     donation records while allowing independent disbursement adjustments.
   - Status classifications: 'New Entry', 'Received', 'Delivered', 'Problem', 'Hold'.

4. Consolidated Ledger & Search:
   - Master joined view: Application ➔ Donation Decree ➔ Beneficiary Disbursement.
   - Global multi-field parametric search across cases, names, phones, banks, 
     status, date ranges, and amounts.

5. Reports & Genuine Document Generation:
   - 14 specialized court registers and summaries.
   - Live visual preview with portrait/landscape toggles.
   - System printing support (window.print).
   - Genuine Excel (.xlsx) export via ExcelJS with formula injection sanitization.
   - Genuine Word (.docx) export via the docx package.
   - Vector PDF (.pdf) export via jsPDF and autoTable.

6. Bulk CSV Ingestion:
   - Built-in downloadable CSV templates for all three registers.
   - UTF-8 with Byte Order Mark (BOM) ensuring authentic Bengali Unicode rendering.
   - Pre-import validation engine, duplicate conflict resolution (Skip/Update/Insert).

7. SQLite Database Management & Rollback Safety:
   - Local relational database file: ccms.db.
   - On-demand binary backup generation with JSON metadata manifests.
   - Integrity checks (PRAGMA integrity_check).
   - Transactional restore with automated safety snapshot rollback.

8. Authentication & Role-Based Access Control (RBAC):
   - Roles: Super Administrator, Administrator, Data Entry Operator, Reviewer, Read-Only User.
   - Passwords securely hashed with salted bcrypt (plaintext passwords never stored).
   - Inactivity session locking and manual workstation lock screen.


3. TECHNOLOGY STACK
--------------------------------------------------------------------------------
- User Interface: React 19 / Modern JavaScript / Tailwind CSS
- Runtime Shell: Electron.js (Windows x64 desktop runtime)
- Database: SQLite 3 bytecode engine (sql.js / better-sqlite3 compatible)
- Password Hashing: bcryptjs with salted hashing
- Spreadsheet Engine: ExcelJS (Authentic Office Open XML .xlsx)
- Document Engine: docx (Authentic Word .docx XML packaging)
- PDF Engine: jsPDF & jspdf-autotable
- CSV Engine: PapaParse with RFC 4180 parsing and UTF-8 BOM injection
- Desktop Packaging: electron-builder (NSIS Installer and Portable Executables)


4. SUPPORTED OPERATING SYSTEMS & PREREQUISITES
--------------------------------------------------------------------------------
- Target OS: Windows 10, Windows 11, Windows Server 2019/2022 (x64)
- Development Environment: Node.js (v18.0.0 or higher), npm (v9.0.0 or higher)


5. INSTALLATION & OPERATIONAL COMMANDS
--------------------------------------------------------------------------------
1. Install Project Dependencies:
   npm install

2. Start Local Development Environment:
   npm run dev

3. Build Production Web Distribution:
   npm run build

4. Package Offline Windows Desktop Installer:
   npm run build
   npx electron-builder --win nsis


6. DATABASE LOCATION & STORAGE ARCHITECTURE
--------------------------------------------------------------------------------
In the packaged desktop environment, CCMS initializes its SQLite database in 
the user's standard application data directory:
   %APPDATA%\Company Court Management System\ccms.db

In the browser / preview environment, the database is mounted via WebAssembly 
SQLite with direct IndexedDB binary synchronization, ensuring consistent 
persistence across reloads and offering instant on-demand .db file export.


7. FIRST-RUN SETUP PROCEDURE
--------------------------------------------------------------------------------
On initial launch when no users exist:
1. CCMS displays the Welcome & Court Configuration Wizard.
2. The user configures court coordinates: Court Entity Name, Division, Address,
   Contact Phone, Official Email, and Currency Symbol (default: ৳).
3. The user creates the primary Super Administrator account (Username, Full Name,
   Password).
4. The system automatically initializes all schema migrations and seeds default
   roles.
5. The workstation transitions directly to the secure sign-in portal.


8. SECURITY & DATA INVARIANTS
--------------------------------------------------------------------------------
- Context Isolation: contextIsolation is enabled; nodeIntegration is disabled.
- Parameterized Queries: All database lookups utilize prepared statements to 
  eliminate SQL injection vulnerabilities.
- Leading Zero Preservation: Numerical identifiers that may include leading 
  zeros (phone numbers, bank accounts, routing codes) are stored and manipulated 
  exclusively as text strings.
- Audit Logging: Privileged administrative actions, data modifications, logins, 
  and backups are permanently logged to the AuditLogs table.


9. TROUBLESHOOTING & RECOVERY
--------------------------------------------------------------------------------
- Integrity Failure: Navigate to Settings or Backup & Restore and click 
  "Run PRAGMA Integrity Check".
- Lost Administrator Password: If secondary administrators exist, they can reset 
  credentials under User Management. Alternatively, restore an existing verified 
  backup snapshot.
- Blank Records: Blank records are valid under CCMS rules; if created inadvertently, 
  locate the entry under the respective register and click the Delete button.

================================================================================
Company Court Management System · High Court Division Judicial Administration
================================================================================
