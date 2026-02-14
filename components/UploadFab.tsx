"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { extractReceiptData } from "@/lib/extractReceiptData";

export default function UploadFab() {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    try {
      setUploading(true);
      const firmId = await getMyFirmId();

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", firmId)
        .limit(1);

      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        return;
      }

      const client = clients[0];

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
      const receiptId = receiptInsert.id;

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `${firmId}/${client.id}/${receiptId}/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("receipt-files")
        .upload(storagePath, file);

      if (uploadErr) throw uploadErr;

      await supabase
        .from("receipts")
        .update({ file_path: storagePath })
        .eq("id", receiptId);

      const { data: signedData } = await supabase.storage
        .from("receipt-files")
        .createSignedUrl(storagePath, 3600);

      if (signedData?.signedUrl) {
        const extracted = await extractReceiptData(signedData.signedUrl);

        await supabase
          .from("receipts")
          .update({
            vendor: extracted.vendor,
            receipt_date: extracted.date,
            total_cents: extracted.total_cents,
            extraction_status: "completed",
            ocr_raw_text: extracted.raw_text,
          })
          .eq("id", receiptId);

        if (extracted.tax_cents && extracted.tax_cents > 0) {
          await supabase.from("receipt_taxes").insert([
            {
              receipt_id: receiptId,
              tax_type: "HST",
              rate: 0.13,
              amount_cents: extracted.tax_cents,
            },
          ]);
        }
      }

      alert("✅ Receipt uploaded successfully!");
      window.location.reload();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        type="file"
        id="fab-upload-input"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      
      <button
        onClick={() => document.getElementById("fab-upload-input")?.click()}
        disabled={uploading}
        className="fixed bottom-8 right-8 w-16 h-16 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center text-2xl z-50 transition-transform hover:scale-110"
        title="Upload Receipt"
      >
        {uploading ? "⏳" : "📸"}
      </button>
    </>
  );
}