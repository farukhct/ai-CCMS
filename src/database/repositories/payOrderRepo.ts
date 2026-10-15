/**
 * Pay Order Repository
 * Handles CRUD operations for PayOrders table
 * Links to Donations via donation_id while supporting unlinked entries.
 */

import { query, get, run } from '../engine';
import { PayOrderRecord } from '../../types';

export interface PayOrderFilter {
  search?: string;
  caseNumber?: string;
  donationName?: string;
  payOrderNumber?: string;
  bankName?: string;
  startDate?: string;
  endDate?: string;
  donationId?: number;
  isUnlinked?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'id' | 'serial_number' | 'case_number' | 'donation_name' | 'pay_order_number' | 'po_date' | 'bank_name';
  sortOrder?: 'ASC' | 'DESC';
}

export const payOrderRepo = {
  getAll(filters: PayOrderFilter = {}): { data: PayOrderRecord[]; total: number } {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const sortBy = filters.sortBy || 'id';
    const sortOrder = filters.sortOrder || 'DESC';

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      whereClauses.push(`(
        serial_number LIKE ? OR
        case_number LIKE ? OR
        donation_name LIKE ? OR
        pay_order_number LIKE ? OR
        bank_name LIKE ? OR
        branch_name LIKE ? OR
        remarks LIKE ?
      )`);
      params.push(term, term, term, term, term, term, term);
    }

    if (filters.caseNumber) {
      whereClauses.push('case_number = ?');
      params.push(filters.caseNumber.trim());
    }

    if (filters.donationName) {
      whereClauses.push('donation_name = ?');
      params.push(filters.donationName.trim());
    }

    if (filters.payOrderNumber) {
      whereClauses.push('pay_order_number LIKE ?');
      params.push(`%${filters.payOrderNumber.trim()}%`);
    }

    if (filters.bankName) {
      whereClauses.push('bank_name LIKE ?');
      params.push(`%${filters.bankName.trim()}%`);
    }

    if (filters.startDate) {
      whereClauses.push('po_date >= ? AND po_date != ""');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('po_date <= ? AND po_date != ""');
      params.push(filters.endDate);
    }

    if (filters.donationId !== undefined && filters.donationId !== null) {
      whereClauses.push('donation_id = ?');
      params.push(filters.donationId);
    }

    if (filters.isUnlinked !== undefined && filters.isUnlinked !== null) {
      whereClauses.push('is_unlinked = ?');
      params.push(filters.isUnlinked);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = get<{ count: number }>(`SELECT COUNT(*) as count FROM PayOrders ${whereSql}`, params);
    const total = countRes ? countRes.count : 0;

    const data = query<PayOrderRecord>(
      `SELECT * FROM PayOrders ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { data, total };
  },

  getById(id: number): PayOrderRecord | null {
    return get<PayOrderRecord>('SELECT * FROM PayOrders WHERE id = ?', [id]);
  },

  checkSerialConflict(serialNumber: string, excludeId?: number): boolean {
    if (!serialNumber || !serialNumber.trim()) return false;
    let sql = 'SELECT id FROM PayOrders WHERE serial_number = ?';
    let params: any[] = [serialNumber.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = get<{ id: number }>(sql, params);
    return !!res;
  },

  getNextSerialNumber(): string {
    const res = get<{ maxId: number }>('SELECT MAX(id) as maxId FROM PayOrders');
    const nextNum = (res?.maxId || 0) + 1;
    return `PO-${nextNum.toString().padStart(5, '0')}`;
  },

  checkPossibleDuplicate(caseNumber: string, payOrderNumber: string, excludeId?: number): PayOrderRecord[] {
    if (!caseNumber.trim() && !payOrderNumber.trim()) return [];
    let sql = 'SELECT * FROM PayOrders WHERE 1=1';
    let params: any[] = [];

    if (caseNumber.trim()) {
      sql += ' AND case_number = ?';
      params.push(caseNumber.trim());
    }
    if (payOrderNumber.trim()) {
      sql += ' AND pay_order_number = ?';
      params.push(payOrderNumber.trim());
    }
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    return query<PayOrderRecord>(sql, params);
  },

  create(data: Partial<PayOrderRecord>, username?: string): PayOrderRecord {
    const now = new Date().toISOString();
    const serial = data.serial_number?.trim() || '';
    const donId = data.donation_id ?? null;
    const caseNum = data.case_number?.trim() || '';
    const donationName = data.donation_name?.trim() || '';
    const poNumber = data.pay_order_number?.trim() || '';
    const poDate = data.po_date?.trim() || '';
    const bankName = data.bank_name?.trim() || '';
    const branchName = data.branch_name?.trim() || '';
    const remarks = data.remarks?.trim() || '';
    const isUnlinked = data.is_unlinked ? 1 : 0;

    const res = run(
      `INSERT INTO PayOrders (
        serial_number, donation_id, case_number, donation_name, pay_order_number,
        po_date, bank_name, branch_name, remarks, is_unlinked,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serial, donId, caseNum, donationName, poNumber,
        poDate, bankName, branchName, remarks, isUnlinked,
        username || 'System', now, now
      ]
    );

    return this.getById(res.lastInsertRowid)!;
  },

  update(id: number, data: Partial<PayOrderRecord>): PayOrderRecord {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (!existing) throw new Error(`Pay Order record #${id} not found`);

    run(
      `UPDATE PayOrders SET
        serial_number = ?, donation_id = ?, case_number = ?, donation_name = ?,
        pay_order_number = ?, po_date = ?, bank_name = ?, branch_name = ?,
        remarks = ?, is_unlinked = ?, updated_at = ?
      WHERE id = ?`,
      [
        data.serial_number !== undefined ? data.serial_number.trim() : existing.serial_number,
        data.donation_id !== undefined ? data.donation_id : existing.donation_id,
        data.case_number !== undefined ? data.case_number.trim() : existing.case_number,
        data.donation_name !== undefined ? data.donation_name.trim() : existing.donation_name,
        data.pay_order_number !== undefined ? data.pay_order_number.trim() : existing.pay_order_number,
        data.po_date !== undefined ? data.po_date.trim() : existing.po_date,
        data.bank_name !== undefined ? data.bank_name.trim() : existing.bank_name,
        data.branch_name !== undefined ? data.branch_name.trim() : existing.branch_name,
        data.remarks !== undefined ? data.remarks.trim() : existing.remarks,
        data.is_unlinked !== undefined ? (data.is_unlinked ? 1 : 0) : existing.is_unlinked,
        now,
        id
      ]
    );

    return this.getById(id)!;
  },

  delete(id: number): boolean {
    const res = run('DELETE FROM PayOrders WHERE id = ?', [id]);
    return res.changes > 0;
  }
};
