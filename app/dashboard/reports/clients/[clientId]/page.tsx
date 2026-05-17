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
import { useFeatureGate } from "@/lib/useFeatureGate";
import UpgradeRequired from "@/components/UpgradeRequired";
import {
  Calendar,
  BarChart3,
  FileText,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";

type ClientReport = {
  id: string;
  report_month: string;
  report_type?: "monthly" | "fiscal_year";
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
  ai_summary?: string | null;
  generated_at: string;
};

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

function formatMonth(dateStr: string) {
  const [year, month] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
}

/**
 * Human-readable period label for a report. Monthly reports show
 * "April 2025"; fiscal-year reports show the explicit date range
 * "April 1, 2025 – March 31, 2026" so the user can tell at a glance
 * which 12-month window the aggregate covers.
 */
function formatReportPeriod(report: { report_month: string; report_type?: "monthly" | "fiscal_year" }): string {
  if (report.report_type !== "fiscal_year") {
    return formatMonth(report.report_month);
  }
  const [year, month] = report.report_month.split("-").map(Number);
  // report_month is the first day of the fiscal year; the end is the
  // last day of the same calendar month one year later.
  const start = new Date(year, month - 1, 1);
  const end = new Date(year + 1, month - 1, 0); // day 0 of next month = last day of current
  const fmt: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
  return `${start.toLocaleDateString("en-CA", fmt)} – ${end.toLocaleDateString("en-CA", fmt)}`;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ClientReportsPage() {
  const gate = useFeatureGate("client_reports");
  if (gate.loading) return null;
  if (!gate.allowed) return <UpgradeRequired feature="client_reports" asClient={gate.role === "client"} />;
  return <ClientReportsContent />;
}

function ClientReportsContent() {
  const params = useParams();
  const clientId = params?.clientId as string;

  const [reports, setReports] = useState<ClientReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ClientReport | null>(null);
  const [clientName, setClientName] = useState("");
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState<number>(12);

  // Set document.title on the report-detail page so the browser's
  // print-to-PDF dialog defaults to a sensible filename like
  // "Receipture - Singh Ltd. - Monthly Report - April 2026.pdf".
  // Browsers use document.title both for the saved file's suggested
  // name and for the per-page running header in the PDF output.
  useEffect(() => {
    if (!selectedReport || !clientName) return;
    const previous = document.title;
    const kind = selectedReport.report_type === "fiscal_year" ? "Fiscal Year Report" : "Monthly Report";
    const period = selectedReport.report_type === "fiscal_year"
      ? formatReportPeriod(selectedReport)
      : formatMonth(selectedReport.report_month);
    document.title = `Receipture - ${clientName} - ${kind} - ${period}`;
    return () => {
      document.title = previous;
    };
  }, [selectedReport, clientName]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  // Month input value, format "YYYY-MM" (HTML <input type="month">).
  // Defaults to the current month; lets staff generate a report for any
  // historical month, not just "now".
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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

      // Get client name + fiscal year end month
      const { data: client } = await supabase
        .from('clients')
        .select('name, fiscal_year_end_month')
        .eq('id', clientId)
        .single();
      setClientName(client?.name || 'Client');
      setFiscalYearEndMonth(client?.fiscal_year_end_month || 12);

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

async function generateComprehensiveReport() {
    try {
      setGenerating(true);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Your session expired. Please log in again.');
        return;
      }
      const monthStart = `${targetMonth}-01`;
      const response = await fetch('/api/generate-comprehensive-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId, firmId, month: monthStart }),
      });
            if (!response.ok) throw new Error('Failed to generate report');
      alert('✅ Comprehensive report with AI summary generated!');
      await loadReports();
    } catch (err: any) {
      alert('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

async function generateCurrentMonthReport() {
    try {
      setGenerating(true);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Your session expired. Please log in again.');
        return;
      }
      const monthStart = `${targetMonth}-01`;
      const response = await fetch('/api/generate-monthly-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId, firmId, month: monthStart }),
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

  // Default fiscal-year-ending input value: the most recently completed
  // fiscal year. If we're partway through the current FY (current month
  // <= fiscal_year_end_month) the most recent COMPLETED one ended in the
  // previous calendar year; otherwise it ends this calendar year.
  function defaultFiscalYearEnding(): string {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const completedYear =
      currentMonth > fiscalYearEndMonth ? now.getFullYear() : now.getFullYear() - 1;
    return `${completedYear}-${String(fiscalYearEndMonth).padStart(2, "0")}`;
  }
  const [fiscalYearEnding, setFiscalYearEnding] = useState<string>(defaultFiscalYearEnding);
  // Keep the default in sync when fiscalYearEndMonth loads from the DB.
  useEffect(() => {
    setFiscalYearEnding(defaultFiscalYearEnding());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYearEndMonth]);

  async function generateFiscalYearReport() {
    try {
      setGenerating(true);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Your session expired. Please log in again.');
        return;
      }
      const response = await fetch('/api/generate-fiscal-year-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId,
          firmId,
          fiscalYearEnding: `${fiscalYearEnding}-01`,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate fiscal year report');
      }
      await loadReports();
      alert('✅ Fiscal year report generated.');
    } catch (err: any) {
      alert('Failed: ' + err.message);
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
  // Accountants generate + download alongside firm admins; only the
  // bulk-across-all-clients action stays admin-only (lives elsewhere).
  const canGenerate = isFirmAdmin || userRole === 'accountant';

  if (loading) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Loading reports...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header — hidden in print so the PDF starts at the client name. */}
        <div className="flex items-center justify-between mb-8 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Monthly Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{clientName}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
{canGenerate && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="whitespace-nowrap">Month:</span>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                    className="px-2 py-1.5 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
                  />
                </label>
                <button
                  onClick={generateComprehensiveReport}
                  disabled={generating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {generating ? "Generating..." : "🤖 AI Comprehensive"}
                </button>
                <button
                  onClick={generateCurrentMonthReport}
                  disabled={generating}
                  className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {generating ? "Generating..." : "⚡ Generate Monthly"}
                </button>

                <span className="hidden md:inline-block w-px h-6 bg-gray-300 dark:bg-dark-border mx-1" />

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="whitespace-nowrap">FY ending:</span>
                  <input
                    type="month"
                    value={fiscalYearEnding}
                    onChange={(e) => setFiscalYearEnding(e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
                  />
                </label>
                <button
                  onClick={generateFiscalYearReport}
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                  title={`Aggregates the 12 months ending in month ${fiscalYearEndMonth}. Configure on the client.`}
                >
                  <Calendar className="w-4 h-4" />
                  {generating ? "Generating..." : "Generate Fiscal Year"}
                </button>
              </>
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
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No reports yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Reports are auto-generated at the end of each month
            </p>
            {canGenerate && (
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
          // Grid collapses to a single column in print so the print-only
          // block uses the full page width instead of column 4 of 4.
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">

            {/* Month selector sidebar — list of historical reports.
                Hidden in print since the PDF is for the selected report. */}
            <div className="lg:col-span-1 print:hidden">
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
                      <div className={`text-sm font-medium flex items-center gap-1.5 ${
                        selectedReport?.id === report.id
                          ? 'text-accent-700 dark:text-accent-300'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {report.report_type === "fiscal_year" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">FY</span>
                        )}
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
              <>
              <div className="lg:col-span-3 space-y-6 print:hidden">
                {/* Print-only header — only renders to PDF, hidden in app */}
                <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-900">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {clientName} — {selectedReport.report_type === "fiscal_year" ? "Fiscal Year Report" : "Monthly Report"}
                  </h1>
                  <p className="text-sm text-gray-700">{formatReportPeriod(selectedReport)}</p>
                  <p className="text-xs text-gray-500 mt-1">Generated by Receipture · receipture.ca</p>
                </div>

                {/* In-app fiscal-year date-range banner so the user sees the
                    actual window without exporting to PDF. */}
                {selectedReport.report_type === "fiscal_year" && (
                  <div className="print:hidden rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                      Fiscal Year
                    </div>
                    <div className="text-base font-medium text-emerald-900 dark:text-emerald-100">
                      {formatReportPeriod(selectedReport)}
                    </div>
                  </div>
                )}
                {/* Download / print toolbar — hidden in print output */}
                <div className="print:hidden flex justify-end">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Download PDF
                  </button>
                </div>
                {/* AI Summary */}
                {selectedReport.ai_summary && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                      🤖 AI Report Summary
                    </h3>
<div className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedReport.ai_summary
                        .replace(/^## (.+)$/gm, '<h3 class="font-semibold mt-4 mb-1">$1</h3>')
                        .replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-2 mb-2">$1</h2>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n\n/g, '<br/><br/>')
                        .replace(/^\d+\.\s/gm, '<br/>• ')
                        .replace(/^---$/gm, '<hr/>')
                      }}
                    />
                                      </div>
                )}
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
<Link
                    href={selectedReport.total_flagged > 0 ? `/dashboard/flags?client=${clientId}` : '#'}
                    className={`rounded-xl border p-4 block ${
                      selectedReport.total_flagged > 0
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer'
                        : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border'
                    }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Flagged {selectedReport.total_flagged > 0 && '→'}</div>
                    <div className={`text-2xl font-bold ${
                      selectedReport.total_flagged > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {selectedReport.total_flagged}
                    </div>
                  </Link>
                                  </div>

                {/* Tax savings callout */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-6 h-6 text-green-700 dark:text-green-400" />
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
  formatter={(value: any) => [value != null ? formatCents(Number(value)) : '', '']}
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
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Over
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
<Tooltip formatter={(value: any) => [value != null ? `$${Number(value).toFixed(2)}` : '', '']} />
                              <Legend />
                        <Bar dataKey="spend" name="Total Spend ($)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

{/* Report Totals Summary */}
                <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" /> Report Summary
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Total Receipts</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{selectedReport.total_receipts}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Total Value</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{formatCents(selectedReport.total_spend_cents)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Total Tax</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{formatCents(selectedReport.total_tax_cents)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Flagged</div>
                      <div className="font-semibold text-red-600 dark:text-red-400">{selectedReport.total_flagged}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Email Receipts</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{selectedReport.total_emails}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Categories</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{selectedReport.category_breakdown.length}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  Generated: {new Date(selectedReport.generated_at).toLocaleString()}
                </div>
                              </div>

              {/* Print-only PDF layout. Hidden in-app, visible only in
                  the browser's print preview. Structured into 4 pages so
                  the output reads cleanly when saved as PDF. */}
              {(() => {
                // Build the month-over-month series: the selected report
                // plus the two reports immediately preceding it. `reports`
                // is sorted DESC by report_month, so prior ones are at
                // higher indices than the selected one. Reverse for
                // chart-friendly chronological order.
                const idx = reports.findIndex(r => r.id === selectedReport.id);
                const priorReports = idx >= 0 ? reports.slice(idx + 1, idx + 3) : [];
                const trio = [selectedReport, ...priorReports];
                const momPrintData = [...trio]
                  .reverse()
                  .map(r => ({
                    label: new Date(r.report_month).toLocaleDateString("en-CA", { month: "short", year: "numeric" }),
                    spend: r.total_spend_cents / 100,
                  }));

                const reportKind = selectedReport.report_type === "fiscal_year" ? "Fiscal Year Report" : "Monthly Report";
                const subtotal = selectedReport.total_spend_cents - selectedReport.total_tax_cents;

                return (
                  <div className="hidden print:block print-area">
                    {/* PAGE 1 — Title + Summary */}
                    <section className="break-after-page">
                      <header className="mb-8 pb-4 border-b-2 border-gray-900">
                        <h1 className="text-3xl font-bold text-gray-900">{clientName}</h1>
                        <p className="text-lg text-gray-700 mt-1">{reportKind} · {formatReportPeriod(selectedReport)}</p>
                        <p className="text-xs text-gray-500 mt-2">Generated by Receipture · receipture.ca</p>
                      </header>

                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Summary</h2>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="border border-gray-300 rounded-xl p-5">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Spend</div>
                          <div className="text-3xl font-bold text-gray-900">{formatCents(selectedReport.total_spend_cents)}</div>
                          <div className="text-xs text-gray-600 mt-1">Subtotal {formatCents(subtotal)} before tax</div>
                        </div>
                        <div className="border border-gray-300 rounded-xl p-5">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Tax (GST/HST)</div>
                          <div className="text-3xl font-bold text-gray-900">{formatCents(selectedReport.total_tax_cents)}</div>
                          <div className="text-xs text-gray-600 mt-1">Claimable on return</div>
                        </div>
                        <div className="border border-gray-300 rounded-xl p-5">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Receipts</div>
                          <div className="text-3xl font-bold text-gray-900">{selectedReport.total_receipts}</div>
                          {selectedReport.total_emails > 0 && (
                            <div className="text-xs text-gray-600 mt-1">+{selectedReport.total_emails} via email</div>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded-xl p-5">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Flagged</div>
                          <div className="text-3xl font-bold text-gray-900">{selectedReport.total_flagged}</div>
                          {selectedReport.total_flagged > 0 && (
                            <div className="text-xs text-gray-600 mt-1">Needs review</div>
                          )}
                        </div>
                      </div>

                      <div className="border border-green-300 rounded-xl p-5 bg-green-50">
                        <div className="text-sm font-semibold text-green-900 mb-1">Potential Tax Advantage</div>
                        <p className="text-sm text-green-800">
                          {formatCents(selectedReport.total_tax_cents)} in claimable taxes for this period
                          ({formatCents(subtotal)} subtotal before tax).
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                        <div className="border border-gray-300 rounded-xl p-4">
                          <div className="text-xs text-gray-500">Categories used</div>
                          <div className="text-xl font-semibold text-gray-900">{selectedReport.category_breakdown.length}</div>
                        </div>
                        <div className="border border-gray-300 rounded-xl p-4">
                          <div className="text-xs text-gray-500">Email receipts</div>
                          <div className="text-xl font-semibold text-gray-900">{selectedReport.total_emails}</div>
                        </div>
                      </div>
                    </section>

                    {/* PAGE 2 — Spend by Category + Budget vs Actual side-by-side */}
                    <section className="break-after-page">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="border border-gray-300 rounded-xl p-5">
                          <h2 className="text-lg font-semibold text-gray-900 mb-3">Spend by Category</h2>
                          <ul className="text-sm">
                            {selectedReport.category_breakdown.map((cat, i) => (
                              <li key={cat.category} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
                                <span className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                  />
                                  <span className="text-gray-900 truncate">{cat.category}</span>
                                </span>
                                <span className="text-gray-700 ml-2 whitespace-nowrap">
                                  {formatCents(cat.total_cents)}
                                  <span className="text-gray-500 ml-1">({cat.count})</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="border border-gray-300 rounded-xl p-5">
                          <h2 className="text-lg font-semibold text-gray-900 mb-3">Budget vs Actual</h2>
                          {selectedReport.budget_comparison.length === 0 ? (
                            <p className="text-sm text-gray-500">No budgets configured for this client.</p>
                          ) : (
                            <ul className="text-sm space-y-2">
                              {selectedReport.budget_comparison.map(bc => (
                                <li key={bc.category}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-gray-900">{bc.category}</span>
                                    <span className={`text-xs ${bc.is_over_budget ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                      {bc.percentage}%{bc.is_over_budget ? " · over" : ""}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${bc.is_over_budget ? "bg-red-500" : "bg-green-500"}`}
                                      style={{ width: `${Math.min(bc.percentage, 100)}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-600 mt-0.5">
                                    {formatCents(bc.spent_cents)} of {formatCents(bc.budget_cents)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* PAGE 3 — Month-over-month bar chart (selected
                         month plus the two preceding months) and the
                         AI Comprehensive Report stacked together since
                         neither fills a page on its own. */}
                    <section className="space-y-6">
                      <div className="border border-gray-300 rounded-xl p-5">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Month-over-Month Spending</h2>
                        {momPrintData.length === 0 ? (
                          <p className="text-sm text-gray-500">No reports on file for this client yet.</p>
                        ) : (
                          <div className="flex justify-center">
                            <BarChart width={520} height={240} data={momPrintData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#374151" }} stroke="#9ca3af" />
                              <YAxis tick={{ fontSize: 12, fill: "#374151" }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
                              <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </div>
                        )}
                      </div>

                      {selectedReport.ai_summary && (
                        <div className="border border-gray-300 rounded-xl p-5">
                          <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Comprehensive Report</h2>
                          <div
                            className="text-sm text-gray-800 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: selectedReport.ai_summary
                                .replace(/^## (.+)$/gm, '<h3 class="font-semibold mt-4 mb-1 text-gray-900">$1</h3>')
                                .replace(/^# (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-2 text-gray-900">$1</h2>')
                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\n\n/g, '<br/><br/>')
                                .replace(/^\d+\.\s/gm, '<br/>• ')
                                .replace(/^---$/gm, '<hr class="my-3"/>'),
                            }}
                          />
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}