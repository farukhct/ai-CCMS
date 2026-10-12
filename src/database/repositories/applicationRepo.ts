/**
 * Application Repository
 * Handles CRUD operations for Applications table
 * Preserves phone, bank account, and routing numbers as exact strings (preserving leading zeros).
 * Supports optional/empty fields cleanly.
 */

import { query, get, run } from '../engine';
import { ApplicationRecord } from '../../types';

export interface ApplicationFilter {
  search?: string;
  donationName?: string;
  bankName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'id' | 'serial_number' | 'donation_name' | 'application_date' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
}

export const applicationRepo = {
  getAll(filters: ApplicationFilter = {}): { data: ApplicationRecord[]; total: number } {
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
        donation_name LIKE ? OR
        address LIKE ? OR
        phone_number LIKE ? OR
        bank_name LIKE ? OR
        branch_name LIKE ? OR
        bank_account_number LIKE ? OR
        routing_number LIKE ? OR
        remarks LIKE ?
      )`);
      params.push(term, term, term, term, term, term, term, term, term);
    }

    if (filters.donationName) {
      whereClauses.push('donation_name = ?');
      params.push(filters.donationName);
    }

    if (filters.bankName) {
      whereClauses.push('bank_name = ?');
      params.push(filters.bankName);
    }

    if (filters.startDate) {
      whereClauses.push('application_date >= ? AND application_date != ""');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('application_date <= ? AND application_date != ""');
      params.push(filters.endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = get<{ count: number }>(`SELECT COUNT(*) as count FROM Applications ${whereSql}`, params);
    const total = countRes ? countRes.count : 0;

    const data = query<ApplicationRecord>(
      `SELECT * FROM Applications ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { data, total };
  },

  getById(id: number): ApplicationRecord | null {
    return get<ApplicationRecord>('SELECT * FROM Applications WHERE id = ?', [id]);
  },

  getBySerialNumber(serialNumber: string): ApplicationRecord | null {
    if (!serialNumber.trim()) return null;
    return get<ApplicationRecord>('SELECT * FROM Applications WHERE serial_number = ?', [serialNumber.trim()]);
  },

  checkSerialConflict(serialNumber: string, excludeId?: number): boolean {
    if (!serialNumber || !serialNumber.trim()) return false;
    let sql = 'SELECT id FROM Applications WHERE serial_number = ?';
    let params: any[] = [serialNumber.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = get<{ id: number }>(sql, params);
    return !!res;
  },

  getNextSerialNumber(): string {
    const res = get<{ maxId: number }>('SELECT MAX(id) as maxId FROM Applications');
    const nextNum = (res?.maxId || 0) + 1;
    return `APP-${nextNum.toString().padStart(5, '0')}`;
  },

  getDistinctDonationNames(): string[] {
    const rows = query<{ donation_name: string }>(
      'SELECT DISTINCT donation_name FROM Applications WHERE donation_name IS NOT NULL AND donation_name != "" ORDER BY donation_name ASC'
    );
    return rows.map(r => r.donation_name);
  },

  create(data: Partial<ApplicationRecord>, username?: string): ApplicationRecord {
    const now = new Date().toISOString();
    const serial = data.serial_number?.trim() || '';
    const donationName = data.donation_name?.trim() || '';
    const address = data.address?.trim() || '';
    const phone = data.phone_number?.trim() || '';
    const bankName = data.bank_name?.trim() || '';
    const branchName = data.branch_name?.trim() || '';
    const bankAccount = data.bank_account_number?.trim() || '';
    const routingNumber = data.routing_number?.trim() || '';
    const appDate = data.application_date?.trim() || '';
    const remarks = data.remarks?.trim() || '';

    const res = run(
      `INSERT INTO Applications (
        serial_number, donation_name, address, phone_number,
        bank_name, branch_name, bank_account_number, routing_number,
        application_date, remarks, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serial, donationName, address, phone,
        bankName, branchName, bankAccount, routingNumber,
        appDate, remarks, username || 'System', now, now
      ]
    );

    return this.getById(res.lastInsertRowid)!;
  },

  update(id: number, data: Partial<ApplicationRecord>): ApplicationRecord {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (!existing) throw new Error(`Application record #${id} not found`);

    run(
      `UPDATE Applications SET
        serial_number = ?, donation_name = ?, address = ?, phone_number = ?,
        bank_name = ?, branch_name = ?, bank_account_number = ?, routing_number = ?,
        application_date = ?, remarks = ?, updated_at = ?
      WHERE id = ?`,
      [
        data.serial_number !== undefined ? data.serial_number.trim() : existing.serial_number,
        data.donation_name !== undefined ? data.donation_name.trim() : existing.donation_name,
        data.address !== undefined ? data.address.trim() : existing.address,
        data.phone_number !== undefined ? data.phone_number.trim() : existing.phone_number,
        data.bank_name !== undefined ? data.bank_name.trim() : existing.bank_name,
        data.branch_name !== undefined ? data.branch_name.trim() : existing.branch_name,
        data.bank_account_number !== undefined ? data.bank_account_number.trim() : existing.bank_account_number,
        data.routing_number !== undefined ? data.routing_number.trim() : existing.routing_number,
        data.application_date !== undefined ? data.application_date.trim() : existing.application_date,
        data.remarks !== undefined ? data.remarks.trim() : existing.remarks,
        now,
        id
      ]
    );

    return this.getById(id)!;
  },

  delete(id: number): boolean {
    const res = run('DELETE FROM Applications WHERE id = ?', [id]);
    return res.changes > 0;
  }
};
