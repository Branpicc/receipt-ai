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
};

type ReceiptFile = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  created_at?: string;
};

export default function ReceiptDetailPage() {
  const params = useParams();
  const receiptId = (params?.id as string) || "";

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [err, setErr] = useState("");

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
          .select("id,vendor,receipt_date,total_cents,status,created_at")
          .eq("id", receiptId)
          .single();

        if (rErr) throw rErr;
        setReceipt(r as Receipt);

        const { data: fRows, error: fErr } = await supabase
          .from("receipt_files")
          .select("id,storage_bucket,storage_path,original_filename,mime_type,created_at")
          .eq("receipt_id", receiptId)
          .order("created_at", { ascending: true });

        if (fErr) throw fErr;

        const safeFiles = (fRows || []) as ReceiptFile[];
        setFiles(safeFiles);
        setActiveFileId(safeFiles[0]?.id ?? null);
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
