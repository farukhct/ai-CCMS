import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { applicationRepo } from '../../database/repositories/applicationRepo';
import { donationRepo } from '../../database/repositories/donationRepo';
import { disbursementRepo } from '../../database/repositories/disbursementRepo';
import { get, query } from '../../database/engine';
import { toDisplayDate } from '../../services/dateUtils';
import {
  FilePlus,
  Coins,
  Receipt,
  Scale,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    settings,
    openApplicationModal,
    openDonationModal,
    openDisbursementModal,
    hasPermission,
    setActiveTab
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Statistics calculation from live SQLite
  const stats = useMemo(() => {
    const allApps = applicationRepo.getAll({ pageSize: 5000 }).data;
    const allDons = donationRepo.getAll({ pageSize: 5000 }).data;
    const allDiss = disbursementRepo.getAll({ pageSize: 5000 }).data;

    const todayStr = new Date().toISOString().split('T')[0];
    const curYearMonth = todayStr.slice(0, 7);
    const curYear = todayStr.slice(0, 4);

    let filteredApps = allApps;
    let filteredDons = allDons;
    let filteredDiss = allDiss;

    if (dateFilter === 'today') {
      filteredApps = allApps.filter(a => a.application_date === todayStr);
      filteredDons = allDons.filter(d => d.judgement_date === todayStr);
      filteredDiss = allDiss.filter(d => d.receiving_date === todayStr);
    } else if (dateFilter === 'month') {
      filteredApps = allApps.filter(a => a.application_date && a.application_date.startsWith(curYearMonth));
      filteredDons = allDons.filter(d => d.judgement_date && d.judgement_date.startsWith(curYearMonth));
      filteredDiss = allDiss.filter(d => d.receiving_date && d.receiving_date.startsWith(curYearMonth));
    } else if (dateFilter === 'year') {
      filteredApps = allApps.filter(a => a.application_date && a.application_date.startsWith(curYear));
      filteredDons = allDons.filter(d => d.judgement_date && d.judgement_date.startsWith(curYear));
      filteredDiss = allDiss.filter(d => d.receiving_date && d.receiving_date.startsWith(curYear));
    }

    const appCount = filteredApps.length;
    const donCount = filteredDons.length;
    const disCount = filteredDiss.length;

    const donSum = filteredDons.reduce((acc, d) => acc + (d.donation_amount || 0), 0);
    const disSum = filteredDiss.reduce((acc, d) => acc + (d.donation_amount || 0), 0);

    const remainingBalance = Math.max(0, donSum - disSum);

    const incApps = allApps.filter(a => !a.donation_name || !a.application_date || !a.bank_account_number).length;
    const incDons = allDons.filter(d => !d.donation_amount || !d.case_number || !d.judgement_date).length;
    const incDiss = allDiss.filter(d => !d.receiver_name || !d.donation_amount).length;

    const statusCounts = disbursementRepo.getStatusCounts();

    const recentApps = allApps.slice(0, 5);
    const recentDons = allDons.slice(0, 5);
    const recentDiss = allDiss.slice(0, 5);

    return {
      appCount,
      donCount,
      disCount,
      donSum,
      disSum,
      remainingBalance,
      incompleteCount: incApps + incDons + incDiss,
      statusCounts,
      recentApps,
      recentDons,
      recentDiss
    };
  }, [dateFilter, refreshKey]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Court Administration Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time computed financial and case metrics from local database (<span className="font-mono text-slate-700">ccms.db</span>)
          </p>
        </div>

        {/* Date Filter Segmented Controls */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-md text-xs font-medium">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              dateFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Records
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              dateFilter === 'today'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              dateFilter === 'month'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateFilter('year')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              dateFilter === 'year'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Year
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Applications */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Applications</span>
            <FilePlus className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.appCount.toLocaleString()}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Registered petitions</span>
            <button
              onClick={() => setActiveTab('applications')}
              className="text-teal-700 hover:underline flex items-center gap-0.5"
            >
              Register <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Total Donations Decreed */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Donations</span>
            <Coins className="w-4 h-4 text-sky-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {settings.currencySymbol} {stats.donSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{stats.donCount} decreed cases</span>
            <button
              onClick={() => setActiveTab('donations')}
              className="text-sky-700 hover:underline flex items-center gap-0.5"
            >
              Donations <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Total Disbursements Delivered */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Disbursements</span>
            <Receipt className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {settings.currencySymbol} {stats.disSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{stats.disCount} disbursement records</span>
            <button
              onClick={() => setActiveTab('disbursements')}
              className="text-indigo-700 hover:underline flex items-center gap-0.5"
            >
              Disbursements <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Net Remaining Balance */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Remaining Balance</span>
            <Scale className="w-4 h-4 text-[#0f3a5d]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {settings.currencySymbol} {stats.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Decreed vs Disbursed</span>
            <span className="text-slate-400">Net Fund</span>
          </div>
        </div>
      </div>

      {/* Operational Breakdown Strip: Status Distribution & Incomplete Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Panel */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">
              Disbursement Status Breakdown
            </h2>
            <span className="text-xs text-slate-500">
              {stats.disCount} Total Records
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-center">
            <div className="p-3 rounded bg-sky-50/60 border border-sky-100">
              <span className="text-[11px] font-medium text-sky-800 block">New Entry</span>
              <span className="text-lg font-bold text-sky-950 font-mono tabular-nums block mt-1">
                {stats.statusCounts['New Entry'] || 0}
              </span>
            </div>

            <div className="p-3 rounded bg-amber-50/60 border border-amber-100">
              <span className="text-[11px] font-medium text-amber-800 block">Received</span>
              <span className="text-lg font-bold text-amber-950 font-mono tabular-nums block mt-1">
                {stats.statusCounts['Received'] || 0}
              </span>
            </div>

            <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] font-medium text-emerald-800 block">Delivered</span>
              <span className="text-lg font-bold text-emerald-950 font-mono tabular-nums block mt-1">
                {stats.statusCounts['Delivered'] || 0}
              </span>
            </div>

            <div className="p-3 rounded bg-rose-50/60 border border-rose-100">
              <span className="text-[11px] font-medium text-rose-800 block">Problem</span>
              <span className="text-lg font-bold text-rose-950 font-mono tabular-nums block mt-1">
                {stats.statusCounts['Problem'] || 0}
              </span>
            </div>

            <div className="p-3 rounded bg-purple-50/60 border border-purple-100">
              <span className="text-[11px] font-medium text-purple-800 block">Hold</span>
              <span className="text-lg font-bold text-purple-950 font-mono tabular-nums block mt-1">
                {stats.statusCounts['Hold'] || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Incomplete Records Warning Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <h2 className="text-sm font-bold">Incomplete Records Audit</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              CCMS supports saving partial or blank forms. Currently, <strong className="font-mono text-slate-900">{stats.incompleteCount}</strong> records lack crucial dates, amounts, or identifiers.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => setActiveTab('reports')}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded transition-colors text-center"
            >
              View Incomplete Records Report
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions Strip */}
      {hasPermission('create_records') && (
        <div className="bg-[#0f3a5d]/5 rounded-lg border border-[#0f3a5d]/15 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#0f3a5d] text-white flex items-center justify-center font-bold text-xs">
              +
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#0f3a5d]">
                Quick Entry Workflows
              </h3>
              <p className="text-[11px] text-slate-600">
                Log a new court petition, judicial donation decree, or recipient disbursement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openApplicationModal()}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded transition-colors shadow-2xs"
            >
              + Application Entry
            </button>
            <button
              onClick={() => openDonationModal()}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium rounded transition-colors shadow-2xs"
            >
              + Donation Entry
            </button>
            <button
              onClick={() => openDisbursementModal()}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium rounded transition-colors shadow-2xs"
            >
              + Disbursement Entry
            </button>
          </div>
        </div>
      )}

      {/* Recent Records Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Recent Court Activity
          </h2>
          <span className="text-xs text-slate-500">
            Latest 5 entries across registers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Register Type</th>
                <th className="py-2.5 px-4">Serial / Case</th>
                <th className="py-2.5 px-4">Entity / Beneficiary</th>
                <th className="py-2.5 px-4 text-right">Amount ({settings.currencySymbol})</th>
                <th className="py-2.5 px-4 text-center">Date</th>
                <th className="py-2.5 px-4">Status / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {stats.recentDiss.length === 0 && stats.recentDons.length === 0 && stats.recentApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No court records in database yet. Use the entry forms or CSV import to populate records.
                  </td>
                </tr>
              ) : (
                <>
                  {stats.recentDiss.map(dis => (
                    <tr key={`dis-${dis.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-indigo-700">Disbursement</td>
                      <td className="py-2.5 px-4 font-mono">{dis.serial_number || dis.case_number || `#${dis.id}`}</td>
                      <td className="py-2.5 px-4">{dis.receiver_name || dis.donation_name || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                        {dis.donation_amount ? dis.donation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono tabular-nums">{toDisplayDate(dis.receiving_date)}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[11px] font-medium text-slate-700">{dis.status}</span>
                      </td>
                    </tr>
                  ))}
                  {stats.recentDons.map(don => (
                    <tr key={`don-${don.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-sky-700">Donation</td>
                      <td className="py-2.5 px-4 font-mono">{don.serial_number || don.case_number || `#${don.id}`}</td>
                      <td className="py-2.5 px-4">{don.donation_name || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                        {don.donation_amount ? don.donation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono tabular-nums">{toDisplayDate(don.judgement_date)}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[11px] text-slate-500">Decree</span>
                      </td>
                    </tr>
                  ))}
                  {stats.recentApps.map(app => (
                    <tr key={`app-${app.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-teal-700">Application</td>
                      <td className="py-2.5 px-4 font-mono">{app.serial_number || `#${app.id}`}</td>
                      <td className="py-2.5 px-4">{app.donation_name || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-400">-</td>
                      <td className="py-2.5 px-4 text-center font-mono tabular-nums">{toDisplayDate(app.application_date)}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[11px] text-slate-500">{app.bank_name || 'Petition'}</span>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
