import React, { useState } from 'react';
import {
  HelpCircle,
  FilePlus,
  Coins,
  Receipt,
  Search,
  FileText,
  Upload,
  Database,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export const HelpView: React.FC = () => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'overview': true,
    'data_flow': true,
    'forms': true
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sections: HelpSection[] = [
    {
      id: 'overview',
      title: '1. System Overview & Offline Architecture',
      icon: HelpCircle,
      content: (
        <div className="space-y-2 leading-relaxed">
          <p>
            The <strong>Company Court Management System (CCMS)</strong> is a production-grade Windows desktop application built exclusively for offline judicial administration in company court divisions.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Zero Cloud Reliance:</strong> The application operates 100% offline without remote APIs or internet access. All data resides in local SQLite storage (<code className="font-mono text-teal-800">ccms.db</code>).</li>
            <li><strong>Data Integrity:</strong> Enforces foreign keys, atomic transactions, and automated audit trails.</li>
            <li><strong>Date Standards:</strong> Dates are stored as canonical ISO (<code className="font-mono">YYYY-MM-DD</code>) and formatted everywhere as <code className="font-mono text-teal-800">DD-MM-YYYY</code>.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'data_flow',
      title: '2. Judicial Data Workflow & Relational Pipeline',
      icon: Layers,
      content: (
        <div className="space-y-3 leading-relaxed">
          <p>The application models the three sequential stages of Company Court management:</p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs space-y-2">
            <div className="flex items-center gap-2 text-teal-900 font-semibold">
              <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-[10px]">1</span>
              <span>Application Entry:</span> Petitions registered with entity name, phone, and complete bank account / routing numbers.
            </div>
            <div className="flex items-center gap-2 text-sky-900 font-semibold pl-6">
              <span>↓</span> Select registered entity from Application records
            </div>
            <div className="flex items-center gap-2 text-sky-900 font-semibold">
              <span className="w-5 h-5 rounded-full bg-sky-800 text-white flex items-center justify-center text-[10px]">2</span>
              <span>Donation Entry:</span> Judicial decree linked to Case Number, decreed amount, and Judgement Date.
            </div>
            <div className="flex items-center gap-2 text-indigo-900 font-semibold pl-6">
              <span>↓</span> Select specific donation decree
            </div>
            <div className="flex items-center gap-2 text-indigo-900 font-semibold">
              <span className="w-5 h-5 rounded-full bg-indigo-800 text-white flex items-center justify-center text-[10px]">3</span>
              <span>Donation Disbursement:</span> Case Number, Entity, and Amount are auto-populated. Beneficiary receiver details and release status are recorded.
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            <strong>Relational Rule:</strong> Internal record IDs maintain relational integrity rather than raw entity names alone. If an application is edited later, historical donation records preserve their original association.
          </p>
        </div>
      )
    },
    {
      id: 'forms',
      title: '3. Data Entry Forms & Optional Field Handling',
      icon: FilePlus,
      content: (
        <div className="space-y-3 leading-relaxed">
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-800">A. Form Validation & Data Integrity Rules</h4>
            <p>
              CCMS enforces precise field constraints across court registry entries:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
              <li><strong>New Application:</strong> Phone Number, Bank Account Number, and Routing Number accept only numeric digits. Phone Number length is 11 digits (e.g. <code className="font-mono">01711000000</code>).</li>
              <li><strong>New Donation:</strong> Judgement Date is strictly mandatory.</li>
              <li><strong>New Disbursement:</strong> Populates from source Donation records; Disbursement Date must be strictly less than Judgement Date; Receiver Phone Number accepts only numeric values and is 11 digits long.</li>
            </ul>
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-800">B. String Preservation for Leading Zeros</h4>
            <p>
              Phone numbers (e.g. <code className="font-mono">01711000000</code>), bank account numbers (e.g. <code className="font-mono">0021487654321</code>), and routing numbers are preserved as exact text strings so leading zeros are never truncated.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-800">C. Disbursement Status Definitions</h4>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
              <li><strong>New Entry:</strong> Newly initiated disbursement authorization awaiting physical collection.</li>
              <li><strong>Received:</strong> Cheque or instrument prepared and received at the court registry.</li>
              <li><strong>Delivered:</strong> Cheque or fund officially handed over to the authorized recipient.</li>
              <li><strong>Problem:</strong> Legal dispute, mismatch in authorization papers, or frozen release.</li>
              <li><strong>Hold:</strong> Temporarily suspended by court order pending bench review.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'reports',
      title: '4. Reporting, Printing, & Genuine File Exports',
      icon: FileText,
      content: (
        <div className="space-y-2 leading-relaxed">
          <p>
            The Reports module provides <strong>14 distinct registers</strong> with print previews and true file export generators:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Microsoft Excel (.xlsx):</strong> Generates authentic Excel openXML workbooks via ExcelJS with formula injection sanitization and cell styling. Never a renamed HTML or CSV.</li>
            <li><strong>Microsoft Word (.docx):</strong> Generates authentic Word document packages via the docx library.</li>
            <li><strong>PDF (.pdf):</strong> Generates vector PDF documents with page numbers, authority letterheads, and table formatting via jsPDF.</li>
            <li><strong>System Print:</strong> Opens the operating system print dialog with portrait/landscape controls.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'import_backup',
      title: '5. CSV Bulk Import, Backup & Database Restoration',
      icon: Database,
      content: (
        <div className="space-y-2 leading-relaxed">
          <p>
            <strong>Bulk CSV Import:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Download official CSV templates with UTF-8 BOM encoding for proper Bengali script handling in Microsoft Excel.</li>
            <li>Pre-import validation identifies invalid dates (e.g., <code className="font-mono">31-02-2026</code>) and invalid numeric amounts before committing.</li>
            <li>Select duplicate conflict policies: Skip duplicates, Update existing records, or Insert anew.</li>
          </ul>
          <p className="pt-2">
            <strong>Database Backup, Restore & Selective Deletion Facilities:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>On-Demand Backup:</strong> Exports binary SQLite <code className="font-mono">.db</code> file along with a metadata JSON manifest.</li>
            <li><strong>Safe Restore:</strong> Automatically validates SQLite integrity (<code className="font-mono">PRAGMA integrity_check</code>) and creates an in-memory safety snapshot before replacing the database.</li>
            <li><strong>Selective Table Deletion:</strong> Allows administrators to choose specific tables of data to purge (Applications, Donations, Disbursements, Audit Logs, Import History, or Users). Every deletion operation requires an explicit confirmation message, displays exact affected record counts, safely unlinks downstream foreign keys, and can automatically download a safety backup before deletion.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'security',
      title: '6. Role-Based Access Control & Workstation Lock',
      icon: Shield,
      content: (
        <div className="space-y-2 leading-relaxed">
          <p>
            CCMS enforces 5 distinct roles:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Super Administrator:</strong> Unrestricted administrative privileges, user management, and database restoration.</li>
            <li><strong>Administrator:</strong> Record management, reporting, user management, and routine backups.</li>
            <li><strong>Data Entry Operator:</strong> Entry and editing of court applications, donations, and disbursements.</li>
            <li><strong>Reviewer:</strong> Record inspection, status updates, and report generation.</li>
            <li><strong>Read-Only User:</strong> Inspection and reading of registers with export and print capabilities.</li>
          </ul>
          <p className="text-[11px] text-slate-600 pt-1">
            <strong>Security Invariant:</strong> Passwords are protected by salted bcrypt. Plaintext passwords are never recorded in audit logs or stored in local storage.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#0f3a5d]" />
            CCMS System Manual & Judicial User Guide
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational procedures, database invariants, and court registry guidelines
          </p>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {sections.map(section => {
          const isOpen = openSections[section.id];
          const Icon = section.icon;

          return (
            <div
              key={section.id}
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left text-xs font-bold text-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-teal-800 shrink-0" />
                  <span>{section.title}</span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div className="p-5 border-t border-slate-100 text-xs text-slate-700 bg-white">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
