/**
 * Disbursement Repository
 * Handles CRUD operations for Disbursements table
 * Links to Donations via donation_id while supporting unlinked entries.
 */

import { query, get, run } from '../engine';
import { DisbursementRecord, DisbursementStatus } from '../../types';

export interface DisbursementFilter {
  search?: string;
  caseNumber?: string;
  donationName?: string;
  receiverName?: string;
  receiverPhone?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  donationId?: number;
  isUnlinked?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'id' | 'serial_number' | 'case_number' | 'donation_name' | 'donation_amount' | 'receiver_name' | 'receiving_date' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export const disbursementRepo = {
  getAll(filters: DisbursementFilter = {}): { data: DisbursementRecord[]; total: number } {
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
        receiver_name LIKE ? OR
        receiver_phone LIKE ? OR
        status LIKE ? OR
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

    if (filters.receiverName) {
      whereClauses.push('receiver_name LIKE ?');
      params.push(`%${filters.receiverName.trim()}%`);
    }

    if (filters.receiverPhone) {
      whereClauses.push('receiver_phone LIKE ?');
      params.push(`%${filters.receiverPhone.trim()}%`);
    }

    if (filters.status) {
      whereClauses.push('status = ?');
      params.push(filters.status);
    }

    if (filters.donationId !== undefined && filters.donationId !== null) {
      whereClauses.push('donation_id = ?');
      params.push(filters.donationId);
    }

    if (filters.startDate) {
      whereClauses.push('receiving_date >= ? AND receiving_date != ""');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('receiving_date <= ? AND receiving_date != ""');
      params.push(filters.endDate);
    }

    if (filters.minAmount !== undefined && filters.minAmount !== null) {
      whereClauses.push('donation_amount >= ?');
      params.push(filters.minAmount);
    }

    if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
      whereClauses.push('donation_amount <= ?');
      params.push(filters.maxAmount);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = get<{ count: number }>(`SELECT COUNT(*) as count FROM Disbursements ${whereSql}`, params);
    const total = countRes ? countRes.count : 0;

    const data = query<DisbursementRecord>(
      `SELECT * FROM Disbursements ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { data, total };
  },

  getById(id: number): DisbursementRecord | null {
    return get<DisbursementRecord>('SELECT * FROM Disbursements WHERE id = ?', [id]);
  },

  checkSerialConflict(serialNumber: string, excludeId?: number): boolean {
    if (!serialNumber || !serialNumber.trim()) return false;
    let sql = 'SELECT id FROM Disbursements WHERE serial_number = ?';
    let params: any[] = [serialNumber.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = get<{ id: number }>(sql, params);
    return !!res;
  },

  getNextSerialNumber(): string {
    const res = get<{ maxId: number }>('SELECT MAX(id) as maxId FROM Disbursements');
    const nextNum = (res?.maxId || 0) + 1;
    return `DIS-${nextNum.toString().padStart(5, '0')}`;
  },

  checkPossibleDuplicate(caseNumber: string, receiverName: string, excludeId?: number): DisbursementRecord[] {
    if (!caseNumber.trim() && !receiverName.trim()) return [];
    let sql = 'SELECT * FROM Disbursements WHERE 1=1';
    let params: any[] = [];

    if (caseNumber.trim()) {
      sql += ' AND case_number = ?';
      params.push(caseNumber.trim());
    }
    if (receiverName.trim()) {
      sql += ' AND receiver_name = ?';
      params.push(receiverName.trim());
    }
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    return query<DisbursementRecord>(sql, params);
  },

  getStatusCounts(): Record<string, number> {
    const rows = query<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM Disbursements GROUP BY status'
    );
    const result: Record<string, number> = {
      'New Entry': 0,
      'Received': 0,
      'Delivered': 0,
      'Problem': 0,
      'Hold': 0
    };
    for (const r of rows) {
      result[r.status] = r.count;
    }
    return result;
  },

  create(data: Partial<DisbursementRecord>, username?: string): DisbursementRecord {
    const now = new Date().toISOString();
    const serial = data.serial_number?.trim() || '';
    const donId = data.donation_id ?? null;
    const caseNum = data.case_number?.trim() || '';
    const donationName = data.donation_name?.trim() || '';
    const amount = (data.donation_amount !== undefined && data.donation_amount !== null && !isNaN(Number(data.donation_amount)))
      ? Number(data.donation_amount)
      : null;
    const receiverName = data.receiver_name?.trim() || '';
    const receiverPhone = data.receiver_phone?.trim() || '';
    const receivingDate = data.receiving_date?.trim() || '';
    const judgementDate = data.judgement_date?.trim() || '';
    const status: DisbursementStatus = (data.status as DisbursementStatus) || 'New Entry';
    const remarks = data.remarks?.trim() || '';
    const isUnlinked = data.is_unlinked ? 1 : 0;

    const res = run(
      `INSERT INTO Disbursements (
        serial_number, donation_id, case_number, donation_name, donation_amount,
        receiver_name, receiver_phone, receiving_date, judgement_date, status,
        remarks, is_unlinked, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serial, donId, caseNum, donationName, amount,
        receiverName, receiverPhone, receivingDate, judgementDate, status,
        remarks, isUnlinked, username || 'System', now, now
      ]
    );

    return this.getById(res.lastInsertRowid)!;
  },

  update(id: number, data: Partial<DisbursementRecord>): DisbursementRecord {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (!existing) throw new Error(`Disbursement record #${id} not found`);

    const amount = (data.donation_amount !== undefined && data.donation_amount !== null && !isNaN(Number(data.donation_amount)))
      ? Number(data.donation_amount)
      : (data.donation_amount === null ? null : existing.donation_amount);

    run(
      `UPDATE Disbursements SET
        serial_number = ?, donation_id = ?, case_number = ?, donation_name = ?,
        donation_amount = ?, receiver_name = ?, receiver_phone = ?, receiving_date = ?,
        judgement_date = ?, status = ?, remarks = ?, is_unlinked = ?, updated_at = ?
      WHERE id = ?`,
      [
        data.serial_number !== undefined ? data.serial_number.trim() : existing.serial_number,
        data.donation_id !== undefined ? data.donation_id : existing.donation_id,
        data.case_number !== undefined ? data.case_number.trim() : existing.case_number,
        data.donation_name !== undefined ? data.donation_name.trim() : existing.donation_name,
        amount,
        data.receiver_name !== undefined ? data.receiver_name.trim() : existing.receiver_name,
        data.receiver_phone !== undefined ? data.receiver_phone.trim() : existing.receiver_phone,
        data.receiving_date !== undefined ? data.receiving_date.trim() : existing.receiving_date,
        data.judgement_date !== undefined ? data.judgement_date.trim() : existing.judgement_date,
        data.status !== undefined ? data.status : existing.status,
        data.remarks !== undefined ? data.remarks.trim() : existing.remarks,
        data.is_unlinked !== undefined ? (data.is_unlinked ? 1 : 0) : existing.is_unlinked,
        now,
        id
      ]
    );

    return this.getById(id)!;
  },

  delete(id: number): boolean {
    const res = run('DELETE FROM Disbursements WHERE id = ?', [id]);
    return res.changes > 0;
  }
};
