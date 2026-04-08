"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import Link from "next/link";

type ClientRow = {
  id: string;
  name: string;
  client_code: string;
  email_alias: string | null;
  timezone: string;
  province: string;
  is_active: boolean;
  created_at: string;
  assigned_accountant_id: string | null;
  assigned_at: string | null;
};

type Accountant = {
  id: string;
  auth_user_id: string;
  email: string;
  role: string;
};

function makeClientCode() {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

const PROVINCE_DEFAULT_TZ: Record<string, string> = {
  BC: "America/Vancouver",
  AB: "America/Edmonton",
  SK: "America/Regina",
  MB: "America/Winnipeg",
  ON: "America/Toronto",
  QC: "America/Montreal",
  NB: "America/Moncton",
  NS: "America/Halifax",
  PE: "America/Halifax",
  NL: "America/St_Johns",
  NT: "America/Yellowknife",
  NU: "America/Iqaluit",
  YT: "America/Whitehorse",
};

export default function ClientsPage() {
  console.log("🔍 Clients page component mounted");
  const inboxDomain = "receipts.example.com"; // change later

  const [firmId, setFirmId] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [assigningSaving, setAssigningSaving] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState<string>("");
  const [aliasSaving, setAliasSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTimezone, setNewTimezone] = useState("America/Toronto");
  const [newProvince, setNewProvince] = useState("ON");
  const [creating, setCreating] = useState(false);
  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";

  async function loadClients(fId: string) {
    setErr("");
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,client_code,email_alias,timezone,province,is_active,created_at,assigned_accountant_id,assigned_at")
      .eq("firm_id", fId);

    if (error) {
      setErr(error.message);
      return;
    }
    setClients((data as ClientRow[]) || []);
  }

async function loadAccountants(fId: string) {
  const { data, error } = await supabase
    .from("firm_users")
    .select("id, auth_user_id, role, display_name")
    .eq("firm_id", fId)
    .eq("role", "accountant");

  if (error) {
    console.error("Failed to load accountants:", error);
    return;
  }

  const accountantsWithEmail = (data || []).map(acc => ({
    ...acc,
    email: acc.display_name || acc.auth_user_id,
  }));

  setAccountants(accountantsWithEmail as Accountant[]);
}

  async function assignClient(clientId: string, accountantId: string | null) {
    try {
      setAssigningSaving(clientId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      const { error } = await supabase
        .from("clients")
        .update({
          assigned_accountant_id: accountantId,
          assigned_at: accountantId ? new Date().toISOString() : null,
          assigned_by: accountantId ? firmUser?.id : null,
        })
        .eq("id", clientId);

      if (error) throw error;

      await loadClients(firmId);
    } catch (error: any) {
      console.error("Failed to assign client:", error);
      alert("Failed to assign client: " + error.message);
    } finally {
      setAssigningSaving(null);
    }
  }

  async function saveEmailAlias(clientId: string) {
    try {
      setAliasSaving(true);
      
      // Validate format
      const alias = aliasValue.trim().toLowerCase();
      if (!alias) {
        // Allow clearing the alias
        const { error } = await supabase
          .from("clients")
          .update({ email_alias: null })
          .eq("id", clientId);

        if (error) throw error;
        
        await loadClients(firmId);
        setEditingAlias(null);
        setAliasValue("");
        return;
      }

      // Validate format: 3-30 chars, lowercase alphanumeric, hyphens, underscores
      const validFormat = /^[a-z0-9_-]{3,30}$/.test(alias);
      if (!validFormat) {
        alert("Email alias must be 3-30 characters and contain only lowercase letters, numbers, hyphens, and underscores.");
        setAliasSaving(false);
        return;
      }

      const { error } = await supabase
        .from("clients")
        .update({ email_alias: alias })
        .eq("id", clientId);

      if (error) {
        if (error.code === "23505") { // Unique constraint violation
          alert("This email alias is already taken. Please choose another.");
        } else {
          throw error;
        }
        setAliasSaving(false);
        return;
      }

      await loadClients(firmId);
      setEditingAlias(null);
      setAliasValue("");
    } catch (error: any) {
      console.error("Failed to save email alias:", error);
      alert("Failed to save email alias: " + error.message);
    } finally {
      setAliasSaving(false);
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        console.log("🔍 Starting init...");
        const role = await getUserRole();
        console.log("🔍 User role:", role);
        setUserRole(role);

        const fId = await getMyFirmId();
        console.log("🔍 Firm ID:", fId);
        setFirmId(fId);
        await loadClients(fId);
        
        // Only load accountants if firm admin
        if (role === "firm_admin" || role === "owner") {
          console.log("🔍 Loading accountants...");
          await loadAccountants(fId);
        }
        console.log("🔍 Init complete");
      } catch (e: any) {
        console.error("🔍 Init error:", e);
        setErr(e.message || "Failed to load firm/clients");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const createClient = async () => {
    if (!firmId) return;
    if (!newName.trim()) {
      setErr("Client name is required.");
      return;
    }

    setCreating(true);
    setErr("");

    const client_code = makeClientCode();

const { error } = await supabase.from("clients").insert([
  {
    firm_id: firmId,
    name: newName.trim(),
    client_code,
    province: newProvince,
    timezone: newTimezone,
    is_active: true,
  },
]);

    if (error) {
      setErr(error.message);
      setCreating(false);
      return;
    }

    setNewName("");
    await loadClients(firmId);
    setCreating(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading clients…</p>
        </div>
      </main>
    );
  }

  const unassignedClients = sortedClients.filter(c => !c.assigned_accountant_id);
  const assignedClients = sortedClients.filter(c => c.assigned_accountant_id);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <a className="text-sm underline text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" href="/dashboard">
            ← Back to dashboard
          </a>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Each client gets a unique receipt inbox email address.
        </p>

        {/* Stats Overview - Firm Admin Only */}
        {isFirmAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Clients</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{clients.length}</div>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Assigned</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{assignedClients.length}</div>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Unassigned</div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{unassignedClients.length}</div>
            </div>
          </div>
        )}

        {/* Add Client Form */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Client</h2>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
              className="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white px-4 py-3"
              placeholder="Client name (e.g., ACME Plumbing)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white px-4 py-3"
              value={newProvince}
              onChange={(e) => {
                const p = e.target.value;
                setNewProvince(p);
                setNewTimezone(PROVINCE_DEFAULT_TZ[p] ?? "America/Toronto");
              }}
            >
              <option value="ON">ON</option>
              <option value="BC">BC</option>
              <option value="AB">AB</option>
              <option value="QC">QC</option>
              <option value="MB">MB</option>
              <option value="SK">SK</option>
              <option value="NS">NS</option>
              <option value="NB">NB</option>
              <option value="NL">NL</option>
              <option value="PE">PE</option>
              <option value="NT">NT</option>
              <option value="NU">NU</option>
              <option value="YT">YT</option>
            </select>


            <button
              onClick={createClient}
              disabled={creating}
              className="rounded-lg bg-accent-500 text-white py-3 font-medium hover:bg-accent-600 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create Client"}
            </button>
          </div>

          {err && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{err}</p>}
        </div>

        {/* Client List */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-dark-border font-medium text-gray-900 dark:text-white">
            Client List ({sortedClients.length})
          </div>

          {sortedClients.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No clients yet. Add your first client above.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-dark-border">
              {sortedClients.map((c) => {
                const assignedAccountant = accountants.find(a => a.id === c.assigned_accountant_id);
                const isEditing = editingAlias === c.id;
                const displayEmail = c.email_alias || c.client_code;
                
                return (
                  <div
                    key={c.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex-1">
<Link href={`/dashboard/clients/${c.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400 hover:underline mb-1 block">
  {c.name}
</Link>

                        {/* Email Alias Editor */}
                        {isEditing ? (
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="text"
                              value={aliasValue}
                              onChange={(e) => setAliasValue(e.target.value.toLowerCase())}
                              placeholder="custom-alias"
                              className="text-sm font-mono px-2 py-1 border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                              disabled={aliasSaving}
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">@{inboxDomain}</span>
                            <button
                              onClick={() => saveEmailAlias(c.id)}
                              disabled={aliasSaving}
                              className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {aliasSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingAlias(null);
                                setAliasValue("");
                              }}
                              disabled={aliasSaving}
                              className="text-sm px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                              {displayEmail}@{inboxDomain}
                            </span>
                            <button
                              onClick={() => {
                                setEditingAlias(c.id);
                                setAliasValue(c.email_alias || "");
                              }}
                              className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
                            >
                              ✏️ Edit
                            </button>
                            {c.email_alias && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>Province: {c.province}</span>
                          <span>•</span>
                          <span>Timezone: {c.timezone}</span>
                          <span>•</span>
                          <span>Active: {c.is_active ? "Yes" : "No"}</span>
                          
                          {/* Assignment Info */}
                          {isFirmAdmin && c.assigned_accountant_id && (
                            <>
                              <span>•</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                → {assignedAccountant?.email || 'Unknown accountant'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Assignment Dropdown - Firm Admin Only */}
                      {isFirmAdmin && (
                        <div className="flex items-center gap-2">
                          {accountants.length > 0 ? (
                            <>
                              <select
                                value={c.assigned_accountant_id || ""}
                                onChange={(e) => assignClient(c.id, e.target.value || null)}
                                disabled={assigningSaving === c.id}
                                className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-sm text-gray-900 dark:text-white disabled:opacity-50"
                              >
                                <option value="">Unassigned</option>
                                {accountants.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.email}
                                  </option>
                                ))}
                              </select>
                              {c.assigned_accountant_id && (
                                <button
                                  onClick={() => assignClient(c.id, null)}
                                  disabled={assigningSaving === c.id}
                                  className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  Unassign
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                              No accountants
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Warning if no accountants - Firm Admin Only */}
        {isFirmAdmin && accountants.length === 0 && clients.length > 0 && (
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  No Accountants Available
                </div>
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  Add accountants to your team before assigning clients. Go to Team → Invite users with "Accountant" role.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}