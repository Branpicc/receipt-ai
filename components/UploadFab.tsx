"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { convertHeicToJpg } from "@/lib/convertHeicClient";
import { checkReceiptUploadLimit } from "@/lib/checkUsageLimits";

type UploadProgress = {
  total: number;
  current: number;
  succeeded: number;
  failed: number;
};

export default function UploadFab() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    try {
      setUploading(true);
      setProgress({ total: fileArray.length, current: 0, succeeded: 0, failed: 0 });

      const firmId = await getMyFirmId();

      // Check usage limit before starting
      const limitCheck = await checkReceiptUploadLimit(firmId);
      if (!limitCheck.canUpload) {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysRemaining = lastDay.getDate() - now.getDate();
        if (confirm(`📊 Monthly Limit Reached\n\nYou've used all ${limitCheck.limit} receipts on your ${limitCheck.plan} plan this month.\n\n${daysRemaining} days remaining until reset.\n\nView upgrade options?`)) {
          window.location.href = "/dashboard/settings";
        }
        return;
      }

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", firmId)
        .limit(1);

      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const client = clients[0];

      let succeeded = 0;
      let failed = 0;
      let currentUsage = limitCheck.currentCount;
      const limit = limitCheck.limit;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProgress({ total: fileArray.length, current: i + 1, succeeded, failed });

        // Check limit before each file
        if (currentUsage >= limit) {
          const remainingFiles = fileArray.length - i;
          const now = new Date();
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const daysRemaining = lastDay.getDate() - now.getDate();
          if (confirm(`📊 Limit reached after ${succeeded} upload${succeeded !== 1 ? "s" : ""}.\n${remainingFiles} file${remainingFiles !== 1 ? "s" : ""} not uploaded.\n\n${daysRemaining} days until reset.\n\nView upgrade options?`)) {
            window.location.href = "/dashboard/settings";
          }
          break;
        }

        try {
          let uploadFile = file;
          try {
            uploadFile = await convertHeicToJpg(file);
          } catch {
            failed++;
            setProgress({ total: fileArray.length, current: i + 1, succeeded, failed });
            continue;
          }

          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("firmId", firmId);
          formData.append("clientId", client.id);
          if (userId) formData.append("userId", userId);

          const response = await fetch("/api/upload-receipt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);

          succeeded++;
          currentUsage++;
          setProgress({ total: fileArray.length, current: i + 1, succeeded, failed });
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failed++;
          setProgress({ total: fileArray.length, current: i + 1, succeeded, failed });
        }
      }

      if (failed === 0) {
        alert(`✅ ${succeeded} receipt${succeeded !== 1 ? "s" : ""} uploaded successfully!`);
      } else if (succeeded === 0) {
        alert(`❌ Failed to upload all ${failed} receipts. Please try again.`);
      } else {
        alert(`⚠️ ${succeeded} uploaded, ${failed} failed.`);
      }

      window.location.reload();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <>
      <input
        type="file"
        id="fab-upload-input"
        accept="image/*,application/pdf,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => document.getElementById("fab-upload-input")?.click()}
        disabled={uploading}
        className="fixed bottom-8 right-8 w-16 h-16 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center text-2xl z-50 transition-transform hover:scale-110"
        title={uploading ? `Uploading ${progress?.current ?? 0}/${progress?.total ?? 0}` : "Upload Receipts"}
      >
        {uploading ? "⏳" : "📸"}
      </button>

      {/* Progress bubble */}
      {uploading && progress && progress.total > 1 && (
        <div className="fixed bottom-28 right-8 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-lg p-3 z-50 min-w-[160px]">
          <div className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
            Uploading {progress.current}/{progress.total}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
            <div
              className="bg-accent-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ✅ {progress.succeeded} • ❌ {progress.failed}
          </div>
        </div>
      )}
    </>
  );
}