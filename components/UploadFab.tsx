"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

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

      const formData = new FormData();
      formData.append("file", file);
      formData.append("firmId", firmId);
      formData.append("clientId", client.id);

      const response = await fetch("/api/upload-receipt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }

      let result;
      try {
        result = await response.json();
      } catch (e) {
        console.warn("Response was not JSON, but upload may have succeeded");
        alert("✅ Receipt uploaded successfully!");
        window.location.reload();
        return;
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