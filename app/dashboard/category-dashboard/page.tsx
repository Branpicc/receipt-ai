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

      const receiptIds = receiptsData?.map(r => r.id) || [];
      const { data: taxesData } = await supabase
        .from("receipt_taxes")
        .select("receipt_id, amount_cents")
        .in("receipt_id", receiptIds);

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
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Category Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">View receipts grouped by expense category</p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 mb-6 border border-transparent dark:border-dark-border">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "month"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRange("quarter")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "quarter"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => setDateRange("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "year"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setDateRange("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "all"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Receipts</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalCount}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalAmount / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Subtotal: ${((totalAmount - totalTax) / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Tax</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalTax / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-12 text-center border border-transparent dark:border-dark-border">
            <p className="text-gray-500 dark:text-gray-400">No receipts found for this period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category List */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                        ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                        : "border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {summary.category}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {summary.count} receipt{summary.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Total: ${(summary.total_cents / 100).toFixed(2)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Tax: ${(summary.tax_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Details */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              {selectedCategory ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {selectedCategory} ({filteredReceipts.length})
                  </h2>
                  <div className="space-y-3">
                    {filteredReceipts.map((receipt) => (
                      <Link
                        key={receipt.id}
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {receipt.vendor || "Unknown Vendor"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${((receipt.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {receipt.receipt_date || "No date"}
                        </div>
                        {receipt.purpose_text && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                            {receipt.purpose_text}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
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