"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import Link from "next/link";

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

export default function EditHistoryPage() {
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const firmId = await getMyFirmId();
      const role = await getUserRole();
      setUserRole(role);

      // Load clients for filter dropdown (accountants/admins only)
      if (role !== "client") {
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name")
          .eq("firm_id", firmId)
          .order("name");
        setClients(clientsData || []);
      }

      await loadEdits(firmId, role);
    } catch (err) {
      console.error("Failed to load edit history:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEdits(firmId: string, role: string | null) {
    try {
      // For clients, get their own client_id first
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
            clients (
              name
            )
          ),
          firm_users (
            display_name,
            role
          )
        `)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      // Scope to client's own receipts
      if (role === "client" && ownClientId) {
        // Filter handled after fetch since we need to filter by nested receipts.client_id
      }

      const { data, error } = await query;
      if (error) throw error;

let filtered = (data || []) as unknown as EditRecord[];

      // Filter for clients — only their receipts
      if (role === "client" && ownClientId) {
        filtered = filtered.filter(e => e.receipts?.client_id === ownClientId);
      }

      // Filter by selected client (accountant view)
      if (clientFilter) {
        filtered = filtered.filter(e => e.receipts?.client_id === clientFilter);
      }

      // Filter by date range
      if (dateFrom) {
        filtered = filtered.filter(e => new Date(e.created_at) >= new Date(dateFrom));
      }
      if (dateTo) {
        filtered = filtered.filter(e => new Date(e.created_at) <= new Date(dateTo + "T23:59:59"));
      }

      setEdits(filtered);
    } catch (err) {
      console.error("Failed to load edits:", err);
    }
  }

  async function applyFilters() {
    setLoading(true);
    const firmId = await getMyFirmId();
    await loadEdits(firmId, userRole);
    setLoading(false);
  }

  const isClient = userRole === "client";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">✏️ Edit History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isClient
              ? "A log of all changes made to your receipts"
              : "A log of all receipt edits across all clients"}
          </p>
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

        {/* Results */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading edit history...</div>
        ) : edits.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
            <div className="text-5xl mb-4">✏️</div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No edits found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Receipt edits will appear here when changes are made
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{edits.length} edit{edits.length !== 1 ? 's' : ''} found</p>
            {edits.map((edit) => (
              <div
                key={edit.id}
                className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden"
              >
                {/* Edit header */}
                <div className="p-4 border-b border-gray-100 dark:border-dark-border flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/dashboard/receipts/${edit.receipt_id}`}
                        className="font-semibold text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                      >
                        {edit.receipts?.vendor || "Unknown vendor"}
                      </Link>
                      {edit.receipts?.receipt_date && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({edit.receipts.receipt_date})
                        </span>
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
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(edit.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(edit.created_at).toLocaleTimeString()}
                    </div>
                    {edit.firm_users?.display_name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        by {edit.firm_users.display_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Changes */}
                <div className="p-4 space-y-2">
                  {Object.entries(edit.changes || {}).map(([field, val]) => (
                    <div key={field} className="flex items-center gap-3 text-sm">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize w-24 flex-shrink-0">
                        {field.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded line-through text-xs">
                          {val.before || "—"}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-xs">
                          {val.after || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer link */}
                <div className="px-4 pb-3">
                  <Link
                    href={`/dashboard/receipts/${edit.receipt_id}`}
                    className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
                  >
                    View receipt →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}