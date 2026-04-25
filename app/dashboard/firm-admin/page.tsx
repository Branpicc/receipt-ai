"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";

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

export default function FirmAdminDashboard() {
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
      loadAnalytics();
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

  async function loadAnalytics() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      // Calculate date range
      let startDate: string | null = null;
      const now = new Date();
      
      if (dateRange === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateRange === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
      } else if (dateRange === "year") {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      // Load firm overview
      let receiptsQuery = supabase
        .from("receipts")
        .select("id, status, approved_category, created_at")
        .eq("firm_id", firmId);

      if (startDate) {
        receiptsQuery = receiptsQuery.gte("created_at", startDate);
      }

      const { data: receipts, error: receiptsError } = await receiptsQuery;
      if (receiptsError) throw receiptsError;

      const totalReceipts = receipts?.length || 0;
      const categorized = receipts?.filter(r => r.approved_category).length || 0;
      const needsReview = receipts?.filter(r => r.status === "needs_review").length || 0;

      // Load flagged receipts
      const { data: flags } = await supabase
        .from("receipt_flags")
        .select("receipt_id")
        .eq("firm_id", firmId)
        .is("resolved_at", null);

      const flaggedCount = new Set(flags?.map(f => f.receipt_id) || []).size;

      // Load email stats
      let emailQuery = supabase
        .from("email_receipts")
        .select("status")
        .eq("firm_id", firmId);

      if (startDate) {
        emailQuery = emailQuery.gte("received_at", startDate);
      }

      const { data: emails } = await emailQuery;

      const totalEmails = emails?.length || 0;
      const emailsPending = emails?.filter(e => e.status === "pending").length || 0;
      const emailsApproved = emails?.filter(e => e.status === "approved").length || 0;

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

// Load accountant performance stats
      const { data: accountants } = await supabase
        .from("firm_users")
        .select("id, display_name, auth_user_id")
        .eq("firm_id", firmId)
        .eq("role", "accountant");

      if (accountants && accountants.length > 0) {
        const stats = await Promise.all(accountants.map(async (acc) => {
          // Get clients assigned to this accountant
          const { data: assignedClients } = await supabase
            .from("clients")
            .select("id")
            .eq("firm_id", firmId)
            .eq("assigned_accountant_id", acc.id);
          
          const clientIds = assignedClients?.map(c => c.id) || [];
          
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

          const { count: totalR } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .in("client_id", clientIds);

          const { count: catR } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .in("client_id", clientIds)
            .not("approved_category", "is", null);

          const { count: reviewR } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .in("client_id", clientIds)
            .eq("status", "needs_review");

          return {
            accountant_id: acc.id,
            accountant_email: acc.display_name || acc.auth_user_id,
            total_clients: clientIds.length,
            total_receipts: totalR || 0,
            categorized_receipts: catR || 0,
            needs_review: reviewR || 0,
            completion_rate: totalR ? Math.round(((catR || 0) / totalR) * 100) : 0,
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
              <div className="text-2xl">📄</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {firmOverview?.total_receipts || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Categorized</div>
              <div className="text-2xl">✅</div>
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
              <div className="text-2xl">👀</div>
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {firmOverview?.total_needs_review || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Flagged Issues</div>
              <div className="text-2xl">⚠️</div>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {firmOverview?.total_flagged || 0}
            </div>
          </div>
        </div>

        {/* Email Stats */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-8 border border-transparent dark:border-dark-border">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📧 Email Processing
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            👥 Accountant Performance
          </h2>
          
          {accountantStats.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 text-5xl mb-4">📊</div>
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