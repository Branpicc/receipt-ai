"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";
import { checkReceiptUploadLimit } from "@/lib/checkUsageLimits";
import UsageStats from "@/components/UsageStats";

export default function DashboardHomePage() {
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add this to trigger UsageStats reload
  const [stats, setStats] = useState({
    totalReceipts: 0,
    thisMonth: 0,
    pendingReview: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const firmId = await getMyFirmId();
      
      // Total receipts
      const { count: total } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId);

      // This month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: thisMonth } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .gte("created_at", startOfMonth.toISOString());

      // Pending review
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

  async function handleUpload(file: File) {
    try {
      setUploading(true);
      const firmId = await getMyFirmId();

      // Check usage limits BEFORE uploading
      const usageCheck = await checkReceiptUploadLimit(firmId);
      
      if (!usageCheck.canUpload) {
        alert(usageCheck.message || "Upload limit reached");
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

      const client = clients[0];

      // Use API route instead of direct Supabase
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
        // If JSON parsing fails but upload succeeded, consider it success
        console.warn("Response was not JSON, but upload may have succeeded");
        alert("✅ Receipt uploaded successfully!");
        loadStats();
        setRefreshKey(prev => prev + 1); // Trigger UsageStats reload
        return;
      }

      alert("✅ Receipt uploaded successfully!");
      loadStats();
      setRefreshKey(prev => prev + 1); // Trigger UsageStats reload
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Upload Hero Section */}
      <div className="bg-gradient-to-br from-black to-gray-800 rounded-xl p-6 mb-8 text-white">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold mb-2">Upload Receipt</h2>
          <p className="text-gray-300 mb-6">
            Drag and drop a receipt image or PDF, and our AI will extract all the details automatically.
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
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <div className="text-4xl mb-3">{uploading ? "⏳" : "📸"}</div>
            <div className="text-lg font-semibold mb-2">
              {uploading ? "Uploading..." : "Click to upload or drag here"}
            </div>
            <div className="text-sm text-gray-300">
              Supports JPG, PNG, PDF, HEIC
            </div>
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
        
        <Link href="/dashboard/receipts" className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
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