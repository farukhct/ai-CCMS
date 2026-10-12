/**
 * CCMS CSV Import and Template Service
 * PapaParse parser supporting UTF-8 BOM, quoted fields, Bengali script, and data validation
 */

import Papa from 'papaparse';
import { toCanonicalDate, isValidCalendarDate } from './dateUtils';
import { applicationRepo } from '../database/repositories/applicationRepo';
import { donationRepo } from '../database/repositories/donationRepo';
import { disbursementRepo } from '../database/repositories/disbursementRepo';
import { ImportValidationRow } from '../types';

export const CSV_TEMPLATES = {
  applications: {
    filename: 'CCMS_Application_Entry_Template.csv',
    headers: [
      'Serial Number',
      'Donation Name',
      'Address',
      'Phone Number',
      'Bank Name',
      'Branch Name',
      'Bank Account Number',
      'Routing Number',
      'Application Date (DD-MM-YYYY)',
      'Remarks'
    ],
    sampleRow: [
      'APP-00001',
      'Rahman Trading Company Ltd',
      '12 Motijheel C/A, Dhaka-1000',
      '01711000000',
      'Sonali Bank PLC',
      'Principal Branch',
      '0021487654321',
      '200271458',
      '15-01-2026',
      'Initial petition submitted'
    ]
  },
  donations: {
    filename: 'CCMS_Donation_Entry_Template.csv',
    headers: [
      'Serial Number',
      'Case Number',
      'Donation Name',
      'Donation Amount',
      'Judgement Date (DD-MM-YYYY)',
      'Remarks'
    ],
    sampleRow: [
      'DON-00001',
      'CC-104/2026',
      'Rahman Trading Company Ltd',
      '250000.00',
      '20-02-2026',
      'Court judgement decreed'
    ]
  },
  disbursements: {
    filename: 'CCMS_Donation_Disbursement_Template.csv',
    headers: [
      'Serial Number',
      'Case Number',
      'Donation Name',
      'Donation Amount',
      'Receiver Name',
      'Receiver Phone',
      'Receiving Date (DD-MM-YYYY)',
      'Judgement Date (DD-MM-YYYY)',
      'Status (New Entry/Received/Delivered/Problem/Hold)',
      'Remarks'
    ],
    sampleRow: [
      'DIS-00001',
      'CC-104/2026',
      'Rahman Trading Company Ltd',
      '250000.00',
      'Md. Kamal Hossain',
      '01819000000',
      '01-03-2026',
      '20-02-2026',
      'Delivered',
      'Cheque delivered to authorized receiver'
    ]
  }
};

/**
 * Downloads a CSV template containing headers and an instructional sample row
 * Includes UTF-8 BOM (\uFEFF) so Excel respects UTF-8 encoding (especially Bengali script)
 */
export function downloadCsvTemplate(moduleKey: 'applications' | 'donations' | 'disbursements'): void {
  const tpl = CSV_TEMPLATES[moduleKey];
  const csvContent = Papa.unparse({
    fields: tpl.headers,
    data: [tpl.sampleRow]
  });

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tpl.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses uploaded CSV file using PapaParse
 */
export function parseUploadedCsv(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Validates parsed rows for Application Entry import
 */
export function validateApplicationRows(rows: any[]): ImportValidationRow[] {
  return rows.map((raw, index) => {
    const rowNum = index + 2; // header is row 1
    const errors: string[] = [];
    const warnings: string[] = [];

    const serial = raw['Serial Number'] || raw['serial_number'] || '';
    const donationName = raw['Donation Name'] || raw['donation_name'] || '';
    const dateRaw = raw['Application Date (DD-MM-YYYY)'] || raw['Application Date'] || raw['application_date'] || '';

    // Date check (if provided, must be valid calendar date)
    let canonicalDate = '';
    if (dateRaw) {
      canonicalDate = toCanonicalDate(dateRaw);
      if (!canonicalDate) {
        errors.push(`Invalid date "${dateRaw}". Use DD-MM-YYYY (e.g., 15-01-2026)`);
      }
    }

    // Check duplicate serial
    let isDuplicate = false;
    if (serial) {
      const exists = applicationRepo.checkSerialConflict(serial);
      if (exists) {
        isDuplicate = true;
        warnings.push(`Serial Number "${serial}" already exists in the database`);
      }
    }

    const data = {
      serial_number: serial,
      donation_name: donationName,
      address: raw['Address'] || raw['address'] || '',
      phone_number: raw['Phone Number'] || raw['phone_number'] || '',
      bank_name: raw['Bank Name'] || raw['bank_name'] || '',
      branch_name: raw['Branch Name'] || raw['branch_name'] || '',
      bank_account_number: raw['Bank Account Number'] || raw['bank_account_number'] || '',
      routing_number: raw['Routing Number'] || raw['routing_number'] || '',
      application_date: canonicalDate,
      remarks: raw['Remarks'] || raw['remarks'] || ''
    };

    return {
      rowNumber: rowNum,
      data,
      errors,
      warnings,
      isDuplicate
    };
  });
}

/**
 * Validates parsed rows for Donation Entry import
 */
export function validateDonationRows(rows: any[]): ImportValidationRow[] {
  return rows.map((raw, index) => {
    const rowNum = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const serial = raw['Serial Number'] || raw['serial_number'] || '';
    const caseNum = raw['Case Number'] || raw['case_number'] || '';
    const donationName = raw['Donation Name'] || raw['donation_name'] || '';
    const amountRaw = raw['Donation Amount'] || raw['donation_amount'] || '';
    const dateRaw = raw['Judgement Date (DD-MM-YYYY)'] || raw['Judgement Date'] || raw['judgement_date'] || '';

    let canonicalDate = '';
    if (dateRaw) {
      canonicalDate = toCanonicalDate(dateRaw);
      if (!canonicalDate) {
        errors.push(`Invalid Judgement Date "${dateRaw}". Use DD-MM-YYYY`);
      }
    }

    let parsedAmount: number | null = null;
    if (amountRaw !== '' && amountRaw !== undefined && amountRaw !== null) {
      const cleanNum = String(amountRaw).replace(/,/g, '');
      const num = parseFloat(cleanNum);
      if (isNaN(num) || num < 0) {
        errors.push(`Invalid amount value "${amountRaw}"`);
      } else {
        parsedAmount = num;
      }
    }

    let isDuplicate = false;
    if (serial && donationRepo.checkSerialConflict(serial)) {
      isDuplicate = true;
      warnings.push(`Serial Number "${serial}" already exists`);
    }

    // Try matching application_id by donation_name
    let appId: number | null = null;
    let isUnlinked = 1;
    if (donationName) {
      const matchedApps = applicationRepo.getAll({ donationName, pageSize: 1 });
      if (matchedApps.data.length > 0) {
        appId = matchedApps.data[0].id;
        isUnlinked = 0;
      } else {
        warnings.push(`Donation Name "${donationName}" not found in Applications (saved as Unlinked)`);
      }
    }

    const data = {
      serial_number: serial,
      case_number: caseNum,
      donation_name: donationName,
      application_id: appId,
      donation_amount: parsedAmount,
      judgement_date: canonicalDate,
      remarks: raw['Remarks'] || raw['remarks'] || '',
      is_unlinked: isUnlinked
    };

    return {
      rowNumber: rowNum,
      data,
      errors,
      warnings,
      isDuplicate
    };
  });
}

/**
 * Validates parsed rows for Disbursement import
 */
export function validateDisbursementRows(rows: any[]): ImportValidationRow[] {
  const validStatuses = ['New Entry', 'Received', 'Delivered', 'Problem', 'Hold'];

  return rows.map((raw, index) => {
    const rowNum = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const serial = raw['Serial Number'] || raw['serial_number'] || '';
    const caseNum = raw['Case Number'] || raw['case_number'] || '';
    const donationName = raw['Donation Name'] || raw['donation_name'] || '';
    const amountRaw = raw['Donation Amount'] || raw['donation_amount'] || '';
    const receiverName = raw['Receiver Name'] || raw['receiver_name'] || '';
    const receiverPhone = raw['Receiver Phone'] || raw['receiver_phone'] || '';
    const recDateRaw = raw['Receiving Date (DD-MM-YYYY)'] || raw['Receiving Date'] || raw['receiving_date'] || '';
    const judgeDateRaw = raw['Judgement Date (DD-MM-YYYY)'] || raw['Judgement Date'] || raw['judgement_date'] || '';
    const statusRaw = raw['Status (New Entry/Received/Delivered/Problem/Hold)'] || raw['Status'] || raw['status'] || 'New Entry';

    let canonicalRecDate = '';
    if (recDateRaw) {
      canonicalRecDate = toCanonicalDate(recDateRaw);
      if (!canonicalRecDate) errors.push(`Invalid Receiving Date "${recDateRaw}". Use DD-MM-YYYY`);
    }

    let canonicalJudgeDate = '';
    if (judgeDateRaw) {
      canonicalJudgeDate = toCanonicalDate(judgeDateRaw);
      if (!canonicalJudgeDate) errors.push(`Invalid Judgement Date "${judgeDateRaw}". Use DD-MM-YYYY`);
    }

    let parsedAmount: number | null = null;
    if (amountRaw !== '' && amountRaw !== undefined && amountRaw !== null) {
      const cleanNum = String(amountRaw).replace(/,/g, '');
      const num = parseFloat(cleanNum);
      if (isNaN(num) || num < 0) {
        errors.push(`Invalid amount value "${amountRaw}"`);
      } else {
        parsedAmount = num;
      }
    }

    let status = statusRaw.trim();
    if (!validStatuses.includes(status)) {
      warnings.push(`Status "${status}" mapped to "New Entry"`);
      status = 'New Entry';
    }

    let isDuplicate = false;
    if (serial && disbursementRepo.checkSerialConflict(serial)) {
      isDuplicate = true;
      warnings.push(`Serial Number "${serial}" already exists`);
    }

    // Try matching donation by Case Number or Donation Name
    let donationId: number | null = null;
    let isUnlinked = 1;
    if (caseNum) {
      const matched = donationRepo.getAll({ caseNumber: caseNum, pageSize: 1 });
      if (matched.data.length > 0) {
        donationId = matched.data[0].id;
        isUnlinked = 0;
      }
    }

    const data = {
      serial_number: serial,
      donation_id: donationId,
      case_number: caseNum,
      donation_name: donationName,
      donation_amount: parsedAmount,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      receiving_date: canonicalRecDate,
      judgement_date: canonicalJudgeDate,
      status,
      remarks: raw['Remarks'] || raw['remarks'] || '',
      is_unlinked: isUnlinked
    };

    return {
      rowNumber: rowNum,
      data,
      errors,
      warnings,
      isDuplicate
    };
  });
}
