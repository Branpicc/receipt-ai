"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useEditMode } from "@/lib/EditMode";
import { permanentlyDeleteReceipt } from "@/lib/deleteReceipt";
import Link from "next/link";
import { Edit3, Trash2, AlertTriangle } from "lucide-react";
import { useFeatureGate } from "@/lib/useFeatureGate";
import UpgradeRequired from "@/components/UpgradeRequired";

type EditRecord = {
  id: string;
  edit_reason: string;
  changes: Record<string, { before: string; after: string }>;
  created_at: string;
  receipt_id: string;
  receipts: {
    vendor: string | null;
    receipt_date: string | null;
    client_id: string;
    clients: {
      name: string;
    } | null;
  } | null;
  firm_users: {
    display_name: string | null;
    role: string;
  } | null;
};

type DeletionRequest = {
  id: string;
  receipt_id: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  receipt_vendor: string | null;
  receipt_date: string | null;
  receipt_total_cents: number | null;
  client_id: string;
  clients: { name: string } | null;
  requested_by_email?: string;
};

type Tab = "edits" | "deletions";
type DeletionSubTab = "pending" | "decided";

export default function EditHistoryPage() {
  const gate = useFeatureGate("edit_history");
  if (gate.loading) return null;
  if (!gate.allowed) return <UpgradeRequired feature="edit_history" />;
  return <EditHistoryContent />;
}

function EditHistoryContent() {
  const [tab, setTab] = useState<Tab>("edits");

  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [deletionSubTab, setDeletionSubTab] = useState<DeletionSubTab>("pending");
  const [pendingDelCount, setPendingDelCount] = useState(0);
  const [decidedDelCount, setDecidedDelCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  // Approve / deny modal state
  const [decisionTarget, setDecisionTarget] = useState<DeletionRequest | null>(null);
  const [decisionMode, setDecisionMode] = useState<"approve" | "deny" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const { editMode, isOwner } = useEditMode();
  const isClient = userRole === "client";
  const canDecide =
    (userRole === "accountant" || userRole === "firm_admin" || (isOwner && editMode));

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userRole === null) return;
    if (tab === "edits") loadEdits();
    else loadDeletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, deletionSubTab, userRole]);

  async function loadData() {
    setLoading(true);
    try {
      const firmId = await getMyFirmId();
      const role = await getUserRole();
      setUserRole(role);

      if (role !== "client") {
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name")
          .eq("firm_id", firmId)
          .order("name");
        setClients(clientsData || []);
      }

      if (tab === "edits") await loadEdits(firmId, role);
      else await loadDeletions(firmId, role);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEdits(firmIdArg?: string, roleArg?: string | null) {
    try {
      setLoading(true);
      const firmId = firmIdArg ?? (await getMyFirmId());
      const role = roleArg ?? userRole;

      let ownClientId: string | null = null;
      if (role === "client") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: firmUser } = await supabase
            .from("firm_users")
            .select("client_id")
            .eq("auth_user_id", user.id)
            .single();
          ownClientId = firmUser?.client_id || null;
        }
      }

      const { data, error } = await supabase
        .from("receipt_edits")
        .select(`
          id,
          edit_reason,
          changes,
          created_at,
          receipt_id,
          receipts (
            vendor,
            receipt_date,
            client_id,
            clients ( name )
          ),
          firm_users (
            display_name,
            role
          )
        `)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      let filtered = (data || []) as unknown as EditRecord[];
      if (role === "client" && ownClientId) {
        filtered = filtered.filter(e => e.receipts?.client_id === ownClientId);
      }
      if (clientFilter) filtered = filtered.filter(e => e.receipts?.client_id === clientFilter);
      if (dateFrom) filtered = filtered.filter(e => new Date(e.created_at) >= new Date(dateFrom));
      if (dateTo) filtered = filtered.filter(e => new Date(e.created_at) <= new Date(dateTo + "T23:59:59"));
      setEdits(filtered);
    } catch (err) {
      console.error("Failed to load edits:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeletions(firmIdArg?: string, roleArg?: string | null) {
    try {
      setLoading(true);
      const firmId = firmIdArg ?? (await getMyFirmId());
      const role = roleArg ?? userRole;

      let ownClientId: string | null = null;
      if (role === "client") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: firmUser } = await supabase
            .from("firm_users")
            .select("client_id")
            .eq("auth_user_id", user.id)
            .single();
          ownClientId = firmUser?.client_id || null;
        }
      }

      let query = supabase
        .from("deletion_requests")
        .select(`
          id, receipt_id, reason, status, created_at, decided_at, decision_note,
          receipt_vendor, receipt_date, receipt_total_cents, client_id,
          clients ( name )
        `)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      if (deletionSubTab === "pending") query = query.eq("status", "pending");
      else query = query.in("status", ["approved", "denied"]);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data || []) as unknown as DeletionRequest[];
      if (role === "client" && ownClientId) {
        filtered = filtered.filter(d => d.client_id === ownClientId);
      }
      if (clientFilter) filtered = filtered.filter(d => d.client_id === clientFilter);
      if (dateFrom) filtered = filtered.filter(d => new Date(d.created_at) >= new Date(dateFrom));
      if (dateTo) filtered = filtered.filter(d => new Date(d.created_at) <= new Date(dateTo + "T23:59:59"));
      setDeletions(filtered);

      // Counts for the sub-tab labels — small head-only queries, both states.
      const baseCount = supabase
        .from("deletion_requests")
        .select("id", { count: "exact", head: true })
        .eq("firm_id", firmId);
      const [pendingRes, decidedRes] = await Promise.all([
        baseCount.eq("status", "pending"),
        // Re-build query because the chained one above is consumed once awaited.
        supabase
          .from("deletion_requests")
          .select("id", { count: "exact", head: true })
          .eq("firm_id", firmId)
          .in("status", ["approved", "denied"]),
      ]);
      setPendingDelCount(pendingRes.count || 0);
      setDecidedDelCount(decidedRes.count || 0);
    } catch (err) {
      console.error("Failed to load deletions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters() {
    if (tab === "edits") await loadEdits();
    else await loadDeletions();
  }

  function openDecision(req: DeletionRequest, mode: "approve" | "deny") {
    setDecisionTarget(req);
    setDecisionMode(mode);
    setDecisionNote("");
    setConfirmText("");
  }

  function closeDecision() {
    setDecisionTarget(null);
    setDecisionMode(null);
    setDecisionNote("");
    setConfirmText("");
  }

  async function submitDecision() {
    if (!decisionTarget || !decisionMode) return;
    try {
      setSubmittingDecision(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (decisionMode === "approve") {
        // Hard confirmation guard
        const expected = (decisionTarget.receipt_vendor || "DELETE").trim();
        if (confirmText.trim() !== expected) {
          alert(`Type "${expected}" exactly to confirm permanent deletion.`);
          setSubmittingDecision(false);
          return;
        }
        await permanentlyDeleteReceipt(decisionTarget.receipt_id);
      }

      const { error } = await supabase
        .from("deletion_requests")
        .update({
          status: decisionMode === "approve" ? "approved" : "denied",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          decision_note: decisionNote.trim() || null,
        })
        .eq("id", decisionTarget.id);
      if (error) throw error;

      closeDecision();
      // Bounce to Decided so the just-decided request is visible.
      setDeletionSubTab("decided");
      // Tell the sidebar to refresh its pending-count badge live.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("deletion-requests-changed"));
      }
      await loadDeletions();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ||
        (typeof err === "string" ? err : "unknown error");
      alert("Failed: " + msg);
    } finally {
      setSubmittingDecision(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isClient
              ? "Changes and deletion requests on your receipts"
              : "Receipt edits and deletion requests across the firm"}
          </p>
        </div>

        {/* Top tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setTab("edits")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === "edits"
                ? "border-accent-500 text-accent-600 dark:text-accent-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Edit3 className="w-4 h-4" /> Edits
          </button>
          <button
            onClick={() => setTab("deletions")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === "deletions"
                ? "border-accent-500 text-accent-600 dark:text-accent-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Trash2 className="w-4 h-4" /> Deletion Requests
          </button>
        </div>

        {/* Filters — accountants/admins only */}
        {!isClient && (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client</label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyFilters}
                  className="w-full px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edits tab */}
        {tab === "edits" && (
          loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading edit history…</div>
          ) : edits.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
              <Edit3 className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No edits found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Receipt edits will appear here when changes are made
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{edits.length} edit{edits.length !== 1 ? 's' : ''} found</p>
              {edits.map((edit) => (
                <div key={edit.id} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-dark-border flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/dashboard/receipts/${edit.receipt_id}`} className="font-semibold text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400 transition-colors">
                          {edit.receipts?.vendor || "Unknown vendor"}
                        </Link>
                        {edit.receipts?.receipt_date && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">({edit.receipts.receipt_date})</span>
                        )}
                        {!isClient && edit.receipts?.clients?.name && (
                          <span className="text-xs px-2 py-0.5 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 rounded-full">
                            {edit.receipts.clients.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Reason:</span> {edit.edit_reason}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(edit.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(edit.created_at).toLocaleTimeString()}</div>
                      {edit.firm_users?.display_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">by {edit.firm_users.display_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {Object.entries(edit.changes || {}).map(([field, val]) => (
                      <div key={field} className="flex items-center gap-3 text-sm">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize w-24 flex-shrink-0">{field.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded line-through text-xs">{val.before || "—"}</span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-xs">{val.after || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3">
                    <Link href={`/dashboard/receipts/${edit.receipt_id}`} className="text-xs text-accent-600 dark:text-accent-400 hover:underline">
                      View receipt →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Deletions tab */}
        {tab === "deletions" && (
          <>
            <div className="mb-4 inline-flex p-1 rounded-lg bg-gray-100 dark:bg-dark-surface border border-gray-200 dark:border-dark-border">
              <button
                onClick={() => setDeletionSubTab("pending")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  deletionSubTab === "pending"
                    ? "bg-white dark:bg-dark-bg text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Pending
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  pendingDelCount > 0
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                    : "bg-gray-200 dark:bg-dark-border text-gray-500 dark:text-gray-400"
                }`}>
                  {pendingDelCount}
                </span>
              </button>
              <button
                onClick={() => setDeletionSubTab("decided")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  deletionSubTab === "decided"
                    ? "bg-white dark:bg-dark-bg text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Decided
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-gray-400">
                  {decidedDelCount}
                </span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading deletion requests…</div>
            ) : deletions.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
                <Trash2 className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No deletion requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">{deletions.length} request{deletions.length !== 1 ? 's' : ''}</p>
                {deletions.map((d) => {
                  const totalText = d.receipt_total_cents != null ? `$${(d.receipt_total_cents / 100).toFixed(2)}` : "—";
                  return (
                    <div key={d.id} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {d.status === "approved" ? (
                              <span className="font-semibold text-gray-900 dark:text-white">{d.receipt_vendor || "Unknown vendor"}</span>
                            ) : (
                              <Link href={`/dashboard/receipts/${d.receipt_id}`} className="font-semibold text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400">
                                {d.receipt_vendor || "Unknown vendor"}
                              </Link>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">({d.receipt_date || "—"} • {totalText})</span>
                            {!isClient && d.clients?.name && (
                              <span className="text-xs px-2 py-0.5 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 rounded-full">{d.clients.name}</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              d.status === "pending"
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                                : d.status === "approved"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                            }`}>
                              {d.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-dark-bg rounded p-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Reason: </span>
                            {d.reason}
                          </div>
                          {d.decision_note && (
                            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-dark-bg rounded p-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Decision note: </span>
                              {d.decision_note}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            Requested {new Date(d.created_at).toLocaleString()}
                            {d.decided_at && <> • Decided {new Date(d.decided_at).toLocaleString()}</>}
                          </div>
                        </div>
                        {d.status === "pending" && !isClient && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => openDecision(d, "approve")}
                              disabled={!canDecide}
                              title={!canDecide ? "Read-only mode — toggle edit mode to act" : ""}
                              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                              Approve & delete
                            </button>
                            <button
                              onClick={() => openDecision(d, "deny")}
                              disabled={!canDecide}
                              className="px-3 py-1.5 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve / deny modal */}
      {decisionTarget && decisionMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full p-6 border border-transparent dark:border-dark-border">
            {decisionMode === "approve" ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Confirm permanent deletion
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  This permanently removes this receipt from Receipture, including the image, line items,
                  taxes, flags, and edit history. This cannot be undone.
                </p>
                <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">{decisionTarget.receipt_vendor || "Unknown vendor"}</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {decisionTarget.receipt_date || "—"} • {decisionTarget.receipt_total_cents != null ? `$${(decisionTarget.receipt_total_cents / 100).toFixed(2)}` : "—"}
                  </div>
                </div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type <span className="font-mono">{decisionTarget.receipt_vendor || "DELETE"}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white mb-3"
                  autoFocus
                />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note for the client (optional)
                </label>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white resize-none mb-4"
                />
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Deny request</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Tell the client why this deletion can&apos;t be approved (optional).
                </p>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  rows={3}
                  placeholder="This receipt is needed for the upcoming filing — please leave it in place."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white resize-none mb-4"
                  autoFocus
                />
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDecision}
                disabled={submittingDecision}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDecision}
                disabled={submittingDecision}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 ${
                  decisionMode === "approve" ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-800"
                }`}
              >
                {submittingDecision
                  ? "Working…"
                  : decisionMode === "approve"
                  ? "Permanently delete"
                  : "Deny request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
