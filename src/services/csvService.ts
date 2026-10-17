/**
 * CCMS File Import & Template Service
 * Supports CSV (PapaParse with auto delimiter detection & UTF-8 BOM)
 * and genuine Excel spreadsheets (.xlsx, .xls via ExcelJS).
 * Robust fuzzy header matching, flexible date parsing, currency cleaning,
 * and cross-module relational linking.
 */

import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { toCanonicalDate, toDisplayDate } from './dateUtils';
import { applicationRepo } from '../database/repositories/applicationRepo';
import { donationRepo } from '../database/repositories/donationRepo';
import { disbursementRepo } from '../database/repositories/disbursementRepo';
import { payOrderRepo } from '../database/repositories/payOrderRepo';
import { ImportValidationRow } from '../types';

export type ImportModuleKey = 'applications' | 'donations' | 'pay_orders' | 'disbursements';

export interface TemplateDefinition {
  filenameCsv: string;
  filenameXlsx: string;
  sheetName: string;
  headers: string[];
  sampleRow: string[];
  description: string;
}

export const CSV_TEMPLATES: Record<ImportModuleKey, TemplateDefinition> = {
  applications: {
    filenameCsv: 'CCMS_Application_Entry_Template.csv',
    filenameXlsx: 'CCMS_Application_Entry_Template.xlsx',
    sheetName: 'Applications',
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
    ],
    description: 'Petitions with company name, address, judicial bank details, and filing date.'
  },
  donations: {
    filenameCsv: 'CCMS_Donation_Entry_Template.csv',
    filenameXlsx: 'CCMS_Donation_Entry_Template.xlsx',
    sheetName: 'Donations',
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
      'Company Matter No. 42/2023',
      'Apex Textile Mills Ltd.',
      '1250000.00',
      '15-01-2026',
      'Court judgement decreed'
    ],
    description: 'Court decrees with case numbers, decreed donation amounts, and judgement dates.'
  },
  pay_orders: {
    filenameCsv: 'CCMS_Pay_Order_Register_Template.csv',
    filenameXlsx: 'CCMS_Pay_Order_Register_Template.xlsx',
    sheetName: 'Pay Orders',
    headers: [
      'Serial Number',
      'Case Number',
      'Donation Name',
      'Donation Amount',
      'Judgement Date (DD-MM-YYYY)',
      'Pay Order Number',
      'PO Date (DD-MM-YYYY)',
      'Bank Name',
      'Branch Name',
      'Remarks'
    ],
    sampleRow: [
      'PO-00001',
      'Company Matter No. 42/2023',
      'Apex Textile Mills Ltd.',
      '1250000.00',
      '15-01-2026',
      'PO-8849201',
      '22-01-2026',
      'Sonali Bank PLC',
      'Supreme Court Branch',
      'Judicial security deposit pay order'
    ],
    description: 'Bank pay order instruments with amounts, dates, bank branches, and case numbers.'
  },
  disbursements: {
    filenameCsv: 'CCMS_Donation_Disbursement_Template.csv',
    filenameXlsx: 'CCMS_Donation_Disbursement_Template.xlsx',
    sheetName: 'Disbursements',
    headers: [
      'Serial Number',
      'Case Number',
      'Donation Name',
      'Donation Amount',
      'Pay Order Number',
      'PO Date (DD-MM-YYYY)',
      'Bank Name',
      'Branch Name',
      'Receiver Name',
      'Receiver Phone',
      'Receiving Date (DD-MM-YYYY)',
      'Judgement Date (DD-MM-YYYY)',
      'Status (New Entry/Received/Delivered/Problem/Hold)',
      'Remarks'
    ],
    sampleRow: [
      'DIS-00001',
      'Company Matter No. 42/2023',
      'Apex Textile Mills Ltd.',
      '750000.00',
      'PO-8849201',
      '22-01-2026',
      'Sonali Bank PLC',
      'Supreme Court Branch',
      'Md. Kamal Hossain',
      '01819000000',
      '01-03-2026',
      '15-01-2026',
      'Delivered',
      'Cheque delivered to authorized receiver'
    ],
    description: 'Fund distributions with receiver credentials, linked pay order, and delivery status.'
  }
};

/**
 * Downloads a CSV template containing headers and an instructional sample row
 * Includes UTF-8 BOM (\uFEFF) so Excel respects UTF-8 encoding (especially Bengali script)
 */
export function downloadCsvTemplate(moduleKey: ImportModuleKey): void {
  const tpl = CSV_TEMPLATES[moduleKey];
  const csvContent = Papa.unparse({
    fields: tpl.headers,
    data: [tpl.sampleRow]
  });

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, tpl.filenameCsv);
}

/**
 * Downloads genuine Excel (.xlsx) template using ExcelJS
 */
export async function downloadExcelTemplate(moduleKey: ImportModuleKey): Promise<void> {
  const tpl = CSV_TEMPLATES[moduleKey];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Company Court Management System';
  const sheet = workbook.addWorksheet(tpl.sheetName);

  // Header row styling
  const headerRow = sheet.addRow(tpl.headers);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F3A5D' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Sample row
  const dataRow = sheet.addRow(tpl.sampleRow);
  dataRow.height = 20;
  dataRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Adjust column widths
  sheet.columns.forEach((col, idx) => {
    const headLen = (tpl.headers[idx] || '').length;
    const sampLen = (tpl.sampleRow[idx] || '').length;
    col.width = Math.max(headLen, sampLen, 14) + 4;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, tpl.filenameXlsx);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses uploaded CSV or Excel (.xlsx, .xls) file into array of raw record objects
 */
export async function parseUploadedFile(file: File): Promise<any[]> {
  const fileName = file.name.toLowerCase();
  const isExcel =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel');

  if (isExcel) {
    return parseExcelFile(file);
  }
  return parseCsvFile(file);
}

/**
 * ExcelJS Parser for uploaded .xlsx and .xls workbooks
 */
async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: any[] = [];
  let headerRowIndex = 0;
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex === 0) {
      const rawValues = Array.isArray(row.values) ? row.values.slice(1) : [];
      const candidateHeaders = rawValues.map(v => formatCellValue(v).trim());
      const nonEmpties = candidateHeaders.filter(h => h.length > 0);
      // We look for a header row that has at least 2 non-empty column names
      if (nonEmpties.length >= 2) {
        headers = candidateHeaders;
        headerRowIndex = rowNumber;
      }
    } else if (rowNumber > headerRowIndex) {
      const rawValues = Array.isArray(row.values) ? row.values.slice(1) : [];
      const rowObj: Record<string, any> = {};
      let hasData = false;

      headers.forEach((h, colIdx) => {
        if (!h) return;
        const cellVal = rawValues[colIdx];
        const formatted = formatCellValue(cellVal);
        rowObj[h] = formatted;
        if (formatted !== '') hasData = true;
      });

      if (hasData) {
        rows.push(rowObj);
      }
    }
  });

  return rows;
}

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = (val.getMonth() + 1).toString().padStart(2, '0');
    const d = val.getDate().toString().padStart(2, '0');
    return `${d}-${m}-${y}`;
  }
  if (typeof val === 'object') {
    if ('text' in val) return String(val.text || '').trim();
    if ('result' in val) return formatCellValue(val.result);
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('').trim();
    }
  }
  return String(val).trim();
}

/**
 * Robust CSV parser with auto-delimiter detection and UTF-8 handling
 */
function parseCsvFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', '\t', '|', ';'],
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
 * Backward compatibility alias
 */
export const parseUploadedCsv = parseUploadedFile;

/**
 * Extracts a field value from a row using fuzzy & case-insensitive alias matching
 */
export function findFieldValue(row: Record<string, any>, candidateKeys: string[]): string {
  if (!row) return '';

  // 1. Exact or case-insensitive direct match
  for (const cand of candidateKeys) {
    if (row[cand] !== undefined && row[cand] !== null) {
      const v = String(row[cand]).trim();
      if (v !== '') return v;
    }
    const lowerCand = cand.toLowerCase();
    for (const [rk, rv] of Object.entries(row)) {
      if (rk.toLowerCase() === lowerCand && rv !== undefined && rv !== null) {
        const v = String(rv).trim();
        if (v !== '') return v;
      }
    }
  }

  // 2. Normalized alphanumeric matching (stripping spaces, underscores, hyphens, periods)
  const normCandidates = candidateKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [rk, rv] of Object.entries(row)) {
    if (rv === undefined || rv === null) continue;
    const normRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const normCand of normCandidates) {
      if (normRk === normCand || normRk.includes(normCand) || normCand.includes(normRk)) {
        const v = String(rv).trim();
        if (v !== '') return v;
      }
    }
  }

  return '';
}

/**
 * Cleans arbitrary string or number to valid numeric amount
 * Strips currency symbols (৳, $, Tk, BDT), commas, whitespace
 */
export function parseCleanAmount(amountVal: any): number | null {
  if (amountVal === null || amountVal === undefined) return null;
  if (typeof amountVal === 'number' && !isNaN(amountVal)) return amountVal;
  const str = String(amountVal).trim();
  if (!str) return null;

  const clean = str.replace(/[^0-9.-]/g, '');
  if (!clean || clean === '-' || clean === '.') return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Validates parsed rows for Application Entry import
 */
export function validateApplicationRows(rows: any[]): ImportValidationRow[] {
  return rows.map((raw, index) => {
    const rowNum = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const serial = findFieldValue(raw, [
      'Serial Number', 'Serial No', 'Serial No.', 'serial_number', 'SL No', 'SL No.', 'SL', 'Serial'
    ]);
    const donationName = findFieldValue(raw, [
      'Donation Name', 'donation_name', 'Company Name', 'Entity Name', 'Beneficiary', 'Party Name', 'Name'
    ]);
    const address = findFieldValue(raw, ['Address', 'address', 'Company Address', 'Location']);
    const phone = findFieldValue(raw, ['Phone Number', 'Phone', 'phone_number', 'Contact', 'Mobile']);
    const bankName = findFieldValue(raw, ['Bank Name', 'bank_name', 'Bank', 'Issuing Bank']);
    const branchName = findFieldValue(raw, ['Branch Name', 'branch_name', 'Branch', 'Issuing Branch']);
    const bankAccount = findFieldValue(raw, [
      'Bank Account Number', 'Account Number', 'Account No', 'Account No.', 'bank_account_number', 'A/C No'
    ]);
    const routingNumber = findFieldValue(raw, ['Routing Number', 'routing_number', 'Routing No', 'Routing']);
    const dateRaw = findFieldValue(raw, [
      'Application Date (DD-MM-YYYY)', 'Application Date', 'application_date', 'Petition Date', 'Date'
    ]);
    const remarks = findFieldValue(raw, ['Remarks', 'remarks', 'Remark', 'Comments', 'Note', 'Notes']);

    let canonicalDate = '';
    if (dateRaw) {
      canonicalDate = toCanonicalDate(dateRaw);
      if (!canonicalDate) {
        warnings.push(`Application Date "${dateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    if (!donationName && !serial) {
      errors.push('Row is missing both Serial Number and Donation Name');
    }

    let isDuplicate = false;
    if (serial) {
      const exists = applicationRepo.checkSerialConflict(serial);
      if (exists) {
        isDuplicate = true;
        warnings.push(`Serial Number "${serial}" already exists in Applications`);
      }
    }

    const data = {
      serial_number: serial,
      donation_name: donationName,
      address,
      phone_number: phone,
      bank_name: bankName,
      branch_name: branchName,
      bank_account_number: bankAccount,
      routing_number: routingNumber,
      application_date: canonicalDate,
      remarks
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

    const serial = findFieldValue(raw, [
      'Serial Number', 'Serial No', 'Serial No.', 'serial_number', 'SL No', 'SL No.', 'SL', 'Serial'
    ]);
    const caseNum = findFieldValue(raw, ['Case Number', 'Case No', 'Case No.', 'case_number', 'Case', 'Suit No']);
    const donationName = findFieldValue(raw, [
      'Donation Name', 'donation_name', 'Company Name', 'Entity Name', 'Beneficiary', 'Party Name', 'Name'
    ]);
    const amountRaw = findFieldValue(raw, [
      'Donation Amount', 'donation_amount', 'Amount', 'Decreed Amount', 'Total Amount'
    ]);
    const dateRaw = findFieldValue(raw, [
      'Judgement Date (DD-MM-YYYY)', 'Judgement Date', 'judgement_date', 'Judgment Date', 'Decree Date', 'Order Date'
    ]);
    const remarks = findFieldValue(raw, ['Remarks', 'remarks', 'Remark', 'Comments', 'Note', 'Notes']);

    let canonicalDate = '';
    if (dateRaw) {
      canonicalDate = toCanonicalDate(dateRaw);
      if (!canonicalDate) {
        warnings.push(`Judgement Date "${dateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    const parsedAmount = parseCleanAmount(amountRaw);

    if (!caseNum && !donationName && !serial) {
      errors.push('Row is missing Case Number and Donation Name');
    }

    let isDuplicate = false;
    if (serial && donationRepo.checkSerialConflict(serial)) {
      isDuplicate = true;
      warnings.push(`Serial Number "${serial}" already exists in Donations`);
    }

    // Match application_id by donation_name
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
      remarks,
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
 * Validates parsed rows for Pay Order Entry import
 */
export function validatePayOrderRows(rows: any[]): ImportValidationRow[] {
  return rows.map((raw, index) => {
    const rowNum = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const serial = findFieldValue(raw, [
      'Serial Number', 'Serial No', 'Serial No.', 'serial_number', 'SL No', 'SL No.', 'SL', 'Serial'
    ]);
    const caseNum = findFieldValue(raw, ['Case Number', 'Case No', 'Case No.', 'case_number', 'Case', 'Suit No']);
    const donationName = findFieldValue(raw, [
      'Donation Name', 'donation_name', 'Donation Name / Entity', 'Company Name', 'Entity Name', 'Beneficiary', 'Party Name', 'Name'
    ]);
    const amountRaw = findFieldValue(raw, [
      'Donation Amount', 'donation_amount', 'Amount', 'Decreed Amount', 'Total Amount'
    ]);
    const judgeDateRaw = findFieldValue(raw, [
      'Judgement Date (DD-MM-YYYY)', 'Judgement Date', 'judgement_date', 'Judgment Date', 'Decree Date', 'Order Date'
    ]);
    const poNum = findFieldValue(raw, [
      'Pay Order Number', 'Pay Order No', 'Pay Order No.', 'pay_order_number', 'PO Number', 'PO No', 'PO No.', 'Instrument No'
    ]);
    const poDateRaw = findFieldValue(raw, [
      'PO Date (DD-MM-YYYY)', 'PO Date', 'po_date', 'Pay Order Date', 'Instrument Date'
    ]);
    const bankName = findFieldValue(raw, ['Bank Name', 'bank_name', 'Bank', 'Issuing Bank']);
    const branchName = findFieldValue(raw, ['Branch Name', 'branch_name', 'Branch', 'Issuing Branch']);
    const remarks = findFieldValue(raw, ['Remarks', 'remarks', 'Remark', 'Comments', 'Note', 'Notes']);

    let canonicalJudgeDate = '';
    if (judgeDateRaw) {
      canonicalJudgeDate = toCanonicalDate(judgeDateRaw);
      if (!canonicalJudgeDate) {
        warnings.push(`Judgement Date "${judgeDateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    let canonicalPoDate = '';
    if (poDateRaw) {
      canonicalPoDate = toCanonicalDate(poDateRaw);
      if (!canonicalPoDate) {
        warnings.push(`PO Date "${poDateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    let parsedAmount = parseCleanAmount(amountRaw);

    if (!poNum && !caseNum && !serial) {
      errors.push('Row is missing Pay Order Number and Case Number');
    }

    let isDuplicate = false;
    if (serial && payOrderRepo.checkSerialConflict(serial)) {
      isDuplicate = true;
      warnings.push(`Serial Number "${serial}" already exists in Pay Orders`);
    }

    // Try linking with existing Donation
    let donationId: number | null = null;
    let isUnlinked = 1;
    if (caseNum || donationName) {
      const match = donationRepo.getAll({
        caseNumber: caseNum || undefined,
        donationName: donationName || undefined,
        pageSize: 1
      });
      if (match.data.length > 0) {
        donationId = match.data[0].id;
        isUnlinked = 0;
        if (parsedAmount === null && match.data[0].donation_amount) {
          parsedAmount = match.data[0].donation_amount;
        }
        if (!canonicalJudgeDate && match.data[0].judgement_date) {
          canonicalJudgeDate = match.data[0].judgement_date;
        }
      } else {
        warnings.push(`No linked donation found for "${caseNum || donationName}" (saved as Unlinked)`);
      }
    }

    const data = {
      serial_number: serial,
      donation_id: donationId,
      case_number: caseNum,
      donation_name: donationName,
      donation_amount: parsedAmount,
      judgement_date: canonicalJudgeDate,
      pay_order_number: poNum,
      po_date: canonicalPoDate,
      bank_name: bankName,
      branch_name: branchName,
      remarks,
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

    const serial = findFieldValue(raw, [
      'Serial Number', 'Serial No', 'Serial No.', 'serial_number', 'SL No', 'SL No.', 'SL', 'Serial'
    ]);
    const caseNum = findFieldValue(raw, ['Case Number', 'Case No', 'Case No.', 'case_number', 'Case', 'Suit No']);
    const donationName = findFieldValue(raw, [
      'Donation Name', 'donation_name', 'Donation Name / Entity', 'Company Name', 'Entity Name', 'Beneficiary', 'Party Name', 'Name'
    ]);
    const amountRaw = findFieldValue(raw, [
      'Donation Amount', 'donation_amount', 'Amount', 'Disbursement Amount', 'Total Amount'
    ]);
    const poNum = findFieldValue(raw, [
      'Pay Order Number', 'Pay Order No', 'Pay Order No.', 'pay_order_number', 'PO Number', 'PO No', 'PO No.', 'Instrument No'
    ]);
    const poDateRaw = findFieldValue(raw, [
      'PO Date (DD-MM-YYYY)', 'PO Date', 'po_date', 'Pay Order Date', 'Instrument Date'
    ]);
    let bankName = findFieldValue(raw, ['Bank Name', 'bank_name', 'Bank', 'Issuing Bank']);
    let branchName = findFieldValue(raw, ['Branch Name', 'branch_name', 'Branch', 'Issuing Branch']);

    const receiverName = findFieldValue(raw, ['Receiver Name', 'receiver_name', 'Receiver', 'Recipient', 'Paid To']);
    const receiverPhone = findFieldValue(raw, ['Receiver Phone', 'receiver_phone', 'Phone', 'Contact', 'Mobile']);
    const recDateRaw = findFieldValue(raw, [
      'Receiving Date (DD-MM-YYYY)', 'Receiving Date', 'receiving_date', 'Disbursement Date', 'Delivery Date', 'Payment Date', 'Date'
    ]);
    const judgeDateRaw = findFieldValue(raw, [
      'Judgement Date (DD-MM-YYYY)', 'Judgement Date', 'judgement_date', 'Judgment Date', 'Decree Date', 'Order Date'
    ]);
    const statusRaw = findFieldValue(raw, [
      'Status (New Entry/Received/Delivered/Problem/Hold)', 'Status', 'status', 'Delivery Status', 'State'
    ]) || 'New Entry';
    const remarks = findFieldValue(raw, ['Remarks', 'remarks', 'Remark', 'Comments', 'Note', 'Notes']);

    let canonicalRecDate = '';
    if (recDateRaw) {
      canonicalRecDate = toCanonicalDate(recDateRaw);
      if (!canonicalRecDate) {
        warnings.push(`Receiving Date "${recDateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    let canonicalJudgeDate = '';
    if (judgeDateRaw) {
      canonicalJudgeDate = toCanonicalDate(judgeDateRaw);
      if (!canonicalJudgeDate) {
        warnings.push(`Judgement Date "${judgeDateRaw}" could not be parsed; check format (DD-MM-YYYY)`);
      }
    }

    let canonicalPoDate = '';
    if (poDateRaw) {
      canonicalPoDate = toCanonicalDate(poDateRaw);
    }

    // Constraint: Judgement Date must be strictly less than Disbursement Date
    if (canonicalJudgeDate && canonicalRecDate && canonicalJudgeDate >= canonicalRecDate) {
      errors.push(
        `Judgement Date (${toDisplayDate(canonicalJudgeDate)}) must be less than Disbursement Date (${toDisplayDate(canonicalRecDate)})`
      );
    }

    let parsedAmount = parseCleanAmount(amountRaw);

    let status = statusRaw.trim();
    if (!validStatuses.includes(status)) {
      warnings.push(`Status "${status}" mapped to "New Entry"`);
      status = 'New Entry';
    }

    let isDuplicate = false;
    if (serial && disbursementRepo.checkSerialConflict(serial)) {
      isDuplicate = true;
      warnings.push(`Serial Number "${serial}" already exists in Disbursements`);
    }

    // Match linked Pay Order or Donation
    let payOrderId: number | null = null;
    let donationId: number | null = null;
    let isUnlinked = 1;

    if (poNum) {
      const matchedPos = payOrderRepo.getAll({ payOrderNumber: poNum, pageSize: 1 });
      if (matchedPos.data.length > 0) {
        const po = matchedPos.data[0];
        payOrderId = po.id;
        if (po.donation_id) donationId = po.donation_id;
        if (!bankName && po.bank_name) bankName = po.bank_name;
        if (!branchName && po.branch_name) branchName = po.branch_name;
        if (!canonicalPoDate && po.po_date) canonicalPoDate = po.po_date;
        if (!canonicalJudgeDate && po.judgement_date) canonicalJudgeDate = po.judgement_date;
        if (parsedAmount === null && po.donation_amount) parsedAmount = po.donation_amount;
        isUnlinked = 0;
      }
    }

    if (!donationId && caseNum) {
      const matchedDon = donationRepo.getAll({ caseNumber: caseNum, pageSize: 1 });
      if (matchedDon.data.length > 0) {
        donationId = matchedDon.data[0].id;
        isUnlinked = 0;
        if (parsedAmount === null && matchedDon.data[0].donation_amount) {
          parsedAmount = matchedDon.data[0].donation_amount;
        }
        if (!canonicalJudgeDate && matchedDon.data[0].judgement_date) {
          canonicalJudgeDate = matchedDon.data[0].judgement_date;
        }
      }
    }

    const data = {
      serial_number: serial,
      donation_id: donationId,
      pay_order_id: payOrderId,
      case_number: caseNum,
      donation_name: donationName,
      pay_order_number: poNum,
      po_date: canonicalPoDate,
      bank_name: bankName,
      branch_name: branchName,
      donation_amount: parsedAmount,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      receiving_date: canonicalRecDate,
      judgement_date: canonicalJudgeDate,
      status,
      remarks,
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
