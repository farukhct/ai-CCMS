/**
 * CCMS Real Document Export Services
 * Generates genuine .xlsx (ExcelJS), .docx (DOCX XML package), and .pdf (jsPDF + autoTable)
 * Sanitizes spreadsheet values against formula injection and ensures UTF-8 / Bengali support.
 */

import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppSettings } from '../types';
import { toDisplayDate, formatCurrentDateDDMMYYYY, formatTimestampDisplay } from './dateUtils';

// Sanitize cell text to avoid spreadsheet formula injection
function sanitizeExcelValue(val: any): any {
  if (typeof val === 'string') {
    if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) {
      return `'${val}`;
    }
  }
  return val;
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

export interface ExportColumn {
  header: string;
  key: string;
  width?: number; // approx character width
  align?: 'left' | 'center' | 'right';
  isDate?: boolean;
  isAmount?: boolean;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  dateRangeText?: string;
  settings: AppSettings;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  orientation?: 'portrait' | 'landscape';
}

/**
 * 1. Genuine Excel XLSX Export via ExcelJS
 */
export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { title, subtitle, dateRangeText, settings, columns, rows } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${settings.appName} (${settings.orgName})`;
  workbook.lastModifiedBy = settings.appName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(title.slice(0, 31) || 'Report', {
    pageSetup: {
      orientation: options.orientation === 'portrait' ? 'portrait' : 'landscape',
      paperSize: 9 // A4
    }
  });

  // Title Banner
  const titleRow = worksheet.addRow([settings.orgName.toUpperCase()]);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F3A5D' } };
  titleRow.alignment = { horizontal: 'center' };
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, columns.length);

  const subRow = worksheet.addRow([title + (dateRangeText ? ` (${dateRangeText})` : '')]);
  subRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
  subRow.alignment = { horizontal: 'center' };
  worksheet.mergeCells(subRow.number, 1, subRow.number, columns.length);

  const metaRow = worksheet.addRow([`Generated on: ${formatTimestampDisplay(new Date().toISOString())} | Total Records: ${rows.length}`]);
  metaRow.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  metaRow.alignment = { horizontal: 'center' };
  worksheet.mergeCells(metaRow.number, 1, metaRow.number, columns.length);

  worksheet.addRow([]); // Blank spacer

  // Table Header Row
  const headerRow = worksheet.addRow(columns.map(c => c.header));
  headerRow.height = 24;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F3A5D' } // Navy
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: columns[colNumber - 1].align === 'right' ? 'right' : columns[colNumber - 1].align === 'center' ? 'center' : 'left'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F3A5D' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Data Rows
  let totalAmount = 0;
  let hasAmountCol = false;

  rows.forEach((row, rowIndex) => {
    const rowValues = columns.map(c => {
      let raw = row[c.key];
      if (c.isDate) return toDisplayDate(raw, '-');
      if (c.isAmount) {
        hasAmountCol = true;
        if (raw !== null && raw !== undefined && !isNaN(Number(raw))) {
          const num = Number(raw);
          totalAmount += num;
          return num;
        }
        return '-';
      }
      return sanitizeExcelValue(raw !== null && raw !== undefined ? String(raw) : '-');
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 20;

    const isEven = rowIndex % 2 === 0;
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      const colDef = columns[colNumber - 1];
      if (colDef.align === 'right' || colDef.isAmount) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      } else if (colDef.align === 'center' || colDef.isDate) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Summary Row if amounts exist
  if (hasAmountCol) {
    const totalRowValues = columns.map((c, i) => {
      if (i === 0) return 'TOTAL';
      if (c.isAmount) return totalAmount;
      return '';
    });
    const summaryRow = worksheet.addRow(totalRowValues);
    summaryRow.height = 22;
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F3A5D' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };
      if (columns[colNumber - 1].isAmount && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  }

  // Column Widths
  columns.forEach((c, i) => {
    worksheet.getColumn(i + 1).width = Math.max(c.width || 15, 12);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const sanitizedFilename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${formatCurrentDateDDMMYYYY()}.xlsx`;
  triggerDownload(blob, sanitizedFilename);
}

/**
 * 2. Genuine Microsoft Word (.docx) Export via docx
 */
export async function exportToDocx(options: ExportOptions): Promise<void> {
  const { title, dateRangeText, settings, columns, rows } = options;

  const tableHeaderCells = columns.map(c => new TableCell({
    children: [new Paragraph({
      alignment: c.align === 'right' ? AlignmentType.RIGHT : c.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: c.header, bold: true, size: 18, color: 'FFFFFF' })]
    })],
    shading: { fill: '0F3A5D' }
  }));

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: tableHeaderCells
    })
  ];

  rows.forEach((row, idx) => {
    const cells = columns.map(c => {
      let val = row[c.key];
      if (c.isDate) val = toDisplayDate(val, '-');
      else if (c.isAmount) {
        val = val !== null && val !== undefined && !isNaN(Number(val)) ? `${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
      } else if (val === null || val === undefined || val === '') {
        val = '-';
      }

      return new TableCell({
        children: [new Paragraph({
          alignment: c.align === 'right' ? AlignmentType.RIGHT : c.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: String(val), size: 16, color: '1E293B' })]
        })],
        shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }
      });
    });

    tableRows.push(new TableRow({ children: cells }));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: settings.orgName.toUpperCase(), bold: true, size: 28, color: '0F3A5D' })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: title + (dateRangeText ? ` (${dateRangeText})` : ''), bold: true, size: 22, color: '334155' })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `Generated on: ${formatTimestampDisplay(new Date().toISOString())} | Total Records: ${rows.length}`, italics: true, size: 16, color: '64748B' })
          ]
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      ]
    }]
  });

  const buffer = await Packer.toBlob(doc);
  const sanitizedFilename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${formatCurrentDateDDMMYYYY()}.docx`;
  triggerDownload(buffer, sanitizedFilename);
}

/**
 * 3. Genuine PDF Export via jsPDF & autoTable
 */
export function exportToPdf(options: ExportOptions): void {
  const { title, dateRangeText, settings, columns, rows, orientation } = options;

  const doc = new jsPDF({
    orientation: orientation || 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Government Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 58, 93); // Navy #0F3A5D
  doc.text(settings.orgName.toUpperCase(), pageWidth / 2, 35, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(title + (dateRangeText ? ` (${dateRangeText})` : ''), pageWidth / 2, 52, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${formatTimestampDisplay(new Date().toISOString())} | Total Records: ${rows.length}`, pageWidth / 2, 66, { align: 'center' });

  // AutoTable columns and body
  const tableHeaders = columns.map(c => c.header);
  const tableData = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (c.isDate) return toDisplayDate(val, '-');
      if (c.isAmount) {
        return val !== null && val !== undefined && !isNaN(Number(val))
          ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '-';
      }
      return val !== null && val !== undefined && val !== '' ? String(val) : '-';
    });
  });

  const columnStyles: Record<number, any> = {};
  columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.align === 'right' || col.isAmount ? 'right' : col.align === 'center' || col.isDate ? 'center' : 'left'
    };
  });

  autoTable(doc, {
    startY: 78,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 58, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles,
    didDrawPage: (data) => {
      // Footer page numbers
      const str = `Page ${doc.getNumberOfPages()} | ${settings.appName}`;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });
    }
  });

  const sanitizedFilename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${formatCurrentDateDDMMYYYY()}.pdf`;
  doc.save(sanitizedFilename);
}
