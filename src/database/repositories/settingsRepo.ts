/**
 * Settings Repository
 * Reads and persists application configuration to the AppSettings SQLite table
 */

import { query, run, isDbReady } from '../engine';
import { AppSettings } from '../../types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'Company Court Management System (CCMS)',
  appSubtitle: 'High Court Division & Company Court Administration',
  orgName: 'Company Court Administrative Wing',
  orgAddress: 'Supreme Court Building, Dhaka-1000',
  orgContactPhone: '+880 2-9562858',
  orgContactEmail: 'companycourt@judiciary.gov.bd',
  currencyCode: 'BDT',
  currencySymbol: '৳',
  decimalPrecision: 2,
  dateFormat: 'DD-MM-YYYY',
  defaultPageSize: 20,
  sessionTimeoutMinutes: 30,
  tableDensity: 'comfortable',
  defaultOrientation: 'landscape',
  defaultExportDirectory: 'C:\\CCMS_Exports',
  backupReminderDays: 7,
  duplicateWarningPolicy: 'warn',
  requireConfirmBlank: true,
  statusOptions: ['New Entry', 'Received', 'Delivered', 'Problem', 'Hold']
};

export const settingsRepo = {
  getSettings(): AppSettings {
    if (!isDbReady()) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    try {
      const rows = query<{ key: string; value: string }>('SELECT key, value FROM AppSettings');
      if (rows.length === 0) {
        return { ...DEFAULT_APP_SETTINGS };
      }

      const map: Record<string, string> = {};
      for (const r of rows) {
        map[r.key] = r.value;
      }

      return {
        appName: map['appName'] || DEFAULT_APP_SETTINGS.appName,
        appSubtitle: map['appSubtitle'] || DEFAULT_APP_SETTINGS.appSubtitle,
        orgName: map['orgName'] || DEFAULT_APP_SETTINGS.orgName,
        orgAddress: map['orgAddress'] || DEFAULT_APP_SETTINGS.orgAddress,
        orgContactPhone: map['orgContactPhone'] || DEFAULT_APP_SETTINGS.orgContactPhone,
        orgContactEmail: map['orgContactEmail'] || DEFAULT_APP_SETTINGS.orgContactEmail,
        currencyCode: map['currencyCode'] || DEFAULT_APP_SETTINGS.currencyCode,
        currencySymbol: map['currencySymbol'] || DEFAULT_APP_SETTINGS.currencySymbol,
        decimalPrecision: parseInt(map['decimalPrecision'] || '2', 10),
        dateFormat: map['dateFormat'] || DEFAULT_APP_SETTINGS.dateFormat,
        defaultPageSize: parseInt(map['defaultPageSize'] || '20', 10),
        sessionTimeoutMinutes: parseInt(map['sessionTimeoutMinutes'] || '30', 10),
        tableDensity: (map['tableDensity'] as 'comfortable' | 'compact') || DEFAULT_APP_SETTINGS.tableDensity,
        defaultOrientation: (map['defaultOrientation'] as 'portrait' | 'landscape') || DEFAULT_APP_SETTINGS.defaultOrientation,
        defaultExportDirectory: map['defaultExportDirectory'] || DEFAULT_APP_SETTINGS.defaultExportDirectory,
        backupReminderDays: parseInt(map['backupReminderDays'] || '7', 10),
        duplicateWarningPolicy: (map['duplicateWarningPolicy'] as 'warn' | 'block' | 'allow') || DEFAULT_APP_SETTINGS.duplicateWarningPolicy,
        requireConfirmBlank: map['requireConfirmBlank'] !== '0',
        statusOptions: map['statusOptions']
          ? JSON.parse(map['statusOptions'])
          : DEFAULT_APP_SETTINGS.statusOptions
      };
    } catch (e) {
      console.warn('Failed to load settings from database, using defaults:', e);
      return { ...DEFAULT_APP_SETTINGS };
    }
  },

  saveSettings(settings: Partial<AppSettings>): void {
    const now = new Date().toISOString();
    const current = this.getSettings();
    const merged: AppSettings = { ...current, ...settings };

    const entries: [string, string][] = [
      ['appName', merged.appName],
      ['appSubtitle', merged.appSubtitle],
      ['orgName', merged.orgName],
      ['orgAddress', merged.orgAddress],
      ['orgContactPhone', merged.orgContactPhone],
      ['orgContactEmail', merged.orgContactEmail],
      ['currencyCode', merged.currencyCode],
      ['currencySymbol', merged.currencySymbol],
      ['decimalPrecision', merged.decimalPrecision.toString()],
      ['dateFormat', merged.dateFormat],
      ['defaultPageSize', merged.defaultPageSize.toString()],
      ['sessionTimeoutMinutes', merged.sessionTimeoutMinutes.toString()],
      ['tableDensity', merged.tableDensity],
      ['defaultOrientation', merged.defaultOrientation],
      ['defaultExportDirectory', merged.defaultExportDirectory],
      ['backupReminderDays', merged.backupReminderDays.toString()],
      ['duplicateWarningPolicy', merged.duplicateWarningPolicy],
      ['requireConfirmBlank', merged.requireConfirmBlank ? '1' : '0'],
      ['statusOptions', JSON.stringify(merged.statusOptions)]
    ];

    for (const [key, value] of entries) {
      run(
        `INSERT INTO AppSettings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, now]
      );
    }
  }
};
