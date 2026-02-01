"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type ClientRow = {
  id: string;
  name: string;
};

type ReceiptRow = {
  id: string;
  client_id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  status: string;
  created_at: string;
  tax_total_cents?: number | null;

};

export default function ReceiptsPage() {
  const [firmId, setFirmId] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const filteredReceipts = useMemo(() => {
    if (!selectedClientId) return receipts;
    return receipts.filter((r) => r.client_id === selectedClientId);
  }, [receipts, selectedClientId]);

  // ---------- Data loaders ----------
  async function loadClients(fId: string) {
    const { data, error } = await supabase
      .from("clients")
      .select("id,name")
      .eq("firm_id", fId)
      .eq("is_active", true);

    if (error) throw error;
    setClients((data as ClientRow[]) || []);
  }

  async function loadReceipts(fId: string) {
    const { data, error } = await supabase
      .from("receipts")
      .select("id,client_id,vendor,receipt_date,total_cents,tax_total_cents,status,created_at")
      .eq("firm_id", fId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setReceipts((data as ReceiptRow[]) || []);
  }

  // ---------- Init ----------
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setErr("");

      try {
        const fId = await getMyFirmId();
        if (cancelled) return;

        setFirmId(fId);

        await loadClients(fId);
        if (cancelled) return;

        await loadReceipts(fId);
        if (cancelled) return;
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load receipts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Actions ----------
  async function createTestReceipt() {
    try {
      setErr("");

      if (!firmId) throw new Error("Missing firm id");
      if (clients.length === 0) throw new Error("Create a client first.");

      const client = selectedClientId
        ? clients.find((c) => c.id === selectedClientId) ?? clients[0]
        : clients[0];

      const vendors = ["Staples", "Tim Hortons", "Canadian Tire", "Shell", "Uber"];
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const total_cents = Math.floor(500 + Math.random() * 25000); // $5 to $250

      const { error } = await supabase.from("receipts").insert([
        {
          firm_id: firmId,
          client_id: client.id,
          source: "upload",
          vendor,
          receipt_date: new Date().toISOString().slice(0, 10),
          total_cents,
          currency: "CAD",
          status: "needs_review",
        },
      ]);

      if (error) throw error;

      await loadReceipts(firmId);
    } catch (e: any) {
      setErr(e?.message || "Failed to create test receipt");
    }
  }

  async function uploadReceiptFile(file: File) {
    try {
      setErr("");

      if (!firmId) throw new Error("Missing firm id");
      if (clients.length === 0) throw new Error("Create a client first.");

      const client = selectedClientId
        ? clients.find((c) => c.id === selectedClientId) ?? clients[0]
        : clients[0];

      setUploading(true);

      // 1) Create receipt row first
      const { data: receiptInsert, error: receiptErr } = await supabase
        .from("receipts")
        .insert([
          {
            firm_id: firmId,
            client_id: client.id,
            source: "upload",
            status: "needs_review",
            currency: "CAD",
            extraction_status: "pending",
          },
        ])
        .select("id")
        .single();

      if (receiptErr) throw receiptErr;
      const receiptId = receiptInsert.id as string;

      // 2) Storage path
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `${firmId}/${client.id}/${receiptId}/${Date.now()}_${safeName}`;

      // 3) receipt_files row BEFORE uploading (required for storage policy)
      const { error: rfErr } = await supabase.from("receipt_files").insert([
        {
          receipt_id: receiptId,
          firm_id: firmId,
          client_id: client.id,
          storage_bucket: "receipt-files",
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      ]);
      if (rfErr) throw rfErr;

      // 4) Upload to storage
      const { error: upErr } = await supabase.storage
        .from("receipt-files")
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (upErr) throw upErr;

      // 5) Refresh list
      await loadReceipts(firmId);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-5xl mx-auto">Loading receipts…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Receipts Inbox</h1>
          <a className="text-sm underline" href="/dashboard">
            Back to dashboard
          </a>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          This will show incoming receipts (email/upload) for your clients.
        </p>

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        <div className="mt-6 rounded-2xl border p-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-gray-500">
              Firm: <span className="font-mono">{firmId}</span>
            </div>

            <select
              className="rounded-xl border px-4 py-3"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3 items-center">
              <button
                onClick={async () => {
                  if (!firmId) return;
                  setLoading(true);
                  try {
                    await loadReceipts(firmId);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="rounded-xl border py-3 px-5 font-medium"
              >
                Refresh
              </button>

              <input
                type="file"
                accept="image/*,application/pdf"
                className="text-sm"
                disabled={uploading}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await uploadReceiptFile(f);
                  e.currentTarget.value = "";
                }}
              />

              <button
                onClick={createTestReceipt}
                className="rounded-xl bg-black text-white py-3 px-5 font-medium"
              >
                + Test receipt
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border overflow-hidden">
          <div className="p-4 border-b font-medium">
            Receipts ({filteredReceipts.length})
          </div>

          {filteredReceipts.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No receipts yet. Next we’ll ingest receipts from email and uploads.
            </div>
          ) : (
            <div className="divide-y">
              {filteredReceipts.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/receipts/${r.id}`}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.vendor || "Unknown vendor"}</div>
                      <div className="text-xs text-gray-500">
  Date: {r.receipt_date || "—"} • Status: {r.status}
  {r.tax_total_cents != null ? ` • Tax: $${(r.tax_total_cents / 100).toFixed(2)}` : ""}
</div>
                    </div>

                    <div className="text-sm font-mono">
                      {r.total_cents != null
                        ? `$${(r.total_cents / 100).toFixed(2)} CAD`
                        : "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
