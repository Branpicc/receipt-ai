"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";

type CategorySummary = {
  category: string;
  count: number;
  total_cents: number;
  tax_cents: number;
};

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  purpose_text: string | null;
};

export default function CategoryDashboardPage() {
  const [summaries, setSummaries] = useState<CategorySummary[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("month");

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();
      
      // Calculate date filter
      let startDate: string | null = null;
      const now = new Date();
      
      if (dateRange === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateRange === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
      } else if (dateRange === "year") {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      // Fetch receipts
      let query = supabase
        .from("receipts")
        .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, purpose_text")
        .eq("firm_id", firmId);
      
      if (startDate) {
        query = query.gte("receipt_date", startDate);
      }

      const { data: receiptsData, error: receiptsError } = await query;
      
      if (receiptsError) throw receiptsError;
      setReceipts(receiptsData || []);

      // Group by category
      const categoryMap = new Map<string, CategorySummary>();
      
      receiptsData?.forEach(r => {
        const category = r.approved_category || r.suggested_category || "Uncategorized";
        const total = r.total_cents || 0;
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            count: 0,
            total_cents: 0,
            tax_cents: 0,
          });
        }
        
        const summary = categoryMap.get(category)!;
        summary.count++;
        summary.total_cents += total;
      });

      // Fetch taxes for all receipts
      const receiptIds = receiptsData?.map(r => r.id) || [];
      const { data: taxesData } = await supabase
        .from("receipt_taxes")
        .select("receipt_id, amount_cents")
        .in("receipt_id", receiptIds);

      // Add tax totals to summaries
      taxesData?.forEach(tax => {
        const receipt = receiptsData?.find(r => r.id === tax.receipt_id);
        if (receipt) {
          const category = receipt.approved_category || receipt.suggested_category || "Uncategorized";
          const summary = categoryMap.get(category);
          if (summary) {
            summary.tax_cents += tax.amount_cents;
          }
        }
      });

      // Convert to array and sort by total
      const summaryArray = Array.from(categoryMap.values()).sort(
        (a, b) => b.total_cents - a.total_cents
      );
      
      setSummaries(summaryArray);
    } catch (err: any) {
      console.error("Failed to load dashboard:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = summaries.reduce((sum, s) => sum + s.total_cents, 0);
  const totalTax = summaries.reduce((sum, s) => sum + s.tax_cents, 0);
  const totalCount = summaries.reduce((sum, s) => sum + s.count, 0);

  const filteredReceipts = selectedCategory
    ? receipts.filter(r => 
        (r.approved_category || r.suggested_category || "Uncategorized") === selectedCategory
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Category Dashboard</h1>
            <p className="text-gray-600 mt-1">View receipts grouped by expense category</p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 underline hover:text-gray-800"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateRange === "month"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRange("quarter")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateRange === "quarter"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => setDateRange("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateRange === "year"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setDateRange("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateRange === "all"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Receipts</div>
            <div className="text-3xl font-bold text-gray-900">{totalCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900">
              ${(totalAmount / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Subtotal: ${((totalAmount - totalTax) / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Tax</div>
            <div className="text-3xl font-bold text-gray-900">
              ${(totalTax / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No receipts found for this period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Categories ({summaries.length})
              </h2>
              <div className="space-y-3">
                {summaries.map((summary) => (
                  <button
                    key={summary.category}
                    onClick={() => setSelectedCategory(
                      selectedCategory === summary.category ? null : summary.category
                    )}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedCategory === summary.category
                        ? "border-black bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {summary.category}
                      </span>
                      <span className="text-sm text-gray-500">
                        {summary.count} receipt{summary.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Total: ${(summary.total_cents / 100).toFixed(2)}
                      </span>
                      <span className="text-gray-500">
                        Tax: ${(summary.tax_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {selectedCategory ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {selectedCategory} ({filteredReceipts.length})
                  </h2>
                  <div className="space-y-3">
                    {filteredReceipts.map((receipt) => (
                      <Link
                        key={receipt.id}
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">
                            {receipt.vendor || "Unknown Vendor"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            ${((receipt.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {receipt.receipt_date || "No date"}
                        </div>
                        {receipt.purpose_text && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {receipt.purpose_text}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  ← Select a category to view receipts
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}