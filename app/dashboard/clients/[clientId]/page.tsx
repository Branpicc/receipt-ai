"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { useParams } from "next/navigation";
import Link from "next/link";

type Client = {
  id: string;
  name: string;
  email_alias: string | null;
  client_code: string;
  province: string;
  timezone: string;
  is_active: boolean;
  phone_number: string | null;
  sms_enabled: boolean;
  income_type: string | null;
};

type ClientCard = {
  id: string;
  card_brand: string;
  last_four: string;
  card_type: "business" | "personal";
  nickname: string | null;
};

type Flag = {
  id: string;
  flag_type: string;
  severity: "info" | "warn" | "high";
  message: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  receipts: { vendor: string | null; receipt_date: string | null } | null;
};

type RecentReceipt = {
  id: string;
  vendor: string | null;
  total_cents: number | null;
  receipt_date: string | null;
  status: string;
  approved_category: string | null;
};

type EditRecord = {
  id: string;
  edit_reason: string;
  changes: Record<string, { before: string; after: string }>;
  created_at: string;
  receipt_id: string;
  receipts: { vendor: string | null } | null;
};

type Stats = {
  totalReceipts: number;
  thisMonth: number;
  totalFlags: number;
  unresolvedFlags: number;
  totalEdits: number;
};

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params?.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [cards, setCards] = useState<ClientCard[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [receipts, setReceipts] = useState<RecentReceipt[]>([]);
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ totalReceipts: 0, thisMonth: 0, totalFlags: 0, unresolvedFlags: 0, totalEdits: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "flags" | "cards" | "edits">("overview");
  const [flagFilter, setFlagFilter] = useState<"all" | "unresolved" | "resolved">("all");

  useEffect(() => {
    if (clientId) loadAll();
  }, [clientId]);

  async function loadAll() {
    setLoading(true);
    try {
      const firmId = await getMyFirmId();

      // Load client info
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, name, email_alias, client_code, province, timezone, is_active, phone_number, sms_enabled, income_type")
        .eq("id", clientId)
        .single();
      setClient(clientData as Client);

      // Load cards
      const { data: cardsData } = await supabase
        .from("client_cards")
        .select("id, card_brand, last_four, card_type, nickname")
        .eq("client_id", clientId)
        .order("created_at");
      setCards((cardsData as ClientCard[]) || []);

      // Load flags
      const { data: flagsData } = await supabase
        .from("receipt_flags")
        .select("id, flag_type, severity, message, created_at, resolved_at, resolution_note, receipts(vendor, receipt_date)")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      // Filter flags to this client's receipts
      const { data: clientReceiptIds } = await supabase
        .from("receipts")
        .select("id")
        .eq("client_id", clientId)
        .eq("firm_id", firmId);

      const receiptIdSet = new Set(clientReceiptIds?.map(r => r.id) || []);
      const clientFlags = ((flagsData || []) as any[]).filter(f =>
        f.receipts && receiptIdSet.has(f.receipts?.id || "")
      );

      // Re-fetch flags with receipt_id join
      const { data: flagsWithReceipt } = await supabase
        .from("receipt_flags")
        .select("id, flag_type, severity, message, created_at, resolved_at, resolution_note, receipt_id, receipts(vendor, receipt_date)")
        .in("receipt_id", Array.from(receiptIdSet))
        .order("created_at", { ascending: false });

      setFlags((flagsWithReceipt || []) as unknown as Flag[]);

      // Load recent receipts
      const { data: receiptsData } = await supabase
        .from("receipts")
        .select("id, vendor, total_cents, receipt_date, status, approved_category")
        .eq("client_id", clientId)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false })
        .limit(10);
      setReceipts((receiptsData as RecentReceipt[]) || []);

// Load edit history — scoped to this client's receipts only
const { data: clientReceiptIdsForEdits } = await supabase
  .from("receipts")
  .select("id")
  .eq("client_id", clientId)
  .eq("firm_id", firmId);

const receiptIdsForEdits = clientReceiptIdsForEdits?.map(r => r.id) || [];

let clientEdits: EditRecord[] = [];
if (receiptIdsForEdits.length > 0) {
  const { data: editsData } = await supabase
    .from("receipt_edits")
    .select("id, edit_reason, changes, created_at, receipt_id, receipts(vendor)")
    .in("receipt_id", receiptIdsForEdits)
    .order("created_at", { ascending: false });
  clientEdits = (editsData || []) as unknown as EditRecord[];
}
setEdits(clientEdits);

      // Stats
      const { count: total } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("firm_id", firmId);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: thisMonth } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("firm_id", firmId)
        .gte("created_at", startOfMonth.toISOString());

      const allFlags = (flagsWithReceipt || []) as any[];
      setStats({
        totalReceipts: total || 0,
        thisMonth: thisMonth || 0,
        totalFlags: allFlags.length,
        unresolvedFlags: allFlags.filter(f => !f.resolved_at).length,
        totalEdits: clientEdits.length,
      });

    } catch (err) {
      console.error("Failed to load client detail:", err);
    } finally {
      setLoading(false);
    }
  }

  function getSeverityStyles(severity: string) {
    switch (severity) {
      case "high": return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300";
      case "warn": return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300";
      default: return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300";
    }
  }

  const filteredFlags = flags.filter(f => {
    if (flagFilter === "unresolved") return !f.resolved_at;
    if (flagFilter === "resolved") return !!f.resolved_at;
    return true;
  });

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading client...</div>;
  if (!client) return <div className="p-8 text-red-600">Client not found.</div>;

  return (
    <div className="p-8 min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard/clients" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
            ← Back to Clients
          </Link>
          <div className="mt-3 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${client.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                  {client.is_active ? "Active" : "Inactive"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{client.province} • {client.timezone}</span>
                {client.sms_enabled && client.phone_number && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">📱 SMS On</span>
                )}
              </div>
            </div>
            <Link
              href={`/dashboard/receipts?clientId=${clientId}`}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View Receipts →
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Receipts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalReceipts}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Month</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Flags</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalFlags}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unresolved</div>
            <div className={`text-2xl font-bold ${stats.unresolvedFlags > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{stats.unresolvedFlags}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Edits Made</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEdits}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-dark-surface rounded-t-xl border border-gray-200 dark:border-dark-border border-b-0">
          <div className="flex overflow-x-auto">
            {([
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "flags", label: `Flags (${stats.totalFlags})`, icon: "🚩" },
              { id: "cards", label: `Cards (${cards.length})`, icon: "💳" },
              { id: "edits", label: `Edit History (${stats.totalEdits})`, icon: "✏️" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? "border-accent-500 text-accent-600 dark:text-accent-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-dark-surface rounded-b-xl border border-gray-200 dark:border-dark-border p-6">

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Client Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Client Info</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
                    <span className="text-gray-500 dark:text-gray-400">Email Alias</span>
                    <span className="font-mono text-gray-900 dark:text-white">{client.email_alias || client.client_code}@receipts.example.com</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
                    <span className="text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="text-gray-900 dark:text-white">{client.phone_number || "—"}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
                    <span className="text-gray-500 dark:text-gray-400">Income Type</span>
                    <span className="text-gray-900 dark:text-white capitalize">{client.income_type?.replace("_", " ") || "—"}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
                    <span className="text-gray-500 dark:text-gray-400">SMS Notifications</span>
                    <span className={client.sms_enabled ? "text-green-600 dark:text-green-400" : "text-gray-400"}>{client.sms_enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
              </div>

              {/* Recent Receipts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Receipts</h3>
                {receipts.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No receipts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {receipts.slice(0, 5).map(r => (
                      <Link
                        key={r.id}
                        href={`/dashboard/receipts/${r.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{r.vendor || "Unknown vendor"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {r.receipt_date || "—"}
                            {r.approved_category && <span className="ml-2 text-green-600 dark:text-green-400">• {r.approved_category}</span>}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {r.total_cents ? `$${(r.total_cents / 100).toFixed(2)}` : "—"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flags Tab */}
          {activeTab === "flags" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(["all", "unresolved", "resolved"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFlagFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                      flagFilter === f
                        ? "bg-accent-500 text-white"
                        : "border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover"
                    }`}
                  >
                    {f} ({f === "all" ? flags.length : f === "unresolved" ? flags.filter(x => !x.resolved_at).length : flags.filter(x => x.resolved_at).length})
                  </button>
                ))}
              </div>

              {filteredFlags.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No {flagFilter === "all" ? "" : flagFilter} flags found.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFlags.map(flag => (
                    <div key={flag.id} className={`rounded-xl border p-4 ${getSeverityStyles(flag.severity)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-sm capitalize">
                          {flag.flag_type.replace(/_/g, " ")}
                          {flag.resolved_at && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                              ✓ Resolved
                            </span>
                          )}
                        </div>
                        <div className="text-xs opacity-70">{new Date(flag.created_at).toLocaleDateString()}</div>
                      </div>
                      <p className="text-sm mb-2">{flag.message}</p>
                      {(flag.receipts as any)?.vendor && (
                        <p className="text-xs opacity-70 mb-2">
                          Receipt: {(flag.receipts as any).vendor} {(flag.receipts as any).receipt_date ? `• ${(flag.receipts as any).receipt_date}` : ""}
                        </p>
                      )}
                      {flag.resolved_at && flag.resolution_note && (
                        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                          <p className="text-xs font-medium opacity-80">Resolution note:</p>
                          <p className="text-xs opacity-70">{flag.resolution_note}</p>
                          <p className="text-xs opacity-50 mt-1">Resolved {new Date(flag.resolved_at).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cards Tab */}
          {activeTab === "cards" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cards registered by this client for business expense tracking.
              </p>
              {cards.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No cards registered yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {cards.map(card => (
                    <div
                      key={card.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        card.card_type === "business"
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💳</span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {card.nickname || card.card_brand} ••••{card.last_four}
                          </div>
                          <div className={`text-xs font-medium ${card.card_type === "business" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {card.card_type === "business" ? "✅ Business card" : "🚫 Personal card"}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{card.card_brand}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit History Tab */}
          {activeTab === "edits" && (
            <div className="space-y-4">
              {edits.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No edits made to receipts yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {edits.map(edit => (
                    <div key={edit.id} className="rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
                      <div className="p-4 border-b border-gray-100 dark:border-dark-border flex items-start justify-between">
                        <div>
                          <Link
                            href={`/dashboard/receipts/${edit.receipt_id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400"
                          >
                            {edit.receipts?.vendor || "Unknown vendor"}
                          </Link>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Reason: {edit.edit_reason}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(edit.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="p-4 space-y-1">
                        {Object.entries(edit.changes || {}).map(([field, val]) => (
                          <div key={field} className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500 dark:text-gray-400 capitalize w-20 flex-shrink-0">{field.replace("_", " ")}</span>
                            <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded line-through">{val.before || "—"}</span>
                            <span className="text-gray-400">→</span>
                            <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">{val.after || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}