"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { extractReceiptData } from "@/lib/extractReceiptData";
import { categorizeReceipt } from "@/lib/categorizeReceipt";
import Link from "next/link";

export default function DashboardHomePage() {
  const [uploading, setUploading] = useState(false);
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
      loadStats();
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
      <div className="bg-gradient-to-br from-black to-gray-800 rounded-2xl p-8 mb-8 text-white">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-2">Upload Receipt</h2>
          <p className="text-gray-300 mb-6">
            Drag and drop a receipt image or PDF, and our AI will extract all the details automatically.
          </p>
          
          <label
            htmlFor="hero-upload"
            className={`block border-2 border-dashed border-gray-400 rounded-xl p-8 text-center cursor-pointer hover:border-white hover:bg-white/10 transition-all ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="file"
              id="hero-upload"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <div className="text-6xl mb-4">{uploading ? "⏳" : "📸"}</div>
            <div className="text-lg font-semibold mb-2">
              {uploading ? "Uploading..." : "Click to upload or drag here"}
            </div>
            <div className="text-sm text-gray-300">
              Supports JPG, PNG, PDF
            </div>
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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