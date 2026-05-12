"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { getMyAccountType } from "@/lib/getMyAccountType";
import Link from "next/link";
import ClientSelector from "@/components/ClientSelector";
import { useClientContext } from "@/lib/ClientContext";
import { getAssignedClientIds } from "@/lib/getAssignedClients";
import UploadOnBehalfModal from "@/components/UploadOnBehalfModal";
import DailyCheckinAdminPanel from "@/components/DailyCheckinAdminPanel";
import DailyCheckinDashboardCard from "@/components/DailyCheckinDashboardCard";
import {
  Receipt as ReceiptIcon,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Mail,
  Users,
  TrendingUp,
  BarChart3,
  Flag,
  Plus,
  Upload,
  User,
} from "lucide-react";

type RecentActivity = {
  id: string;
  vendor: string;
  total_cents: number;
  created_at: string;
};

export default function DashboardHomePage() {
  const router = useRouter();
  // Single-shot guard for the personal/client redirect. Without this,
  // a transient re-mount of the dashboard page (e.g. when the layout
  // re-runs an effect) could fire the redirect a second time and bounce
  // the user, which in combination with route-driven tours used to
  // produce an infinite navigation loop.
  const didRedirectRef = useRef(false);
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
  const [showUploadOnBehalf, setShowUploadOnBehalf] = useState(false);

const { selectedClient, isFiltered } = useClientContext();
const [selectedAccountantId, setSelectedAccountantId] = useState<string | null>(null);
const [accountants, setAccountants] = useState<{ id: string; display_name: string | null; auth_user_id: string }[]>([]);

  useEffect(() => {
    loadRole();
  }, []);

// Reload stats when selected client or accountant changes
  useEffect(() => {
    if (userRole) loadStats(userRole);
  }, [selectedClient, selectedAccountantId]);

async function loadRole() {
  const role = await getUserRole();
  // Personal accounts get the firm_admin role on their one-person firm,
  // which would land them on the firm-overview view by default. That
  // page is overloaded with firm-only chrome (All Clients picker, Team
  // & Accountants, Detailed Analytics) — so we route them to the client
  // dashboard, which is the cleaner single-user surface.
  //
  // Use router.replace (Next.js client-side nav, no full reload) and
  // guard with a ref so the redirect can only fire once. The previous
  // version used window.location.href, which combined with route-driven
  // sidebar tours produced an infinite navigation loop on personal
  // accounts.
  const accountType = await getMyAccountType();
  if (accountType === "personal" && role !== "client" && !didRedirectRef.current) {
    didRedirectRef.current = true;
    router.replace("/dashboard/client");
    return;
  }
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
      
      // If firm admin selected a specific accountant, get their assigned clients
      let accountantClientIds: string[] | null = null;
      if (selectedAccountantId && (role === "firm_admin" || role === "owner")) {
        const { data: assignedClients } = await supabase
          .from("clients")
          .select("id")
          .eq("firm_id", firmId)
          .eq("assigned_accountant_id", selectedAccountantId);
        accountantClientIds = assignedClients?.map(c => c.id) || [];
      }

      // Accountant role: scope every stat to the clients assigned to THIS
      // accountant. Without this, an accountant would see firm-wide totals
      // including their colleagues' clients — privacy bug. Only applies
      // when the user hasn't already drilled into a specific client.
      if (role === "accountant" && !clientFilter) {
        const ids = await getAssignedClientIds(firmId);
        if (ids !== null) accountantClientIds = ids;
      }

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

      // Apply the standard scope (firm + optional client / accountant scope)
      // to a base count query. Centralising this avoids drift across the 4
      // identical branches we used to have.
      const scopeReceipts = (q: any) => {
        q = q.eq("firm_id", firmId);
        if (effectiveClientId) q = q.eq("client_id", effectiveClientId);
        else if (accountantClientIds)
          q = q.in("client_id", accountantClientIds.length > 0 ? accountantClientIds : ["none"]);
        return q;
      };

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const isFirm = role === "firm_admin" || role === "owner";
      const isAccountantOrFirm = isFirm || role === "accountant";

      // ── PARALLEL BATCH 1: receipt + flag counts ─────────────────────────
      // These are all independent of each other and the firm-level counts
      // below. Running them sequentially used to add ~2-4 seconds; doing
      // them in parallel cuts dashboard load to a single round trip.
      const [
        totalRes,
        monthRes,
        pendingRes,
        catRes,
        flagsRes,
        clientReceiptsRes,
        emailReceivedRes,
        emailPendingRes,
        emailApprovedRes,
        totalClientsRes,
        assignedClientsRes,
        accountantsRes,
        recentRes,
      ] = await Promise.all([
        scopeReceipts(supabase.from("receipts").select("*", { count: "exact", head: true })),
        scopeReceipts(
          supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .gte("created_at", startOfMonth.toISOString())
        ),
        scopeReceipts(
          supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("status", "needs_review")
        ),
        scopeReceipts(
          supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .not("approved_category", "is", null)
        ),
        supabase
          .from("receipt_flags")
          .select("receipt_id")
          .eq("firm_id", firmId)
          .is("resolved_at", null),
        // Only used when filtering flags by a specific client.
        effectiveClientId
          ? supabase.from("receipts").select("id").eq("firm_id", firmId).eq("client_id", effectiveClientId)
          : Promise.resolve({ data: null }),
        // Email counts use head:true so we don't pull every row to count.
        isAccountantOrFirm
          ? supabase.from("email_receipts").select("*", { count: "exact", head: true }).eq("firm_id", firmId)
          : Promise.resolve({ count: 0 }),
        isAccountantOrFirm
          ? supabase
              .from("email_receipts")
              .select("*", { count: "exact", head: true })
              .eq("firm_id", firmId)
              .eq("status", "pending")
          : Promise.resolve({ count: 0 }),
        isAccountantOrFirm
          ? supabase
              .from("email_receipts")
              .select("*", { count: "exact", head: true })
              .eq("firm_id", firmId)
              .eq("status", "approved")
          : Promise.resolve({ count: 0 }),
        isFirm && !clientFilter
          ? supabase.from("clients").select("*", { count: "exact", head: true }).eq("firm_id", firmId)
          : Promise.resolve({ count: 0 }),
        isFirm && !clientFilter
          ? supabase
              .from("clients")
              .select("*", { count: "exact", head: true })
              .eq("firm_id", firmId)
              .not("assigned_accountant_id", "is", null)
          : Promise.resolve({ count: 0 }),
        isFirm && !clientFilter
          ? supabase
              .from("firm_users")
              .select("*", { count: "exact", head: true })
              .eq("firm_id", firmId)
              .eq("role", "accountant")
          : Promise.resolve({ count: 0 }),
        isAccountantOrFirm
          ? scopeReceipts(
              supabase
                .from("receipts")
                .select("id, vendor, total_cents, created_at")
                .order("created_at", { ascending: false })
                .limit(5)
            )
          : Promise.resolve({ data: null }),
      ]);

      const total = totalRes.count;
      const thisMonth = monthRes.count;
      const pending = pendingRes.count;
      const categorized = catRes.count;
      const flags = (flagsRes as { data: { receipt_id: string }[] | null }).data;

      // Flagged count
      let flaggedCount = 0;
      if (effectiveClientId && flags) {
        const clientReceiptIds = new Set(
          ((clientReceiptsRes as { data: { id: string }[] | null }).data || []).map((r) => r.id)
        );
        flaggedCount = flags.filter((f) => clientReceiptIds.has(f.receipt_id)).length;
      } else {
        flaggedCount = new Set(flags?.map((f) => f.receipt_id) || []).size;
      }

      // Email stats from the three independent count queries above.
      const emailStats = {
        received: (emailReceivedRes as { count: number | null }).count || 0,
        pending: (emailPendingRes as { count: number | null }).count || 0,
        approved: (emailApprovedRes as { count: number | null }).count || 0,
      };

      // Client/accountant counts.
      let clientStats = { total: 0, assigned: 0 };
      let accountantCount = 0;
      if (isFirm && !clientFilter) {
        clientStats = {
          total: (totalClientsRes as { count: number | null }).count || 0,
          assigned: (assignedClientsRes as { count: number | null }).count || 0,
        };
        accountantCount = (accountantsRes as { count: number | null }).count || 0;
      } else if (role === "accountant" && !clientFilter && accountantClientIds) {
        // Accountants see how many clients are assigned to them rather
        // than firm-wide totals.
        clientStats = { total: accountantClientIds.length, assigned: accountantClientIds.length };
      }

      // Recent activity
      if (isAccountantOrFirm) {
        const recentReceipts = (recentRes as { data: RecentActivity[] | null }).data;
        setRecentActivity(recentReceipts || []);
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

  // handleMultipleFiles was used by the now-removed client-style upload
  // hero. Firm admins / owners don't upload receipts directly; accountants
  // upload via the UploadOnBehalfModal opened from this page or the
  // Receipts list.

  const isClient = userRole === "client";
  const isAccountant = userRole === "accountant";
  const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";

// Wait until we know the user's role before rendering. Without this
// guard, the page briefly renders the client-style fallback branch
// (with upload hero + Plan Usage card) for every user — including
// firm admins — until userRole resolves. The flash made firm admins
// think they had upload ability and that the page was "the client view".
if (!userRole) {
  return <div className="p-8"><p className="text-gray-500 dark:text-gray-400">Loading...</p></div>;
}

// Clients have their own dashboard route. Same router.replace + ref
// guard pattern as the personal-account redirect above — never use
// window.location.href here, it caused the infinite-loop bug.
if (userRole === 'client') {
  if (!didRedirectRef.current) {
    didRedirectRef.current = true;
    router.replace('/dashboard/client');
  }
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
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap flex items-center gap-1.5">
      <User className="w-4 h-4" /> Accountant:
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

      {/* Firm Admin + Accountant Comprehensive Overview.
          Accountants get the same rich layout as firm_admin but scoped to
          their assigned clients (loadStats handles the scoping). Inner
          firm-admin-only sub-elements are gated separately on isFirmAdmin. */}
      {(isFirmAdmin || isAccountant) ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Link href="/dashboard/receipts" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Receipts</div>
                <ReceiptIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
              {isFiltered && <div className="text-xs text-accent-600 dark:text-accent-400 mt-1">{selectedClient?.name}</div>}
            </Link>

            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Categorized</div>
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{completionRate}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.categorized} of {stats.totalReceipts}</div>
            </div>

            <Link href="/dashboard/receipts?status=needs_review" className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md dark:hover:bg-dark-hover transition-all border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Needs Review</div>
                <Eye className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingReview}</div>
            </Link>

            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Flagged Issues</div>
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.flagged}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Email Stats — only show when not filtered to a single client */}
            {!isFiltered && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Mail className="w-5 h-5" /> Email Processing
                  </h3>
                  <Link href="/dashboard/email-inbox" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">View →</Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Received</span><span className="font-semibold text-gray-900 dark:text-white">{stats.emailsReceived}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Pending</span><span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.emailsPending}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Approved</span><span className="font-semibold text-green-600 dark:text-green-400">{stats.emailsApproved}</span></div>
                </div>
              </div>
            )}

            {/* Team — firm admin only when not filtered */}
            {!isFiltered && isFirmAdmin && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5" /> Team
                  </h3>
                  <Link href="/dashboard/clients" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">Manage →</Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Accountants</span><span className="font-semibold text-gray-900 dark:text-white">{stats.totalAccountants}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Total Clients</span><span className="font-semibold text-gray-900 dark:text-white">{stats.totalClients}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Assigned</span><span className="font-semibold text-green-600 dark:text-green-400">{stats.assignedClients}</span></div>
                </div>
              </div>
            )}

            {/* My Clients — accountants only when not filtered */}
            {!isFiltered && isAccountant && (
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5" /> My Clients
                  </h3>
                  <Link href="/dashboard/clients" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">View →</Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">Assigned to me</span><span className="font-semibold text-gray-900 dark:text-white">{stats.assignedClients}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Stats above are scoped to your assigned clients only.</div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Recent Uploads
                </h3>
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

          {/* Daily check-in admin panel — firm_admin / owner only. Lists
              every accountant's status today and a rolling-window
              leaderboard of receipts categorized. */}
          {isFirmAdmin && (
            <div className="mb-6">
              <DailyCheckinAdminPanel />
            </div>
          )}

          {/* Daily check-in launcher — accountants only. The card swaps
              between idle / completed states + offers a per-client filter
              and a "Still want more?" button after completion. */}
          {isAccountant && (
            <div className="mb-6">
              <DailyCheckinDashboardCard />
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {isFirmAdmin && (
                <Link href="/dashboard/firm-admin" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <BarChart3 className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div><div className="font-medium text-gray-900 dark:text-white">Detailed Analytics</div><div className="text-sm text-gray-500 dark:text-gray-400">Deep dive reports</div></div>
                </Link>
              )}
              <Link href="/dashboard/flags" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <Flag className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div><div className="font-medium text-gray-900 dark:text-white">View All Flags</div><div className="text-sm text-gray-500 dark:text-gray-400">Unresolved issues</div></div>
              </Link>
              <Link href="/dashboard/reports" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <TrendingUp className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div><div className="font-medium text-gray-900 dark:text-white">Export Reports</div><div className="text-sm text-gray-500 dark:text-gray-400">Generate CSV/PDF</div></div>
              </Link>
              {isFirmAdmin && (
                <Link href="/dashboard/clients" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <Plus className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div><div className="font-medium text-gray-900 dark:text-white">Add New Client</div><div className="text-sm text-gray-500 dark:text-gray-400">Quick setup</div></div>
                </Link>
              )}
              {isAccountant && (
                <Link href="/dashboard/email-inbox" className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <Mail className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div><div className="font-medium text-gray-900 dark:text-white">Email Inbox</div><div className="text-sm text-gray-500 dark:text-gray-400">Review forwarded receipts</div></div>
                </Link>
              )}
              {isAccountant && (
                <button
                  onClick={() => setShowUploadOnBehalf(true)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-left"
                >
                  <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div><div className="font-medium text-gray-900 dark:text-white">Upload for Client</div><div className="text-sm text-gray-500 dark:text-gray-400">Submit on their behalf</div></div>
                </button>
              )}
            </div>
          </div>
        </>
      ) : null /* clients are redirected to /dashboard/client above; the
                  comprehensive view above covers firm_admin / owner /
                  accountant. There's no third state to render. */}

      {showUploadOnBehalf && (
        <UploadOnBehalfModal
          onClose={() => setShowUploadOnBehalf(false)}
          onSuccess={() => {
            setShowUploadOnBehalf(false);
            if (userRole) loadStats(userRole);
          }}
        />
      )}
    </div>
  );
}