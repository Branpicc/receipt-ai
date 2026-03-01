"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";
import { checkReceiptUploadLimit } from "@/lib/checkUsageLimits";
import UsageStats from "@/components/UsageStats";
import { convertHeicToJpg } from "@/lib/convertHeicClient";

type UploadProgress = {
  total: number;
  current: number;
  currentFile: string;
  succeeded: number;
  failed: number;
};

export default function DashboardHomePage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    thisMonth: 0,
    pendingReview: 0,
  });

  useEffect(() => {
    loadStats();
    updateLastSeen();
  }, []);

  async function updateLastSeen() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      await supabase
        .from("firm_users")
        .update({ last_seen: new Date().toISOString() })
        .eq("firm_id", firmId)
        .eq("auth_user_id", user.id);
    } catch (error) {
      console.error("Failed to update last_seen:", error);
    }
  }

  async function loadStats() {
    try {
      const firmId = await getMyFirmId();
      
      const { count: total } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: thisMonth } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .gte("created_at", startOfMonth.toISOString());

      const { count: pending } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("status", "needs_review");

      setStats({
        totalReceipts: total || 0,
        thisMonth: thisMonth || 0,
        pendingReview: pending || 0,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

  async function handleMultipleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    try {
      setUploading(true);
      setUploadProgress({
        total: fileArray.length,
        current: 0,
        currentFile: fileArray[0]?.name || "",
        succeeded: 0,
        failed: 0,
      });

      const firmId = await getMyFirmId();
      const usageCheck = await checkReceiptUploadLimit(firmId);
      
      if (!usageCheck.canUpload) {
        alert(usageCheck.message || "Upload limit reached");
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", firmId)
        .limit(1);

      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const client = clients[0];

      let succeeded = 0;
      let failed = 0;

      // Upload files sequentially
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        setUploadProgress({
          total: fileArray.length,
          current: i + 1,
          currentFile: file.name,
          succeeded,
          failed,
        });

        try {
          // Convert HEIC if needed
          let uploadFile = file;
          try {
            uploadFile = await convertHeicToJpg(file);
          } catch (conversionError) {
            console.error('HEIC conversion failed for', file.name, conversionError);
            failed++;
            continue; // Skip this file, continue with others
          }

          const formData = new FormData();
          formData.append("file", uploadFile);
          formData.append("firmId", firmId);
          formData.append("clientId", client.id);
          if (userId) {
            formData.append("userId", userId);
          }

          const response = await fetch("/api/upload-receipt", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          succeeded++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failed++;
          // Continue with next file instead of stopping
        }
      }

      // Show summary
      if (failed === 0) {
        alert(`✅ All ${succeeded} receipts uploaded successfully!`);
      } else if (succeeded === 0) {
        alert(`❌ Failed to upload all ${failed} receipts. Please try again.`);
      } else {
        alert(`⚠️ Uploaded ${succeeded} receipts successfully. ${failed} failed.`);
      }

      loadStats();
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      alert("Upload process failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Upload Hero Section */}
      <div className="bg-gradient-to-br from-black to-gray-800 rounded-xl p-6 mb-8 text-white">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold mb-2">Upload Receipts</h2>
          <p className="text-gray-300 mb-6">
            Select one or multiple receipts to upload. Our AI will extract all the details automatically.
          </p>
          
          <label
            htmlFor="hero-upload"
            className={`block border-2 border-dashed border-gray-400 rounded-xl p-6 text-center cursor-pointer hover:border-white hover:bg-white/10 transition-all ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="file"
              id="hero-upload"
              accept="image/*,application/pdf,.heic,.heif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleMultipleFiles(e.target.files)}
            />
            
            {uploading && uploadProgress ? (
              // Progress indicator
              <div className="space-y-3">
                <div className="text-4xl mb-3">⏳</div>
                <div className="text-lg font-semibold">
                  Uploading {uploadProgress.current} of {uploadProgress.total}
                </div>
                <div className="text-sm text-gray-300">
                  {uploadProgress.currentFile}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  ✅ {uploadProgress.succeeded} succeeded • ❌ {uploadProgress.failed} failed
                </div>
              </div>
            ) : (
              // Default state
              <>
                <div className="text-4xl mb-3">📸</div>
                <div className="text-lg font-semibold mb-2">
                  Click to upload or drag here
                </div>
                <div className="text-sm text-gray-300">
                  Supports JPG, PNG, PDF, HEIC • Select multiple files
                </div>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Link href="/dashboard/receipts" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-sm text-gray-500 mb-1">Total Receipts</div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalReceipts}</div>
        </Link>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">This Month</div>
          <div className="text-3xl font-bold text-gray-900">{stats.thisMonth}</div>
        </div>
        
        <Link href="/dashboard/receipts?status=needs_review" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-sm text-gray-500 mb-1">Needs Review</div>
          <div className="text-3xl font-bold text-orange-600">{stats.pendingReview}</div>
        </Link>

        <UsageStats key={refreshKey} />
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/receipts"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📁</span>
            <div>
              <div className="font-medium text-gray-900">View All Receipts</div>
              <div className="text-sm text-gray-500">Manage and categorize</div>
            </div>
          </Link>
          
          <Link
            href="/dashboard/email-inbox"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📧</span>
            <div>
              <div className="font-medium text-gray-900">Email Inbox</div>
              <div className="text-sm text-gray-500">Review emailed receipts</div>
            </div>
          </Link>
          
          <Link
            href="/dashboard/category-dashboard"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📊</span>
            <div>
              <div className="font-medium text-gray-900">Categories</div>
              <div className="text-sm text-gray-500">View by expense type</div>
            </div>
          </Link>
          
          <Link
            href="/dashboard/tax-codes"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">🧾</span>
            <div>
              <div className="font-medium text-gray-900">Tax Codes</div>
              <div className="text-sm text-gray-500">T2125 summary</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}