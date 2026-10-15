/**
 * CCMS Backup and Restore Service
 * Safely creates SQLite database snapshots (.db), verifies integrity,
 * generates manifests, and restores database state transactionally.
 */

import {
  exportDatabaseBinary,
  importDatabaseBinary,
  checkIntegrity,
  get,
  deleteTablesData,
  getDatabaseTableStats,
  TableStatInfo,
  DeleteTablesResult
} from '../database/engine';
import { DatabaseBackupManifest, User } from '../types';
import { formatCurrentDateISO } from './dateUtils';
import { auditRepo } from '../database/repositories/auditRepo';

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

export interface PurgeTablesOptions {
  createSafetyBackup?: boolean;
  preserveCurrentUser?: boolean;
  currentUserId?: number;
  resetSequences?: boolean;
  user?: User | null;
}

export interface PurgeTablesResult extends DeleteTablesResult {
  success: boolean;
  backupFilename?: string;
}

export const backupService = {
  /**
   * Generates manifest with current database stats
   */
  getManifest(): DatabaseBackupManifest {
    const userCount = get<{ count: number }>('SELECT COUNT(*) as count FROM Users')?.count || 0;
    const appCount = get<{ count: number }>('SELECT COUNT(*) as count FROM Applications')?.count || 0;
    const donCount = get<{ count: number }>('SELECT COUNT(*) as count FROM Donations')?.count || 0;
    const disCount = get<{ count: number }>('SELECT COUNT(*) as count FROM Disbursements')?.count || 0;
    const poCount = get<{ count: number }>('SELECT COUNT(*) as count FROM PayOrders')?.count || 0;
    const auditCount = get<{ count: number }>('SELECT COUNT(*) as count FROM AuditLogs')?.count || 0;

    return {
      version: '1.0.0',
      schemaVersion: 1,
      backupTimestamp: new Date().toISOString(),
      recordCounts: {
        users: userCount,
        applications: appCount,
        donations: donCount,
        disbursements: disCount,
        payOrders: poCount,
        auditLogs: auditCount
      }
    };
  },

  /**
   * Returns current statistics and row counts for each database table
   */
  getTableStatistics(): TableStatInfo[] {
    return getDatabaseTableStats();
  },

  /**
   * Initiates on-demand backup download of ccms.db
   */
  createBackup(): { success: boolean; filename: string } {
    const integrity = checkIntegrity();
    if (integrity !== 'ok') {
      throw new Error(`Cannot perform backup: Database integrity check reported issues (${integrity})`);
    }

    const binary = exportDatabaseBinary();
    const manifest = this.getManifest();

    const timestamp = formatCurrentDateISO().replace(/-/g, '') + '_' + Math.floor(Date.now() / 1000);
    const filename = `ccms_database_backup_${timestamp}.db`;

    const blob = new Blob([binary as unknown as BlobPart], { type: 'application/x-sqlite3' });
    triggerDownload(blob, filename);

    // Also download manifest JSON alongside
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    triggerDownload(manifestBlob, `ccms_backup_manifest_${timestamp}.json`);

    return { success: true, filename };
  },

  /**
   * Validates and restores database from binary file
   */
  async restoreBackup(file: File): Promise<{ success: boolean; message: string }> {
    // 1. Safety snapshot of current db
    const currentSnapshot = exportDatabaseBinary();

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const result = await importDatabaseBinary(bytes);
      if (!result.success) {
        // Restore safety snapshot if import failed
        await importDatabaseBinary(currentSnapshot);
        return result;
      }

      return { success: true, message: 'Database restored and verified successfully.' };
    } catch (err: any) {
      // Rollback to safety snapshot
      await importDatabaseBinary(currentSnapshot);
      return { success: false, message: `Restore error: ${err.message || String(err)}` };
    }
  },

  /**
   * Selectively purges chosen tables with optional safety backup and security audit logging
   */
  purgeTableData(tableNames: string[], options: PurgeTablesOptions = {}): PurgeTablesResult {
    let backupFilename: string | undefined;

    // 1. Take safety snapshot first if requested
    if (options.createSafetyBackup) {
      try {
        const backupResult = this.createBackup();
        backupFilename = backupResult.filename;
      } catch (err) {
        console.warn('Safety backup generation encountered a warning, proceeding with purge:', err);
      }
    }

    // 2. Perform selective table deletion
    const delResult = deleteTablesData(tableNames, {
      preserveCurrentUser: options.preserveCurrentUser !== false,
      currentUserId: options.currentUserId,
      resetSequences: options.resetSequences !== false
    });

    // 3. Log audit event
    try {
      const breakdown = Object.entries(delResult.deletedCounts)
        .map(([tbl, cnt]) => `${tbl}: ${cnt}`)
        .join(', ');
      auditRepo.log(
        'DB_PURGE',
        'Database',
        null,
        `Purged tables [${tableNames.join(', ')}] — ${delResult.totalDeleted} records removed (${breakdown})`,
        options.user || undefined
      );
    } catch (auditErr) {
      console.warn('Could not write audit log for DB_PURGE:', auditErr);
    }

    return {
      success: true,
      backupFilename,
      deletedCounts: delResult.deletedCounts,
      totalDeleted: delResult.totalDeleted
    };
  }
};
