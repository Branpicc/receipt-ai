"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";
import {
  Receipt as ReceiptIcon,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Mail,
  Users,
  BarChart3,
} from "lucide-react";

type AccountantStats = {
  accountant_id: string;
  accountant_email: string;
  total_clients: number;
  total_receipts: number;
  categorized_receipts: number;
  needs_review: number;
  completion_rate: number;
};

type FirmOverview = {
  total_receipts: number;
  total_categorized: number;
  total_needs_review: number;
  total_flagged: number;
  total_emails_received: number;
  emails_pending: number;
  emails_approved: number;
  overall_completion_rate: number;
};

// Firm-wide analytics for the firm admin / owner. Previously gated behind
// the "advanced_reports" feature flag, but this is a firm's own
// operational visibility (their accountants' performance, their own
// receipt counts) — not really a "premium report" — so it's available
// regardless of plan. The role check inside checkAccess() still keeps
// non-admin users out.
export default function FirmAdminDashboard() {
  return <FirmAdminDashboardContent />;
}

function FirmAdminDashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [firmOverview, setFirmOverview] = useState<FirmOverview | null>(null);
  const [accountantStats, setAccountantStats] = useState<AccountantStats[]>([]);
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month");

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (userRole === "firm_admin" || userRole === "owner") {
loadAnalytics(dateRange);
    }
  }, [userRole, dateRange]);

  async function checkAccess() {
    const role = await getUserRole();
    setUserRole(role);

    if (role !== "firm_admin" && role !== "owner") {
      alert("Access denied. This dashboard is only for firm administrators.");
      router.push("/dashboard");
      return;
    }
  }

async function loadAnalytics(range = dateRange) {
      try {
      setLoading(true);
      const firmId = await getMyFirmId();

      // Calculate date range
      let startDate: string | null = null;
      const now = new Date();
      
if (range === "week") {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
} else if (range === "month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (range === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
      } else if (range === "year") {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      // Apply the optional date scope to a count query so filtering happens
      // in Supabase rather than after pulling every row into memory.
      const scopeReceiptCount = (q: any) => {
        q = q.eq("firm_id", firmId);
        if (startDate) q = q.gte("created_at", startDate);
        return q;
      };

      const scopeEmailCount = (q: any) => {
        q = q.eq("firm_id", firmId);
        if (startDate) q = q.gte("received_at", startDate);
        return q;
      };

      // Run firm-overview counts in parallel — they're all independent.
      const [
        totalRes,
        catRes,
        reviewRes,
        flagsRes,
        totalEmailRes,
        pendingEmailRes,
        approvedEmailRes,
      ] = await Promise.all([
        scopeReceiptCount(supabase.from("receipts").select("*", { count: "exact", head: true })),
        scopeReceiptCount(
          supabase.from("receipts").select("*", { count: "exact", head: true }).not("approved_category", "is", null)
        ),
        scopeReceiptCount(
          supabase.from("receipts").select("*", { count: "exact", head: true }).eq("status", "needs_review")
        ),
        supabase
          .from("receipt_flags")
          .select("receipt_id")
          .eq("firm_id", firmId)
          .is("resolved_at", null),
        scopeEmailCount(supabase.from("email_receipts").select("*", { count: "exact", head: true })),
        scopeEmailCount(
          supabase.from("email_receipts").select("*", { count: "exact", head: true }).eq("status", "pending")
        ),
        scopeEmailCount(
          supabase.from("email_receipts").select("*", { count: "exact", head: true }).eq("status", "approved")
        ),
      ]);

      const totalReceipts = totalRes.count || 0;
      const categorized = catRes.count || 0;
      const needsReview = reviewRes.count || 0;
      const flaggedCount = new Set(
        ((flagsRes.data as { receipt_id: string }[] | null) || []).map((f) => f.receipt_id)
      ).size;
      const totalEmails = totalEmailRes.count || 0;
      const emailsPending = pendingEmailRes.count || 0;
      const emailsApproved = approvedEmailRes.count || 0;

      setFirmOverview({
        total_receipts: totalReceipts,
        total_categorized: categorized,
        total_needs_review: needsReview,
        total_flagged: flaggedCount,
        total_emails_received: totalEmails,
        emails_pending: emailsPending,
        emails_approved: emailsApproved,
        overall_completion_rate: totalReceipts > 0 ? Math.round((categorized / totalReceipts) * 100) : 0,
      });

      // ── Accountant performance stats ───────────────────────────────────
      // Old version was N+1: for each accountant we fired 1 client lookup +
      // 3 receipt counts = 4 round trips per accountant. With 10 accountants
      // that's 41 sequential trips. Now we fetch the accountant list and
      // the full client→accountant mapping in parallel up-front, then run
      // the 3 receipt counts per accountant in parallel rather than serial.
      const [accountantsRes, allClientsRes] = await Promise.all([
        supabase
          .from("firm_users")
          .select("id, display_name, auth_user_id")
          .eq("firm_id", firmId)
          .eq("role", "accountant"),
        supabase
          .from("clients")
          .select("id, assigned_accountant_id")
          .eq("firm_id", firmId)
          .not("assigned_accountant_id", "is", null),
      ]);

      const accountants = accountantsRes.data;
      const allClients = (allClientsRes.data as { id: string; assigned_accountant_id: string | null }[] | null) || [];

      // Build accountant_id → client_id[] map in JS (single O(n) pass).
      const clientsByAccountant = new Map<string, string[]>();
      for (const c of allClients) {
        if (!c.assigned_accountant_id) continue;
        const arr = clientsByAccountant.get(c.assigned_accountant_id) || [];
        arr.push(c.id);
        clientsByAccountant.set(c.assigned_accountant_id, arr);
      }

      if (accountants && accountants.length > 0) {
        const stats = await Promise.all(accountants.map(async (acc) => {
          const clientIds = clientsByAccountant.get(acc.id) || [];

          if (clientIds.length === 0) {
            return {
              accountant_id: acc.id,
              accountant_email: acc.display_name || acc.auth_user_id,
              total_clients: 0,
              total_receipts: 0,
              categorized_receipts: 0,
              needs_review: 0,
              completion_rate: 0,
            };
          }

          const buildQ = (extra?: (q: any) => any) => {
            let q = supabase
              .from("receipts")
              .select("*", { count: "exact", head: true })
              .eq("firm_id", firmId)
              .in("client_id", clientIds);
            if (startDate) q = q.gte("created_at", startDate);
            return extra ? extra(q) : q;
          };

          // The 3 counts are independent — run them in parallel.
          const [totalR, catR, reviewR] = await Promise.all([
            buildQ(),
            buildQ((q) => q.not("approved_category", "is", null)),
            buildQ((q) => q.eq("status", "needs_review")),
          ]);

          const totalCount = totalR.count || 0;
          const catCount = catR.count || 0;
          const reviewCount = reviewR.count || 0;

          return {
            accountant_id: acc.id,
            accountant_email: acc.display_name || acc.auth_user_id,
            total_clients: clientIds.length,
            total_receipts: totalCount,
            categorized_receipts: catCount,
            needs_review: reviewCount,
            completion_rate: totalCount ? Math.round((catCount / totalCount) * 100) : 0,
          };
        }));
        setAccountantStats(stats);
      }

    } catch (error: any) {
      console.error("Failed to load analytics:", error);
      alert("Failed to load analytics: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !userRole) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Firm Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of receipt processing and team performance
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 mb-6 border border-transparent dark:border-dark-border">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("week")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "week"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "month"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRange("quarter")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "quarter"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => setDateRange("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "year"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Year
            </button>
          </div>
        </div>

        {/* Firm Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Receipts</div>
              <ReceiptIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {firmOverview?.total_receipts || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Categorized</div>
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {firmOverview?.total_categorized || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {firmOverview?.overall_completion_rate || 0}% complete
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Needs Review</div>
              <Eye className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {firmOverview?.total_needs_review || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Flagged Issues</div>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {firmOverview?.total_flagged || 0}
            </div>
          </div>
        </div>

        {/* Email Stats */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-8 border border-transparent dark:border-dark-border">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" /> Email Processing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Received</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {firmOverview?.total_emails_received || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {firmOverview?.emails_pending || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Approved</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {firmOverview?.emails_approved || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Accountant Performance (Coming Soon) */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Accountant Performance
          </h2>

          {accountantStats.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
<p className="text-gray-500 dark:text-gray-400 mb-2">
                No accountants found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Invite accountants from the Team page to see performance tracking
              </p>
                          </div>
          ) : (
            <div className="space-y-4">
              {accountantStats.map((stat) => (
                <div
                  key={stat.accountant_id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {stat.accountant_email}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {stat.completion_rate}% complete
                    </div>
                  </div>
<div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Clients</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{stat.total_clients}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Receipts</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{stat.total_receipts}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Categorized</div>
                      <div className="font-semibold text-green-600 dark:text-green-400">{stat.categorized_receipts}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Needs Review</div>
                      <div className="font-semibold text-orange-600 dark:text-orange-400">{stat.needs_review}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Completion rate</span>
                      <span>{stat.completion_rate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-dark-hover rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${stat.completion_rate}%` }}
                      />
                    </div>
                  </div>
                                  </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}