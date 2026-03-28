"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";
import { convertHeicToJpg } from "@/lib/convertHeicClient";
import UsageStats from "@/components/UsageStats";

type UploadProgress = {
  total: number;
  current: number;
  currentFile: string;
  succeeded: number;
  failed: number;
};

type RecentReceipt = {
  id: string;
  vendor: string | null;
  total_cents: number;
  receipt_date: string | null;
  created_at: string;
  approved_category: string | null;
};

type BudgetStatus = {
  category: string;
  budget_cents: number;
  spent_cents: number;
  percentage: number;
};

type MonthlyReport = {
  id: string;
  report_month: string;
  total_spend_cents: number;
  total_receipts: number;
  total_tax_cents: number;
};

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);

  const [stats, setStats] = useState({
    totalReceipts: 0,
    thisMonth: 0,
    categorized: 0,
  });

  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [recentReports, setRecentReports] = useState<MonthlyReport[]>([]);

  useEffect(() => {
    loadClientInfo();
  }, []);

  async function loadClientInfo() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (firmUser?.client_id) {
        setClientId(firmUser.client_id);

        const { data: client } = await supabase
          .from("clients")
          .select("name, email_alias, client_code")
          .eq("id", firmUser.client_id)
          .single();

        if (client) {
          setClientName(client.name);
          const emailAlias = client.email_alias || client.client_code;
          setClientEmail(`${emailAlias}@receipts.example.com`);
        }

        await loadStats(firmUser.client_id, firmId);
        await loadRecentReceipts(firmUser.client_id);
        await loadBudgetStatus(firmUser.client_id, firmId);
        await loadRecentReports(firmUser.client_id, firmId);
      }
    } catch (error) {
      console.error("Failed to load client info:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(clientId: string, firmId: string) {
    const { count: total } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("client_id", clientId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: thisMonth } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .gte("created_at", startOfMonth.toISOString());

    const { count: categorized } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .not("approved_category", "is", null);

    setStats({
      totalReceipts: total || 0,
      thisMonth: thisMonth || 0,
      categorized: categorized || 0,
    });
  }

  async function loadRecentReceipts(clientId: string) {
    const { data } = await supabase
      .from("receipts")
      .select("id, vendor, total_cents, receipt_date, created_at, approved_category")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentReceipts((data as RecentReceipt[]) || []);
  }

  async function loadBudgetStatus(clientId: string, firmId: string) {
    const { data: budgets } = await supabase
      .from("category_budgets")
      .select("category, monthly_budget_cents")
      .eq("firm_id", firmId);

    if (!budgets || budgets.length === 0) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: receipts } = await supabase
      .from("receipts")
      .select("approved_category, total_cents")
      .eq("client_id", clientId)
      .not("approved_category", "is", null)
      .gte("created_at", startOfMonth.toISOString());

    const spendingByCategory: Record<string, number> = {};
    receipts?.forEach((r) => {
      const cat = r.approved_category!;
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + r.total_cents;
    });

    const status: BudgetStatus[] = budgets
      .map((b) => ({
        category: b.category,
        budget_cents: b.monthly_budget_cents,
        spent_cents: spendingByCategory[b.category] || 0,
        percentage: b.monthly_budget_cents > 0
          ? Math.round((spendingByCategory[b.category] || 0) / b.monthly_budget_cents * 100)
          : 0,
      }))
      .filter((b) => b.budget_cents > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4);

    setBudgetStatus(status);
  }

  async function loadRecentReports(clientId: string, firmId: string) {
    const { data } = await supabase
      .from("client_reports")
      .select("id, report_month, total_spend_cents, total_receipts, total_tax_cents")
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .order("report_month", { ascending: false })
      .limit(3);

    setRecentReports((data as MonthlyReport[]) || []);
  }

  async function handleMultipleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!clientId) return;

    const fileArray = Array.from(files);

    try {
      setUploading(true);
      setUploadProgress({
        total: fileArray.length,
        current: 0,
        currentFile: fileArray[0]?.name || "",
        succeeded: 0,
        failed: 0,
      });

      const firmId = await getMyFirmId();

const { checkReceiptUploadLimit } = await import('@/lib/checkUsageLimits');
const initialCheck = await checkReceiptUploadLimit(firmId);
// All paid plans are unlimited — only block if truly over limit
if (!initialCheck.canUpload && initialCheck.limit !== -1) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = lastDay.getDate() - now.getDate();
  if (confirm(`📊 Monthly Limit Reached\n\nYou've used all ${initialCheck.limit} receipts on your ${initialCheck.plan} plan this month.\n\n${daysRemaining} days remaining until your limit resets.\n\nUpgrade to continue uploading receipts immediately!\n\nView upgrade options?`)) {
    window.location.href = "/dashboard/settings";
  }
  setUploading(false);
  setUploadProgress(null);
  return;
}
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      let succeeded = 0;
      let failed = 0;
      let limitReached = false;
      let currentUsage = initialCheck.currentCount;
      const limit = initialCheck.limit;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        setUploadProgress({
          total: fileArray.length,
          current: i + 1,
          currentFile: file.name,
          succeeded,
          failed,
        });

if (limit !== -1 && currentUsage >= limit) {
  limitReached = true;
  const remainingFiles = fileArray.length - i;
            const now = new Date();
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const daysRemaining = lastDay.getDate() - now.getDate();
          if (confirm(`📊 Monthly Limit Reached\n\nSuccessfully uploaded ${succeeded} receipt${succeeded !== 1 ? 's' : ''}.\n${remainingFiles} file${remainingFiles !== 1 ? 's' : ''} not uploaded (limit reached).\n\nYou've used all ${limit} receipts on your ${initialCheck.plan} plan.\n${daysRemaining} days remaining until reset.\n\nUpgrade to upload the remaining receipts!\n\nView upgrade options?`)) {
            window.location.href = "/dashboard/settings";
          }
          break;
        }

        try {
          let uploadFile = file;
          try {
            uploadFile = await convertHeicToJpg(file);
          } catch (conversionError) {
            console.error('HEIC conversion failed for', file.name, conversionError);
            failed++;
            continue;
          }

          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("firmId", firmId);
          formData.append("clientId", clientId);
          if (userId) formData.append("userId", userId);

          const response = await fetch("/api/upload-receipt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);

          succeeded++;
          currentUsage++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failed++;
        }
      }

      if (!limitReached) {
        if (failed === 0) alert(`✅ All ${succeeded} receipts uploaded successfully!`);
        else if (succeeded === 0) alert(`❌ Failed to upload all ${failed} receipts. Please try again.`);
        else alert(`⚠️ Uploaded ${succeeded} receipts successfully. ${failed} failed.`);
      }

      if (clientId) {
        const firmId = await getMyFirmId();
        await loadStats(clientId, firmId);
        await loadRecentReceipts(clientId);
        await loadBudgetStatus(clientId, firmId);
        setUsageRefreshKey(prev => prev + 1);
      }
    } catch (err: any) {
      alert("Upload process failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const completionRate = stats.totalReceipts > 0
    ? Math.round((stats.categorized / stats.totalReceipts) * 100)
    : 0;

  function formatMonth(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back, {clientName}!
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Track your receipts and manage your business expenses
      </p>

      {/* Upload Hero */}
      <div className="bg-gradient-to-br from-accent-600 to-accent-800 dark:from-accent-500 dark:to-accent-700 rounded-xl p-6 mb-8 text-white shadow-lg">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold mb-2">Upload Receipts</h2>
          <p className="text-accent-50 mb-6">
            Select one or multiple receipts to upload. Our AI will extract all the details automatically.
          </p>
          <label
            htmlFor="hero-upload"
            className={`block border-2 border-dashed border-accent-200 dark:border-accent-300 rounded-xl p-6 text-center cursor-pointer hover:border-white hover:bg-white/10 transition-all ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="file"
              id="hero-upload"
              accept="image/*,application/pdf,.heic,.heif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleMultipleFiles(e.target.files)}
            />
            {uploading && uploadProgress ? (
              <div className="space-y-3">
                <div className="text-4xl mb-3">⏳</div>
                <div className="text-lg font-semibold">
                  Uploading {uploadProgress.current} of {uploadProgress.total}
                </div>
                <div className="text-sm text-accent-100">{uploadProgress.currentFile}</div>
                <div className="w-full bg-accent-700 rounded-full h-2 mt-3">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-accent-100 mt-2">
                  ✅ {uploadProgress.succeeded} succeeded • ❌ {uploadProgress.failed} failed
                </div>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📸</div>
                <div className="text-lg font-semibold mb-2">Click to upload or drag here</div>
                <div className="text-sm text-accent-100">Supports JPG, PNG, PDF, HEIC • Select multiple files</div>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Email Inbox Reminder */}
      {clientEmail && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📧</div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Your Receipt Inbox</h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                Forward receipts to your personal email address and we'll process them automatically:
              </p>
              <div className="bg-white dark:bg-dark-surface border border-blue-300 dark:border-blue-700 rounded px-3 py-2 font-mono text-sm text-gray-900 dark:text-white inline-block">
                {clientEmail}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="mb-8">
        <UsageStats key={usageRefreshKey} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">My Receipts</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
        </Link>
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">This Month</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</div>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Categorized</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{completionRate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.categorized} of {stats.totalReceipts}</div>
        </div>
      </div>

      {/* Budget Status */}
      {budgetStatus.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-8 border border-transparent dark:border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">💰 Budget Status</h2>
            <Link href="/dashboard/budget-settings" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
              Manage →
            </Link>
          </div>
          <div className="space-y-4">
            {budgetStatus.map((budget) => (
              <div key={budget.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{budget.category}</span>
                  <span className={`font-semibold ${budget.percentage > 100 ? "text-red-600 dark:text-red-400" : budget.percentage > 80 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    ${(budget.spent_cents / 100).toFixed(2)} / ${(budget.budget_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${budget.percentage > 100 ? "bg-red-500" : budget.percentage > 80 ? "bg-orange-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Reports */}
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📊 My Monthly Reports</h2>
          {clientId && (
            <Link
              href={`/dashboard/reports/clients/${clientId}`}
              className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
            >
              View All →
            </Link>
          )}
        </div>
        {recentReports.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No reports yet — reports are generated automatically at the end of each month.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {recentReports.map((report) => (
              <Link
                key={report.id}
                href={`/dashboard/reports/clients/${clientId}`}
                className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{formatMonth(report.report_month)}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {report.total_receipts} receipt{report.total_receipts !== 1 ? 's' : ''} •{' '}
                    ${(report.total_tax_cents / 100).toFixed(2)} in tax
                  </div>
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${(report.total_spend_cents / 100).toFixed(2)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Receipts */}
      {recentReceipts.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📁 Recent Receipts</h2>
            <Link href="/dashboard/receipts" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {recentReceipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/dashboard/receipts/${receipt.id}`}
                className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {receipt.vendor || "Unknown vendor"}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {receipt.receipt_date
                      ? new Date(receipt.receipt_date).toLocaleDateString()
                      : new Date(receipt.created_at).toLocaleDateString()}
                    {receipt.approved_category && (
                      <span className="ml-2 text-green-600 dark:text-green-400">• {receipt.approved_category}</span>
                    )}
                  </div>
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${(receipt.total_cents / 100).toFixed(2)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.totalReceipts === 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-12 text-center border border-transparent dark:border-dark-border">
          <div className="text-gray-400 dark:text-gray-500 text-5xl mb-4">📸</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No receipts yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Get started by uploading your first receipt above, or forward receipt emails to your inbox.
          </p>
        </div>
      )}
    </div>
  );
}// force rebuild Sat Mar 28 01:18:07 EDT 2026
