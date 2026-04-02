"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import Link from "next/link";
import UsageStats from "@/components/UsageStats";
import { convertHeicToJpg } from "@/lib/convertHeicClient";
import ClientSelector from "@/components/ClientSelector";
import { useClientContext } from "@/lib/ClientContext";

type UploadProgress = {
  total: number;
  current: number;
  currentFile: string;
  succeeded: number;
  failed: number;
};

type RecentActivity = {
  id: string;
  vendor: string;
  total_cents: number;
  created_at: string;
};

export default function DashboardHomePage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    thisMonth: 0,
    pendingReview: 0,
    categorized: 0,
    flagged: 0,
    emailsReceived: 0,
    emailsPending: 0,
    emailsApproved: 0,
    totalClients: 0,
    assignedClients: 0,
    totalAccountants: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

const { selectedClient, isFiltered } = useClientContext();
const [selectedAccountantId, setSelectedAccountantId] = useState<string | null>(null);
const [accountants, setAccountants] = useState<{ id: string; display_name: string | null; auth_user_id: string }[]>([]);

  useEffect(() => {
    loadRole();
  }, []);

  // Reload stats when selected client changes
  useEffect(() => {
    if (userRole) loadStats(userRole);
  }, [selectedClient]);

async function loadRole() {
  const role = await getUserRole();
  setUserRole(role);
  loadStats(role);
  updateLastSeen();
  if (role === "firm_admin" || role === "owner") {
    loadAccountants();
  }
}

async function loadAccountants() {
  try {
    const firmId = await getMyFirmId();
    const { data } = await supabase
      .from("firm_users")
      .select("id, display_name, auth_user_id")
      .eq("firm_id", firmId)
      .eq("role", "accountant");
    setAccountants(data || []);
  } catch (err) {
    console.error("Failed to load accountants:", err);
  }
}

  async function updateLastSeen() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const firmId = await getMyFirmId();
      await supabase
        .from("firm_users")
        .update({ last_seen: new Date().toISOString() })
        .eq("firm_id", firmId)
        .eq("auth_user_id", user.id);
    } catch (error) {
      console.error("Failed to update last_seen:", error);
    }
  }

  async function loadStats(role: string | null) {
    try {
      const firmId = await getMyFirmId();

      // If accountant has selected a specific client, scope all queries to that client
      const clientFilter = isFiltered && selectedClient ? selectedClient.id : null;

      // For client role, get their own client_id
      let ownClientId: string | null = null;
      if (role === "client") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: firmUser } = await supabase
            .from("firm_users")
            .select("client_id")
            .eq("auth_user_id", user.id)
            .single();
          ownClientId = firmUser?.client_id ?? null;
        }
      }

      const effectiveClientId = ownClientId || clientFilter;

      // Total receipts
      let totalQ = supabase.from("receipts").select("*", { count: "exact", head: true }).eq("firm_id", firmId);
      if (effectiveClientId) totalQ = totalQ.eq("client_id", effectiveClientId);
      const { count: total } = await totalQ;

      // This month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      let monthQ = supabase.from("receipts").select("*", { count: "exact", head: true }).eq("firm_id", firmId).gte("created_at", startOfMonth.toISOString());
      if (effectiveClientId) monthQ = monthQ.eq("client_id", effectiveClientId);
      const { count: thisMonth } = await monthQ;

      // Pending review
      let pendingQ = supabase.from("receipts").select("*", { count: "exact", head: true }).eq("firm_id", firmId).eq("status", "needs_review");
      if (effectiveClientId) pendingQ = pendingQ.eq("client_id", effectiveClientId);
      const { count: pending } = await pendingQ;

      // Categorized
      let catQ = supabase.from("receipts").select("*", { count: "exact", head: true }).eq("firm_id", firmId).not("approved_category", "is", null);
      if (effectiveClientId) catQ = catQ.eq("client_id", effectiveClientId);
      const { count: categorized } = await catQ;

      // Flagged
      const { data: flags } = await supabase.from("receipt_flags").select("receipt_id").eq("firm_id", firmId).is("resolved_at", null);
      let flaggedCount = 0;
      if (effectiveClientId && flags) {
        const { data: clientReceipts } = await supabase.from("receipts").select("id").eq("firm_id", firmId).eq("client_id", effectiveClientId);
        const clientReceiptIds = new Set(clientReceipts?.map(r => r.id) || []);
        flaggedCount = flags.filter(f => clientReceiptIds.has(f.receipt_id)).length;
      } else {
        flaggedCount = new Set(flags?.map(f => f.receipt_id) || []).size;
      }

      // Email stats
      let emailStats = { received: 0, pending: 0, approved: 0 };
      if (role === "firm_admin" || role === "owner" || role === "accountant") {
        const { data: emails } = await supabase.from("email_receipts").select("status").eq("firm_id", firmId);
        emailStats = {
          received: emails?.length || 0,
          pending: emails?.filter(e => e.status === "pending").length || 0,
          approved: emails?.filter(e => e.status === "approved").length || 0,
        };
      }

      // Client/accountant counts (firm admin only, not filtered by client)
      let clientStats = { total: 0, assigned: 0 };
      let accountantCount = 0;
      if ((role === "firm_admin" || role === "owner") && !clientFilter) {
        const { count: totalClients } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("firm_id", firmId);
        const { count: assignedClients } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("firm_id", firmId).not("assigned_accountant_id", "is", null);
        const { count: accountants } = await supabase.from("firm_users").select("*", { count: "exact", head: true }).eq("firm_id", firmId).eq("role", "accountant");
        clientStats = { total: totalClients || 0, assigned: assignedClients || 0 };
        accountantCount = accountants || 0;
      }

      // Recent activity
      if (role === "firm_admin" || role === "owner" || role === "accountant") {
        let recentQ = supabase.from("receipts").select("id, vendor, total_cents, created_at").eq("firm_id", firmId).order("created_at", { ascending: false }).limit(5);
        if (effectiveClientId) recentQ = recentQ.eq("client_id", effectiveClientId);
        const { data: recentReceipts } = await recentQ;
        setRecentActivity((recentReceipts as RecentActivity[]) || []);
      }

      setStats({
        totalReceipts: total || 0,
        thisMonth: thisMonth || 0,
        pendingReview: pending || 0,
        categorized: categorized || 0,
        flagged: flaggedCount,
        emailsReceived: emailStats.received,
        emailsPending: emailStats.pending,
        emailsApproved: emailStats.approved,
        totalClients: clientStats.total,
        assignedClients: clientStats.assigned,
        totalAccountants: accountantCount,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

async function handleMultipleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    try {
      setUploading(true);
      setUploadProgress({ total: fileArray.length, current: 0, currentFile: fileArray[0]?.name || "", succeeded: 0, failed: 0 });

      const firmId = await getMyFirmId();

      const { data: clients } = await supabase.from("clients").select("id, name").eq("firm_id", firmId).limit(1);
      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const client = selectedClient ? { id: selectedClient.id, name: selectedClient.name } : clients[0];
      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress({ total: fileArray.length, current: i + 1, currentFile: file.name, succeeded, failed });

        try {
          let uploadFile = file;
          try { uploadFile = await convertHeicToJpg(file); } catch { uploadFile = file; }
          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("firmId", firmId);
          formData.append("clientId", client.id);
          if (userId) formData.append("userId", userId);
          const response = await fetch("/api/upload-receipt", { method: "POST", body: formData });
          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
          succeeded++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failed++;
        }
      }

      if (failed === 0) alert(`✅ All ${succeeded} receipts uploaded successfully!`);
      else if (succeeded === 0) alert(`❌ Failed to upload all ${failed} receipts. Please try again.`);
      else alert(`⚠️ Uploaded ${succeeded} receipts successfully. ${failed} failed.`);

      loadStats(userRole);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      alert("Upload process failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }


  const isClient = userRole === "client";
  const isAccountant = userRole === "accountant";
  const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";

// Redirect clients to their dedicated dashboard
if (userRole === 'client') {
  window.location.href = '/dashboard/client';
  return <div className="p-8"><p className="text-gray-500 dark:text-gray-400">Loading...</p></div>;
}

  const completionRate = stats.totalReceipts > 0
    ? Math.round((stats.categorized / stats.totalReceipts) * 100)
    : 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isFirmAdmin ? "Firm Overview" : isClient ? "My Dashboard" : "Dashboard"}
        </h1>
        {isFiltered && selectedClient && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700 rounded-lg">
            <span className="text-sm text-accent-700 dark:text-accent-300 font-medium">
              Viewing: {selectedClient.name}
            </span>
          </div>
        )}
      </div>

{/* Accountant Selector — firm admins only */}
{isFirmAdmin && accountants.length > 0 && (
  <div className="mb-4 flex items-center gap-3">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
      👤 Accountant:
    </label>
    <select
      value={selectedAccountantId || ""}
      onChange={(e) => setSelectedAccountantId(e.target.value || null)}
      className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
    >
      <option value="">All Accountants</option>
      {accountants.map(acc => (
        <option key={acc.id} value={acc.id}>
          {acc.display_name || acc.auth_user_id}
        </option>
      ))}
    </select>
    {selectedAccountantId && (
      <button
        onClick={() => setSelectedAccountantId(null)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
      >
        Clear
      </button>
    )}
  </div>
)}

{/* Client Selector — accountants and firm admins only */}
{(isFirmAdmin || isAccountant) && (
  <ClientSelector accountantFilter={selectedAccountantId} />
)}

      {/* Firm Admin Comprehensive Overview */}
      {isFirmAdmin ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Receipts</div>
                <div className="text-2xl">📄</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
              {isFiltered && <div className="text-xs text-accent-600 dark:text-accent-400 mt-1">{selectedClient?.name}</div>}
            </Link>

            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Categorized</div>
                <div className="text-2xl">✅</div>
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{completionRate}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.categorized} of {stats.totalReceipts}</div>
            </div>

            <Link href="/dashboard/receipts?status=needs_review" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Needs Review</div>
                <div className="text-2xl">👀</div>
              </div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingReview}</div>
            </Link>

            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Flagged Issues</div>
                <div className="text-2xl">⚠️</div>
              </div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.flagged}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Email Stats — only show when not filtered to a single client */}
            {!isFiltered && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📧 Email Processing</h3>
                  <Link href="/dashboard/email-inbox" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">View →</Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Received</span><span className="font-semibold text-gray-900 dark:text-white">{stats.emailsReceived}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Pending</span><span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.emailsPending}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Approved</span><span className="font-semibold text-green-600 dark:text-green-400">{stats.emailsApproved}</span></div>
                </div>
              </div>
            )}

            {/* Team — only show when not filtered */}
            {!isFiltered && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">👥 Team</h3>
                  <Link href="/dashboard/clients" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">Manage →</Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Accountants</span><span className="font-semibold text-gray-900 dark:text-white">{stats.totalAccountants}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Total Clients</span><span className="font-semibold text-gray-900 dark:text-white">{stats.totalClients}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Assigned</span><span className="font-semibold text-green-600 dark:text-green-400">{stats.assignedClients}</span></div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📈 Recent Uploads</h3>
                <Link href="/dashboard/receipts" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">All →</Link>
              </div>
              <div className="space-y-2">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 3).map((receipt) => (
                    <div key={receipt.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 truncate mr-2">{receipt.vendor || "Unknown"}</span>
                      <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">${(receipt.total_cents / 100).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href="/dashboard/firm-admin" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <span className="text-2xl">📊</span>
                <div><div className="font-medium text-gray-900 dark:text-white">Detailed Analytics</div><div className="text-sm text-gray-500 dark:text-gray-400">Deep dive reports</div></div>
              </Link>
              <Link href="/dashboard/flags" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <span className="text-2xl">🚩</span>
                <div><div className="font-medium text-gray-900 dark:text-white">View All Flags</div><div className="text-sm text-gray-500 dark:text-gray-400">Unresolved issues</div></div>
              </Link>
              <Link href="/dashboard/reports" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <span className="text-2xl">📊</span>
                <div><div className="font-medium text-gray-900 dark:text-white">Export Reports</div><div className="text-sm text-gray-500 dark:text-gray-400">Generate CSV/PDF</div></div>
              </Link>
              <Link href="/dashboard/clients" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <span className="text-2xl">➕</span>
                <div><div className="font-medium text-gray-900 dark:text-white">Add New Client</div><div className="text-sm text-gray-500 dark:text-gray-400">Quick setup</div></div>
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Client/Accountant Dashboard */}
          <div className="bg-gradient-to-br from-accent-600 to-accent-800 dark:from-accent-500 dark:to-accent-700 rounded-xl p-6 mb-8 text-white shadow-lg">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold mb-2">Upload Receipts</h2>
              <p className="text-accent-50 mb-6">Select one or multiple receipts to upload. Our AI will extract all the details automatically.</p>
              <label htmlFor="hero-upload" className={`block border-2 border-dashed border-accent-200 dark:border-accent-300 rounded-xl p-6 text-center cursor-pointer hover:border-white hover:bg-white/10 transition-all ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                <input type="file" id="hero-upload" accept="image/*,application/pdf,.heic,.heif" multiple className="hidden" disabled={uploading} onChange={(e) => handleMultipleFiles(e.target.files)} />
                {uploading && uploadProgress ? (
                  <div className="space-y-3">
                    <div className="text-4xl mb-3">⏳</div>
                    <div className="text-lg font-semibold">Uploading {uploadProgress.current} of {uploadProgress.total}</div>
                    <div className="text-sm text-accent-100">{uploadProgress.currentFile}</div>
                    <div className="w-full bg-accent-700 rounded-full h-2 mt-3">
                      <div className="bg-white h-2 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                    </div>
                    <div className="text-xs text-accent-100 mt-2">✅ {uploadProgress.succeeded} succeeded • ❌ {uploadProgress.failed} failed</div>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{isClient ? "My Receipts" : "Total Receipts"}</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
            </Link>
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">This Month</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</div>
            </div>
            <Link href="/dashboard/receipts?status=needs_review" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Needs Review</div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingReview}</div>
            </Link>
            <UsageStats key={refreshKey} />
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/dashboard/receipts" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <span className="text-2xl">📁</span>
                <div><div className="font-medium text-gray-900 dark:text-white">{isClient ? "My Receipts" : "All Receipts"}</div><div className="text-sm text-gray-500 dark:text-gray-400">{isClient ? "View and manage" : "Manage and categorize"}</div></div>
              </Link>
              {isAccountant && (
                <>
                  <Link href="/dashboard/email-inbox" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                    <span className="text-2xl">📧</span>
                    <div><div className="font-medium text-gray-900 dark:text-white">Email Inbox</div><div className="text-sm text-gray-500 dark:text-gray-400">Review emailed receipts</div></div>
                  </Link>
                  <Link href="/dashboard/category-dashboard" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                    <span className="text-2xl">📊</span>
                    <div><div className="font-medium text-gray-900 dark:text-white">Categories</div><div className="text-sm text-gray-500 dark:text-gray-400">View by expense type</div></div>
                  </Link>
                  <Link href="/dashboard/tax-codes" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                    <span className="text-2xl">🧾</span>
                    <div><div className="font-medium text-gray-900 dark:text-white">Tax Codes</div><div className="text-sm text-gray-500 dark:text-gray-400">T2125 summary</div></div>
                  </Link>
                </>
              )}
              {isClient && (
                <Link href="/dashboard/budget-settings" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <span className="text-2xl">💰</span>
                  <div><div className="font-medium text-gray-900 dark:text-white">My Budget</div><div className="text-sm text-gray-500 dark:text-gray-400">Set spending limits</div></div>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}