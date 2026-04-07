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

type RecentEdit = {
  id: string;
  edit_reason: string;
  changes: Record<string, { before: string; after: string }>;
  created_at: string;
  receipt_id: string;
  receipts: { vendor: string | null } | null;
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
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>([]);

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
        await loadRecentEdits(firmUser.client_id, firmId);
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

  async function loadRecentEdits(clientId: string, firmId: string) {
    const { data } = await supabase
      .from("receipt_edits")
      .select("id, edit_reason, changes, created_at, receipt_id, receipts(vendor)")
      .eq("firm_id", firmId)
      .order("created_at", { ascending: false })
      .limit(3);
    const filtered = ((data || []) as unknown as RecentEdit[]).filter(e => e.receipts !== null);
    setRecentEdits(filtered);
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
      setUploadProgress({ total: fileArray.length, current: 0, currentFile: fileArray[0]?.name || "", succeeded: 0, failed: 0 });

      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      let succeeded = 0;
      let failed = 0;
      const batchId = fileArray.length > 1 ? `batch_${Date.now()}` : undefined;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress({ total: fileArray.length, current: i + 1, currentFile: file.name, succeeded, failed });

        try {
          let uploadFile = file;
          try { uploadFile = await convertHeicToJpg(file); } catch { uploadFile = file; }

          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("firmId", firmId);
          formData.append("clientId", clientId);
          if (userId) formData.append("userId", userId);
          if (batchId) formData.append("batchId", batchId);
          formData.append("batchIndex", String(i + 1));
          formData.append("batchTotal", String(fileArray.length));

          const response = await fetch("/api/upload-receipt", { method: "POST", body: formData });
          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
          succeeded++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failed++;
        }
      }

      if (failed === 0) alert(`✅ All ${succeeded} receipts uploaded!`);
      else if (succeeded === 0) alert(`❌ All ${failed} uploads failed. Please try again.`);
      else alert(`⚠️ ${succeeded} uploaded, ${failed} failed.`);

      const fid = await getMyFirmId();
      await loadStats(clientId, fid);
      await loadRecentReceipts(clientId);
      await loadBudgetStatus(clientId, fid);
      setUsageRefreshKey(prev => prev + 1);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const completionRate = stats.totalReceipts > 0
    ? Math.round((stats.categorized / stats.totalReceipts) * 100) : 0;

  function formatMonth(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
  }

  return (
<div className="w-full max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-24">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hi, {clientName.split(" ")[0]}! 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your receipts and expenses
        </p>
      </div>

      {/* Upload Hero */}
      <label
        htmlFor="hero-upload"
        className={`block w-full rounded-2xl overflow-hidden mb-6 ${uploading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
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
        <div className="bg-gradient-to-br from-accent-500 to-accent-700 p-6 text-white text-center">
          {uploading && uploadProgress ? (
            <div className="space-y-3">
              <div className="text-4xl">⏳</div>
              <div className="text-lg font-bold">Uploading {uploadProgress.current} of {uploadProgress.total}</div>
              <div className="text-sm text-accent-100 truncate">{uploadProgress.currentFile}</div>
              <div className="w-full bg-accent-700 rounded-full h-2">
                <div className="bg-white h-2 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
              </div>
              <div className="text-xs text-accent-100">✅ {uploadProgress.succeeded} done • ❌ {uploadProgress.failed} failed</div>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-3">📸</div>
              <div className="text-xl font-bold mb-1">Upload Receipt</div>
              <div className="text-sm text-accent-100 mb-4">Tap to take a photo or choose from your library</div>
              <div className="inline-block bg-white text-accent-700 font-semibold px-6 py-2.5 rounded-xl text-sm">
                Choose Files
              </div>
            </>
          )}
        </div>
      </label>

      {/* Quick Stats */}
<div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6 mb-6">
          <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-dark-border active:scale-95 transition-transform">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total</div>
        </Link>
        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This Month</div>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completionRate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Categorized</div>
        </div>
      </div>

      {/* Quick Actions */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
          <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-dark-border active:scale-95 transition-transform">
          <span className="text-2xl">📁</span>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">My Receipts</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">View all</div>
          </div>
        </Link>
        <Link href="/dashboard/budget-settings" className="bg-white dark:bg-dark-surface rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-dark-border active:scale-95 transition-transform">
          <span className="text-2xl">💰</span>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">My Budget</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Set limits</div>
          </div>
        </Link>
        <Link href="/dashboard/conversations" className="bg-white dark:bg-dark-surface rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-dark-border active:scale-95 transition-transform">
          <span className="text-2xl">💬</span>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Messages</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Chat with accountant</div>
          </div>
        </Link>
        <Link href="/dashboard/settings" className="bg-white dark:bg-dark-surface rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-dark-border active:scale-95 transition-transform">
          <span className="text-2xl">⚙️</span>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Settings</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Preferences</div>
          </div>
        </Link>
      </div>

      {/* Budget Status */}
      {budgetStatus.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-100 dark:border-dark-border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">💰 Budget This Month</h2>
            <Link href="/dashboard/budget-settings" className="text-xs text-accent-600 dark:text-accent-400">Manage →</Link>
          </div>
          <div className="space-y-3">
            {budgetStatus.map((budget) => (
              <div key={budget.category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate mr-2">{budget.category}</span>
                  <span className={`font-semibold whitespace-nowrap ${budget.percentage > 100 ? "text-red-600" : budget.percentage > 80 ? "text-orange-600" : "text-green-600"}`}>
                    ${(budget.spent_cents / 100).toFixed(0)} / ${(budget.budget_cents / 100).toFixed(0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${budget.percentage > 100 ? "bg-red-500" : budget.percentage > 80 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Receipts */}
      {recentReceipts.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">📄 Recent Receipts</h2>
            <Link href="/dashboard/receipts" className="text-xs text-accent-600 dark:text-accent-400">View All →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {recentReceipts.map((receipt) => (
              <Link key={receipt.id} href={`/dashboard/receipts/${receipt.id}`} className="px-4 py-3 flex items-center justify-between active:bg-gray-50 dark:active:bg-dark-hover">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{receipt.vendor || "Unknown vendor"}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString() : new Date(receipt.created_at).toLocaleDateString()}
                    {receipt.approved_category && <span className="ml-1 text-green-600 dark:text-green-400">• {receipt.approved_category}</span>}
                  </div>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white ml-3 whitespace-nowrap">${(receipt.total_cents / 100).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Reports */}
      {recentReports.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">📊 Monthly Reports</h2>
            {clientId && <Link href={`/dashboard/reports/clients/${clientId}`} className="text-xs text-accent-600 dark:text-accent-400">View All →</Link>}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {recentReports.map((report) => (
              <Link key={report.id} href={`/dashboard/reports/clients/${clientId}`} className="px-4 py-3 flex items-center justify-between active:bg-gray-50 dark:active:bg-dark-hover">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{formatMonth(report.report_month)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{report.total_receipts} receipts • ${(report.total_tax_cents / 100).toFixed(2)} tax</div>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">${(report.total_spend_cents / 100).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Edits */}
      {recentEdits.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">✏️ Recent Edits</h2>
            <Link href="/dashboard/reports/edits" className="text-xs text-accent-600 dark:text-accent-400">View All →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {recentEdits.map((edit) => (
              <Link key={edit.id} href={`/dashboard/receipts/${edit.receipt_id}`} className="px-4 py-3 block active:bg-gray-50 dark:active:bg-dark-hover">
                <div className="flex items-start justify-between mb-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{edit.receipts?.vendor || "Unknown vendor"}</div>
                  <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">{new Date(edit.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{edit.edit_reason}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Email Inbox */}
      {clientEmail && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-xl">📧</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Receipt Email Inbox</h3>
              <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">Forward receipts to this address:</p>
              <div className="bg-white dark:bg-dark-surface border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 font-mono text-xs text-gray-900 dark:text-white truncate">{clientEmail}</div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="mb-6">
        <UsageStats key={usageRefreshKey} />
      </div>

      {/* Empty State */}
      {stats.totalReceipts === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📸</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No receipts yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tap the upload button above to add your first receipt.</p>
        </div>
      )}
    </div>
  );
}