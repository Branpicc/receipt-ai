"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type ClientRow = {
  id: string;
  name: string;
  client_code: string;
  timezone: string;
  province: string;
  is_active: boolean;
  created_at: string;
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
  const inboxDomain = "receipts.example.com"; // change later

  const [firmId, setFirmId] = useState<string>("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [newName, setNewName] = useState("");
  const [newTimezone, setNewTimezone] = useState("America/Toronto");
  const [newProvince, setNewProvince] = useState("ON");
  const [creating, setCreating] = useState(false);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  async function loadClients(fId: string) {
    setErr("");
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,client_code,timezone,province,is_active,created_at")
      .eq("firm_id", fId);

    if (error) {
      setErr(error.message);
      return;
    }
    setClients((data as ClientRow[]) || []);
  }

  useEffect(() => {
    const init = async () => {
      try {
        const fId = await getMyFirmId();
        setFirmId(fId);
        await loadClients(fId);
      } catch (e: any) {
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
      <main className="min-h-screen p-8">
        <div className="max-w-5xl mx-auto">Loading clients…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Clients</h1>
          <a className="text-sm underline" href="/dashboard">
            Back to dashboard
          </a>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          Each client gets a unique receipt inbox email address.
        </p>

        <div className="mt-6 rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Add client</h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="rounded-xl border px-4 py-3"
              placeholder="Client name (e.g., ACME Plumbing)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
<select
  className="rounded-xl border px-4 py-3"
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
            <input
              className="rounded-xl border px-4 py-3"
              placeholder="Timezone"
              value={newTimezone}
              onChange={(e) => setNewTimezone(e.target.value)}
            />

            <button
              onClick={createClient}
              disabled={creating}
              className="rounded-xl bg-black text-white py-3 font-medium disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create client"}
            </button>
          </div>

          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        </div>

        <div className="mt-6 rounded-2xl border overflow-hidden">
          <div className="p-4 border-b font-medium">
            Client list ({sortedClients.length})
          </div>

          {sortedClients.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No clients yet. Add your first client above.
            </div>
          ) : (
            <div className="divide-y">
              {sortedClients.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      Province: {c.province} • Timezone: {c.timezone} • Active:{" "}
                      {c.is_active ? "Yes" : "No"}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Inbox: </span>
                    <span className="font-mono">
                      {c.client_code}@{inboxDomain}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
