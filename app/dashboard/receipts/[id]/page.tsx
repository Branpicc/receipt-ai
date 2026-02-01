"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  status: string;
  created_at: string;
  purpose_text?: string | null;
  purpose_source?: string | null;
  purpose_updated_at?: string | null;
  firm_id: string;
  client_id: string;
};

type ReceiptFile = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  created_at?: string;
};
type ReceiptItem = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit_price_cents: number | null;
  total_cents: number | null;
};
type ReceiptTax = {
  id: string;
  tax_type: string;      // "GST" | "HST" | "QST" | "PST" etc.
  rate: number | null;   // e.g. 0.13
  amount_cents: number | null;
};
type ReceiptFlag = {
  id: string;
  flag_type: string;
  severity: "info" | "warn" | "high";
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export default function ReceiptDetailPage() {
  const params = useParams();
  const receiptId = (params?.id as string) || "";

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [taxes, setTaxes] = useState<ReceiptTax[]>([]);
  const [purposeDraft, setPurposeDraft] = useState("");
  const [savingPurpose, setSavingPurpose] = useState(false);
  const [flags, setFlags] = useState<ReceiptFlag[]>([]);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [err, setErr] = useState("");
function purposeLooksLikeMeal(purpose: string) {
  const p = purpose.toLowerCase();
  const mealWords = [
    "lunch",
    "dinner",
    "breakfast",
    "coffee",
    "meal",
    "restaurant",
    "client meal",
    "food",
    "snack",
    "catering",
    "tim hortons",
    "starbucks",
  ];
  return mealWords.some((w) => p.includes(w));
}

function vendorLooksNonFood(vendor: string) {
  const v = vendor.toLowerCase();
  // Option 1: only obvious non-food retailers/services
  const nonFood = [
    "staples",
    "canadian tire",
    "home depot",
    "best buy",
    "apple",
    "amazon",
    "walmart",
    "costco",
    "ikea",
    "uber",      // often rides; not food by default
    "shell",
    "esso",
    "petro",
    "chevron",
  ];
  return nonFood.some((w) => v.includes(w));
}

async function loadFlags() {
  if (!receiptId) return;

  const { data, error } = await supabase
    .from("receipt_flags")
    .select("id,flag_type,severity,message,created_at,resolved_at")
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: false });

  if (error) {
    // don't hard-fail the page for flags
    console.warn("Failed to load flags", error.message);
    return;
  }

  setFlags((data as ReceiptFlag[]) || []);
}

async function ensureMismatchFlag(purposeText: string, vendorText: string) {
  if (!purposeText?.trim() || !vendorText?.trim()) return;
  if (!receipt) return;

  // only mismatch we flag in Option 1:
  // purpose says meal, vendor is clearly non-food
  const mismatch = purposeLooksLikeMeal(purposeText) && vendorLooksNonFood(vendorText);
  if (!mismatch) return;

  // check if we already have an unresolved mismatch flag
  const { data: existing, error: exErr } = await supabase
    .from("receipt_flags")
    .select("id")
    .eq("receipt_id", receiptId)
    .eq("flag_type", "purpose_vendor_mismatch")
    .is("resolved_at", null)
    .maybeSingle();

  if (exErr && exErr.code !== "PGRST116") {
    // PGRST116 = no rows for maybeSingle
    throw exErr;
  }

  if (existing?.id) return; // already flagged

  const message = `Purpose mentions a meal, but vendor looks non-food (${vendorText}). Please confirm category/purpose.`;

  const { error } = await supabase.from("receipt_flags").insert([
    {
      receipt_id: receiptId,
      firm_id: (receipt as any).firm_id ?? undefined, // if your receipt select includes firm_id, great
      client_id: (receipt as any).client_id ?? undefined,
      flag_type: "purpose_vendor_mismatch",
      severity: "warn",
      message,
    },
  ]);

  if (error) throw error;

  await loadFlags();
}

async function resolveFlag(flagId: string) {
  try {
    setResolvingFlagId(flagId);

    const { error } = await supabase
      .from("receipt_flags")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", flagId);

    if (error) throw error;

    await loadFlags();
  } finally {
    setResolvingFlagId(null);
  }
}
  const activeFile = useMemo(() => {
    if (!files.length) return null;
    if (!activeFileId) return files[0];
    return files.find((f) => f.id === activeFileId) ?? files[0];
  }, [files, activeFileId]);

  // 1) Load receipt + attached files
  useEffect(() => {
    if (!receiptId) return;

    const load = async () => {
      setLoading(true);
      setErr("");

      try {
        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select(`
  id,
  firm_id,
  client_id,
  vendor,
  receipt_date,
  total_cents,
  status,
  created_at,
  purpose_text,
  purpose_source,
  purpose_updated_at
`)
          .eq("id", receiptId)
          .single();
          

        if (rErr) throw rErr;
        setReceipt(r as Receipt);
        setPurposeDraft(r?.purpose_text ?? "");
        await loadFlags();

        setPurposeDraft((r as any)?.purpose_text ?? "");

        const { data: fRows, error: fErr } = await supabase
          .from("receipt_files")
          .select("id,storage_bucket,storage_path,original_filename,mime_type,created_at")
          .eq("receipt_id", receiptId)
          .order("created_at", { ascending: true });

        if (fErr) throw fErr;

        const safeFiles = (fRows || []) as ReceiptFile[];
        setFiles(safeFiles);
        setActiveFileId(safeFiles[0]?.id ?? null);
        const { data: itemRows, error: itemErr } = await supabase
  .from("receipt_items")
  .select("id,description,quantity,unit_price_cents,total_cents")
  .eq("receipt_id", receiptId)
  .order("id", { ascending: true });

if (itemErr) throw itemErr;

setItems((itemRows as ReceiptItem[]) || []);
const { data: taxRows, error: taxErr } = await supabase
  .from("receipt_taxes")
  .select("id,tax_type,rate,amount_cents")
  .eq("receipt_id", receiptId)
  .order("id", { ascending: true });

if (taxErr) throw taxErr;

setTaxes((taxRows as ReceiptTax[]) || []);
{taxes.length > 0 && (
  <div className="col-span-2">
    <div className="mt-2 rounded-xl border bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500 mb-2">Tax breakdown</div>

      <div className="space-y-1">
        {taxes.map((t) => (
          <div key={t.id} className="flex items-center justify-between text-xs">
            <div className="text-gray-700">
              {t.tax_type}
              {t.rate != null ? ` (${Math.round(t.rate * 10000) / 100}%)` : ""}
            </div>
            <div className="font-mono">
              {t.amount_cents != null
                ? `$${(t.amount_cents / 100).toFixed(2)}`
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

      } catch (e: any) {
        setErr(e?.message || "Failed to load receipt");
        setReceipt(null);
        setFiles([]);
        setActiveFileId(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [receiptId]);

  // 2) Create a signed preview URL for the active file
  useEffect(() => {
    const run = async () => {
      setFileUrl(null);

      if (!activeFile) return;

      setPreviewLoading(true);
      setErr("");

      try {
        const { data, error } = await supabase.storage
          .from(activeFile.storage_bucket)
          .createSignedUrl(activeFile.storage_path, 60 * 60); // 1 hour

        if (error) throw error;
        setFileUrl(data.signedUrl);
      } catch (e: any) {
        setErr(e?.message || "Failed to load receipt preview");
      } finally {
        setPreviewLoading(false);
      }
    };

    run();
  }, [activeFile?.id]); // only rerun when file changes

  if (!receiptId) {
    return <div className="p-8 text-red-600">Missing receipt id in URL.</div>;
  }

  if (loading) {
    return <div className="p-8">Loading receipt…</div>;
  }

  if (err && !receipt) {
    return <div className="p-8 text-red-600">{err}</div>;
  }

  if (!receipt) {
    return <div className="p-8 text-red-600">Receipt not found.</div>;
  }

  const amountText =
    receipt.total_cents != null ? `$${(receipt.total_cents / 100).toFixed(2)} CAD` : "—";
const taxTotalCents = taxes.reduce((sum, t) => sum + (t.amount_cents ?? 0), 0);

const taxText =
  taxes.length === 0 ? "—" : `$${(taxTotalCents / 100).toFixed(2)} CAD`;

// Subtotal = Total - Taxes (only if we have total)
const subtotalCents =
  receipt.total_cents != null ? receipt.total_cents - taxTotalCents : null;

const subtotalText =
  subtotalCents == null ? "—" : `$${(subtotalCents / 100).toFixed(2)} CAD`;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <a href="/dashboard/receipts" className="text-sm underline">
          ← Back to receipts
        </a>

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {receipt.vendor || "Unknown vendor"}
            </h1>
            <div className="text-sm text-gray-500 mt-1">
              Date: {receipt.receipt_date || "—"} • Status: {receipt.status} • Amount:{" "}
              <span className="font-medium text-gray-800">{amountText}</span>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            Created: {new Date(receipt.created_at).toLocaleString()}
            {/* receipt details section */}
<div className="mt-4 rounded-2xl border p-6 space-y-2">
  ...
  Created: {new Date(receipt.created_at).toLocaleString()}
</div>

{/* 👇 PASTE PURPOSE BLOCK RIGHT HERE */}
{receipt.purpose_text && (
  <div className="mt-4 rounded-2xl border p-6">
    <div className="text-sm text-gray-500">Purpose</div>

    <div className="mt-1 text-base">
      {receipt.purpose_text}
    </div>

    {(receipt.purpose_source || receipt.purpose_updated_at) && (
      <div className="mt-2 text-xs text-gray-400">
        {receipt.purpose_source ? `Source: ${receipt.purpose_source}` : ""}
        {receipt.purpose_source && receipt.purpose_updated_at ? " • " : ""}
        {receipt.purpose_updated_at
          ? `Updated: ${new Date(receipt.purpose_updated_at).toLocaleString()}`
          : ""}
      </div>
    )}
  </div>
)}
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* Digital copy layout: left = preview, right = details */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview */}
          <div className="lg:col-span-2 rounded-2xl border overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="text-sm font-medium">Receipt preview</div>

              {files.length > 0 && (
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={activeFile?.id ?? ""}
                  onChange={(e) => setActiveFileId(e.target.value)}
                >
                  {files.map((f, idx) => (
                    <option key={f.id} value={f.id}>
                      {idx + 1}. {f.original_filename || "file"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-4">
              {!files.length ? (
                <div className="text-sm text-gray-600">
                  No file attached yet (this can happen with sample rows).
                </div>
              ) : previewLoading ? (
                <div className="text-sm text-gray-600">Loading preview…</div>
              ) : fileUrl && activeFile ? (
                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    {activeFile.original_filename || "Receipt file"}{" "}
                    {activeFile.mime_type ? `• ${activeFile.mime_type}` : ""}
                  </div>

                  {activeFile.mime_type?.startsWith("image/") ? (
                    <img
                      src={fileUrl}
                      alt="Receipt"
                      className="w-full max-h-[780px] object-contain rounded-lg"
                    />
                  ) : (
                    <iframe
                      src={fileUrl}
                      className="w-full h-[780px] rounded-lg"
                      title="Receipt preview"
                    />
                  )}

                  <div className="mt-3">
                    <a
                      className="text-sm underline"
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file in new tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No preview available.</div>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="rounded-2xl border overflow-hidden">
            <div className="p-4 border-b font-medium">Details</div>
{/* Digital receipt data (structured) */}
<div className="mt-6 rounded-2xl border overflow-hidden">
  <div className="p-4 border-b font-medium">Digital receipt</div>

  <div className="p-4 space-y-4 text-sm">
    {/* Totals */}
    <div className="grid grid-cols-2 gap-3">
      <div className="text-gray-500">Subtotal</div>
      <div className="text-right">{subtotalText}</div>

      <div className="text-gray-500">Taxes</div>
      <div className="text-right">{taxText}</div>

      <div className="font-medium">Total</div>
      <div className="text-right font-medium">{amountText}</div>
    </div>

    {/* Line items */}
    <div className="pt-4 border-t">
      <div className="text-xs font-medium text-gray-500 mb-2">
        Line items
      </div>

      <div className="text-xs text-gray-400">
        Line items will appear here once the receipt is extracted.
      </div>
    </div>

    {/* Purpose / notes */}
    <div className="pt-4 border-t">
      <div className="text-xs font-medium text-gray-500 mb-2">
<div className="pt-4 border-t">
  <div className="flex items-center justify-between mb-2">
    <div className="text-xs font-medium text-gray-500">Purpose of expense</div>
    <div className="text-xs text-gray-400">
      Source: {receipt.purpose_source || "—"}
    </div>
  </div>

  <textarea
    className="w-full rounded-xl border p-3 text-sm"
    rows={3}
    placeholder="Example: Lunch meeting with client to discuss project scope."
    value={purposeDraft}
    onChange={(e) => setPurposeDraft(e.target.value)}
  />

  <div className="mt-2 flex gap-2">
    <button
      disabled={savingPurpose}
      className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
      onClick={async () => {
        try {
          setSavingPurpose(true);
          setErr("");

          const { error } = await supabase
            .from("receipts")
            .update({
              purpose_text: purposeDraft.trim() || null,
              purpose_source: "accountant",
              purpose_updated_at: new Date().toISOString(),
            })
            .eq("id", receipt.id);

          if (error) throw error;

          // update local view without full reload
          setReceipt((prev) =>
            prev
              ? {
                  ...prev,
                  purpose_text: purposeDraft.trim() || null,
                  purpose_source: "accountant",
                  purpose_updated_at: new Date().toISOString(),
                }
                
              : prev
          );
          
          await ensureMismatchFlag(purposeDraft.trim(), receipt.vendor || "");

        } catch (e: any) {
          setErr(e.message || "Failed to save purpose");
        } finally {
          setSavingPurpose(false);
        }
      }}
    >
      Save purpose
    </button>

    <button
      className="rounded-xl border px-4 py-2 text-sm"
      onClick={() => setPurposeDraft(receipt.purpose_text || "")}
    >
      Reset
    </button>
  </div>

  {receipt.purpose_updated_at && (
    <div className="mt-2 text-xs text-gray-400">
      Updated: {new Date(receipt.purpose_updated_at).toLocaleString()}
    </div>
  )}
</div>
      </div>

      <div className="text-xs text-gray-400">
        Not provided yet.
      </div>
    </div>
  </div>
</div>

            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Vendor</span>
                <span className="font-medium">{receipt.vendor || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Receipt date</span>
                <span className="font-medium">{receipt.receipt_date || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-medium">{amountText}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium">{receipt.status}</span>
              </div>

              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2">
                  Digital receipt sections (next)
                </div>

                <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
                  <li>Taxes breakdown (GST/HST, PST/QST)</li>
                  <li>Line items (qty, description, price)</li>
                  <li>Payment method + last 4</li>
                  <li>Receipt text (OCR) + CRA flags</li>
                  <li>Category suggestions + confidence</li>
                </ul>

                <div className="mt-3 text-xs text-gray-500">
                  We’ll populate these once we add extraction + tax logic.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Attached files list */}
        {files.length > 0 && (
          <div className="mt-6 rounded-2xl border overflow-hidden">
            <div className="p-4 border-b font-medium">
              Attached files ({files.length})
            </div>
            <div className="divide-y">
              {files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  className={`w-full text-left p-4 text-sm hover:bg-gray-50 ${
                    activeFile?.id === f.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="font-medium">
                    {f.original_filename || "file"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {f.mime_type || "unknown type"}
                    {f.created_at ? ` • ${new Date(f.created_at).toLocaleString()}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
