/**
 * Donation Repository
 * Handles CRUD operations for Donations table
 * Links to Applications via application_id while supporting unlinked entries.
 */

import { query, get, run } from '../engine';
import { DonationRecord } from '../../types';

export interface DonationFilter {
  search?: string;
  caseNumber?: string;
  donationName?: string;
  applicationId?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  isUnlinked?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'id' | 'serial_number' | 'case_number' | 'donation_name' | 'donation_amount' | 'judgement_date';
  sortOrder?: 'ASC' | 'DESC';
}

export const donationRepo = {
  getAll(filters: DonationFilter = {}): { data: DonationRecord[]; total: number } {
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
        remarks LIKE ?
      )`);
      params.push(term, term, term, term);
    }

    if (filters.caseNumber) {
      whereClauses.push('case_number = ?');
      params.push(filters.caseNumber.trim());
    }

    if (filters.donationName) {
      whereClauses.push('donation_name = ?');
      params.push(filters.donationName.trim());
    }

    if (filters.applicationId !== undefined && filters.applicationId !== null) {
      whereClauses.push('application_id = ?');
      params.push(filters.applicationId);
    }

    if (filters.startDate) {
      whereClauses.push('judgement_date >= ? AND judgement_date != ""');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('judgement_date <= ? AND judgement_date != ""');
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

    if (filters.isUnlinked !== undefined && filters.isUnlinked !== null) {
      whereClauses.push('is_unlinked = ?');
      params.push(filters.isUnlinked);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = get<{ count: number }>(`SELECT COUNT(*) as count FROM Donations ${whereSql}`, params);
    const total = countRes ? countRes.count : 0;

    const data = query<DonationRecord>(
      `SELECT * FROM Donations ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { data, total };
  },

  getById(id: number): DonationRecord | null {
    return get<DonationRecord>('SELECT * FROM Donations WHERE id = ?', [id]);
  },

  checkSerialConflict(serialNumber: string, excludeId?: number): boolean {
    if (!serialNumber || !serialNumber.trim()) return false;
    let sql = 'SELECT id FROM Donations WHERE serial_number = ?';
    let params: any[] = [serialNumber.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = get<{ id: number }>(sql, params);
    return !!res;
  },

  getNextSerialNumber(): string {
    const res = get<{ maxId: number }>('SELECT MAX(id) as maxId FROM Donations');
    const nextNum = (res?.maxId || 0) + 1;
    return `DON-${nextNum.toString().padStart(5, '0')}`;
  },

  checkPossibleDuplicate(caseNumber: string, donationName: string, excludeId?: number): DonationRecord[] {
    if (!caseNumber.trim() && !donationName.trim()) return [];
    let sql = 'SELECT * FROM Donations WHERE 1=1';
    let params: any[] = [];

    if (caseNumber.trim()) {
      sql += ' AND case_number = ?';
      params.push(caseNumber.trim());
    }
    if (donationName.trim()) {
      sql += ' AND donation_name = ?';
      params.push(donationName.trim());
    }
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    return query<DonationRecord>(sql, params);
  },

  /**
   * Returns list of donations with details suitable for populating Disbursement selection
   */
  getSelectableDonations(): Array<{
    id: number;
    serial_number: string;
    case_number: string;
    donation_name: string;
    donation_amount: number | null;
    judgement_date: string;
  }> {
    return query(
      `SELECT id, serial_number, case_number, donation_name, donation_amount, judgement_date
       FROM Donations
       ORDER BY id DESC`
    );
  },

  create(data: Partial<DonationRecord>, username?: string): DonationRecord {
    const now = new Date().toISOString();
    const serial = data.serial_number?.trim() || '';
    const caseNum = data.case_number?.trim() || '';
    const appId = data.application_id ?? null;
    const donationName = data.donation_name?.trim() || '';
    const amount = (data.donation_amount !== undefined && data.donation_amount !== null && !isNaN(Number(data.donation_amount)))
      ? Number(data.donation_amount)
      : null;
    const judgementDate = data.judgement_date?.trim() || '';
    const remarks = data.remarks?.trim() || '';
    const isUnlinked = data.is_unlinked ? 1 : 0;

    const res = run(
      `INSERT INTO Donations (
        serial_number, case_number, application_id, donation_name,
        donation_amount, judgement_date, remarks, is_unlinked,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serial, caseNum, appId, donationName,
        amount, judgementDate, remarks, isUnlinked,
        username || 'System', now, now
      ]
    );

    return this.getById(res.lastInsertRowid)!;
  },

  update(id: number, data: Partial<DonationRecord>): DonationRecord {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (!existing) throw new Error(`Donation record #${id} not found`);

    const amount = (data.donation_amount !== undefined && data.donation_amount !== null && !isNaN(Number(data.donation_amount)))
      ? Number(data.donation_amount)
      : (data.donation_amount === null ? null : existing.donation_amount);

    run(
      `UPDATE Donations SET
        serial_number = ?, case_number = ?, application_id = ?, donation_name = ?,
        donation_amount = ?, judgement_date = ?, remarks = ?, is_unlinked = ?, updated_at = ?
      WHERE id = ?`,
      [
        data.serial_number !== undefined ? data.serial_number.trim() : existing.serial_number,
        data.case_number !== undefined ? data.case_number.trim() : existing.case_number,
        data.application_id !== undefined ? data.application_id : existing.application_id,
        data.donation_name !== undefined ? data.donation_name.trim() : existing.donation_name,
        amount,
        data.judgement_date !== undefined ? data.judgement_date.trim() : existing.judgement_date,
        data.remarks !== undefined ? data.remarks.trim() : existing.remarks,
        data.is_unlinked !== undefined ? (data.is_unlinked ? 1 : 0) : existing.is_unlinked,
        now,
        id
      ]
    );

    return this.getById(id)!;
  },

  delete(id: number): boolean {
    const res = run('DELETE FROM Donations WHERE id = ?', [id]);
    return res.changes > 0;
  }
};
