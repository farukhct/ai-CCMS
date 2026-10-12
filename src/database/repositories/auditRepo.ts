/**
 * Audit Log Repository
 * Captures critical administrative, authentication, and data operations
 */

import { query, get, run } from '../engine';
import { AuditLogRecord } from '../../types';

export interface AuditFilter {
  search?: string;
  actionType?: string;
  username?: string;
  entityName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const auditRepo = {
  log(
    actionType: AuditLogRecord['action_type'],
    entityName: string,
    entityId: string | number | null,
    summary: string,
    user?: { id?: number | null; username?: string }
  ): void {
    const timestamp = new Date().toISOString();
    const userId = user?.id ?? null;
    const username = user?.username || 'System';

    try {
      run(
        `INSERT INTO AuditLogs (timestamp, user_id, username, action_type, entity_name, entity_id, summary, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [timestamp, userId, username, actionType, entityName, entityId ? String(entityId) : null, summary, '127.0.0.1 (Local Workstation)']
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  },

  getAll(filters: AuditFilter = {}): { data: AuditLogRecord[]; total: number } {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const offset = (page - 1) * pageSize;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      whereClauses.push('(summary LIKE ? OR username LIKE ? OR entity_name LIKE ?)');
      params.push(term, term, term);
    }

    if (filters.actionType) {
      whereClauses.push('action_type = ?');
      params.push(filters.actionType);
    }

    if (filters.username) {
      whereClauses.push('username = ?');
      params.push(filters.username);
    }

    if (filters.entityName) {
      whereClauses.push('entity_name = ?');
      params.push(filters.entityName);
    }

    if (filters.startDate) {
      whereClauses.push('timestamp >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('timestamp <= ?');
      params.push(filters.endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = get<{ count: number }>(`SELECT COUNT(*) as count FROM AuditLogs ${whereSql}`, params);
    const total = countRes ? countRes.count : 0;

    const data = query<AuditLogRecord>(
      `SELECT * FROM AuditLogs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { data, total };
  }
};
