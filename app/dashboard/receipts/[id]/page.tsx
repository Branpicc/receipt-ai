"use client";

import { useEffect, useState } from "react";
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
};

export default function ReceiptDetailPage() {
  const params = useParams();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadReceipt = async () => {
      try {
        const { data, error } = await supabase
          .from("receipts")
          .select("id,vendor,receipt_date,total_cents,status,created_at")
          .eq("id", receiptId)
          .single();

        if (error) throw error;
        setReceipt(data);
        const { data: fileRows, error: fileErr } = await supabase
        .from("receipt_files")
       .select("id,storage_bucket,storage_path,original_filename,mime_type")
       .eq("receipt_id", receiptId)
       .order("created_at", { ascending: true });

       if (fileErr) throw fileErr;

      setFiles(fileRows || []);
      } catch (e: any) {
        setErr(e.message || "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };
useEffect(() => {
  const run = async () => {
    if (files.length === 0) return;

    const f = files[0];

    const { data, error } = await supabase.storage
      .from(f.storage_bucket)
      .createSignedUrl(f.storage_path, 60 * 60); // 1 hour

    if (error) {
      setErr(error.message);
      return;
    }

    setFileUrl(data.signedUrl);
  };

  run();
}, [files]);

    loadReceipt();
  }, [receiptId]);

  if (loading) {
    return <div className="p-8">Loading receipt…</div>;
  }

  if (err || !receipt) {
    return <div className="p-8 text-red-600">{err || "Receipt not found"}</div>;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <a href="/dashboard/receipts" className="text-sm underline">
          ← Back to receipts
        </a>

        <h1 className="text-2xl font-semibold mt-4">
          {receipt.vendor || "Unknown vendor"}
        </h1>
{fileUrl && files[0] && (
  <div className="mt-6 rounded-2xl border p-4">
    <div className="text-sm text-gray-500 mb-2">
      Receipt preview
      {files[0].original_filename ? ` • ${files[0].original_filename}` : ""}
    </div>

    {files[0].mime_type?.startsWith("image/") ? (
      <img
        src={fileUrl}
        alt="Receipt"
        className="max-h-[700px] mx-auto rounded-lg"
      />
    ) : (
      <iframe src={fileUrl} className="w-full h-[700px] rounded-lg" />
    )}
  </div>
)}

        <div className="mt-4 rounded-2xl border p-6 space-y-2">
          <div>
            <span className="text-gray-500 text-sm">Date:</span>{" "}
            {receipt.receipt_date || "—"}
          </div>

          <div>
            <span className="text-gray-500 text-sm">Status:</span>{" "}
            {receipt.status}
          </div>

          <div>
            <span className="text-gray-500 text-sm">Amount:</span>{" "}
            {receipt.total_cents != null
              ? `$${(receipt.total_cents / 100).toFixed(2)} CAD`
              : "—"}
          </div>

          <div className="text-xs text-gray-400 pt-4">
            Created: {new Date(receipt.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    </main>
  );
}
