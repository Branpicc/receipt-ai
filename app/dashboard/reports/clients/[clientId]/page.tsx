"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

type ClientReport = {
  id: string;
  report_month: string;
  total_spend_cents: number;
  total_tax_cents: number;
  total_receipts: number;
  total_emails: number;
  total_flagged: number;
  category_breakdown: { category: string; count: number; total_cents: number }[];
  budget_comparison: {
    category: string;
    budget_cents: number;
    spent_cents: number;
    percentage: number;
    is_over_budget: boolean;
  }[];
  generated_at: string;
};

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ClientReportsPage() {
  const params = useParams();
  const clientId = params?.clientId as string;

  const [reports, setReports] = useState<ClientReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ClientReport | null>(null);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [clientId]);

  async function loadReports() {
    setLoading(true);
    try {
      const firmId = await getMyFirmId();

      // Get user role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: firmUser } = await supabase
          .from('firm_users')
          .select('role')
          .eq('auth_user_id', user.id)
          .single();
        setUserRole(firmUser?.role || null);
      }

      // Get client name
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();
      setClientName(client?.name || 'Client');

      // Load all reports for this client
      const { data: reportsData, error } = await supabase
        .from('client_reports')
        .select('*')
        .eq('client_id', clientId)
        .eq('firm_id', firmId)
        .order('report_month', { ascending: false });

      if (error) throw error;

      setReports(reportsData || []);
      if (reportsData && reportsData.length > 0) {
        setSelectedReport(reportsData[0]);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateCurrentMonthReport() {
    setGenerating(true);
    try {
      const firmId = await getMyFirmId();
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const response = await fetch('/api/generate-monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, firmId, month }),
      });

      if (!response.ok) throw new Error('Failed to generate report');
      await loadReports();
      alert('✅ Report generated successfully!');
    } catch (err: any) {
      alert('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Month-over-month data for bar chart
  const momData = [...reports]
    .reverse()
    .slice(-6)
    .map(r => ({
      month: new Date(r.report_month).toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
      spend: r.total_spend_cents / 100,
      receipts: r.total_receipts,
    }));

  const isFirmAdmin = userRole === 'firm_admin' || userRole === 'owner';

  if (loading) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Loading reports...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Monthly Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{clientName}</p>
          </div>
          <div className="flex items-center gap-3">
            {isFirmAdmin && (
              <button
                onClick={generateCurrentMonthReport}
                disabled={generating}
                className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {generating ? "Generating..." : "⚡ Generate This Month"}
              </button>
            )}
<Link
  href="/dashboard/reports/clients"
  className="text-sm text-gray-600 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
>
  ← Back to Client Reports
</Link>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No reports yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Reports are auto-generated at the end of each month
            </p>
            {isFirmAdmin && (
              <button
                onClick={generateCurrentMonthReport}
                disabled={generating}
                className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {generating ? "Generating..." : "Generate First Report"}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Month selector sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Reports</h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-border">
                  {reports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full text-left p-4 transition-colors ${
                        selectedReport?.id === report.id
                          ? 'bg-accent-50 dark:bg-accent-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <div className={`text-sm font-medium ${
                        selectedReport?.id === report.id
                          ? 'text-accent-700 dark:text-accent-300'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatMonth(report.report_month)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatCents(report.total_spend_cents)} • {report.total_receipts} receipts
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Report detail */}
            {selectedReport && (
              <div className="lg:col-span-3 space-y-6">

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Spend</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCents(selectedReport.total_spend_cents)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tax (GST/HST)</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCents(selectedReport.total_tax_cents)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Receipts</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedReport.total_receipts}
                    </div>
                    {selectedReport.total_emails > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{selectedReport.total_emails} via email
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl border p-4 ${
                    selectedReport.total_flagged > 0
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border'
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Flagged</div>
                    <div className={`text-2xl font-bold ${
                      selectedReport.total_flagged > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {selectedReport.total_flagged}
                    </div>
                  </div>
                </div>

                {/* Tax savings callout */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Potential Tax Advantage
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {formatCents(selectedReport.total_tax_cents)} in claimable taxes this month
                        {' '}({formatCents(selectedReport.total_spend_cents - selectedReport.total_tax_cents)} subtotal before tax)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category breakdown + pie chart */}
                {selectedReport.category_breakdown.length > 0 && (
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Spend by Category
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={selectedReport.category_breakdown}
                            dataKey="total_cents"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                          >
                            {selectedReport.category_breakdown.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
<Tooltip
  formatter={(value: number | undefined) => value != null ? formatCents(value) : ''}
/>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {selectedReport.category_breakdown.map((cat, i) => (
                          <div key={cat.category} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="text-gray-700 dark:text-gray-300">{cat.category}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCents(cat.total_cents)}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 ml-2">
                                ({cat.count} receipt{cat.count !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Budget comparison */}
                {selectedReport.budget_comparison.length > 0 && (
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Budget vs Actual
                    </h2>
                    <div className="space-y-3">
                      {selectedReport.budget_comparison.map(bc => (
                        <div key={bc.category}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {bc.category}
                              </span>
                              {bc.is_over_budget && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                  ⚠️ Over
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCents(bc.spent_cents)} / {formatCents(bc.budget_cents)} ({bc.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${bc.is_over_budget ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(bc.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Month-over-month chart */}
                {momData.length > 1 && (
                  <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Month-over-Month Spending
                    </h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={momData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                        <Tooltip formatter={(v: number | undefined) => v != null ? `$${v.toFixed(2)}` : ''} />
                            <Legend />
                        <Bar dataKey="spend" name="Total Spend ($)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  Generated: {new Date(selectedReport.generated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}