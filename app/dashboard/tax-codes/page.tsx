"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { CRA_TAX_CODES, getTaxCodeForCategory, type TaxCode } from "../../../lib/taxCodes";
import Link from "next/link";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
};

type TaxCodeSummary = {
  taxCode: TaxCode;
  receipts: Receipt[];
  total_cents: number;
  tax_cents: number;
  deductible_cents: number;
};

export default function TaxCodesPage() {
  const [summaries, setSummaries] = useState<TaxCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("year");

  useEffect(() => {
    loadTaxCodes();
  }, [dateRange]);

  async function loadTaxCodes() {
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

      // Fetch receipts with categories
      let query = supabase
        .from("receipts")
        .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category")
        .eq("firm_id", firmId)
        .not("approved_category", "is", null)
        .not("suggested_category", "is", null);
      
      if (startDate) {
        query = query.gte("receipt_date", startDate);
      }

      const { data: receiptsData, error: receiptsError } = await query;
      
      if (receiptsError) throw receiptsError;

      // Fetch taxes
      const receiptIds = receiptsData?.map(r => r.id) || [];
      const { data: taxesData } = await supabase
        .from("receipt_taxes")
        .select("receipt_id, amount_cents")
        .in("receipt_id", receiptIds);

      // Create tax map
      const taxMap = new Map<string, number>();
      taxesData?.forEach(t => {
        taxMap.set(t.receipt_id, (taxMap.get(t.receipt_id) || 0) + t.amount_cents);
      });

      // Group receipts by tax code
      const taxCodeMap = new Map<string, TaxCodeSummary>();

      CRA_TAX_CODES.forEach(tc => {
        taxCodeMap.set(tc.code, {
          taxCode: tc,
          receipts: [],
          total_cents: 0,
          tax_cents: 0,
          deductible_cents: 0,
        });
      });

      receiptsData?.forEach(receipt => {
        const category = receipt.approved_category || receipt.suggested_category;
        if (!category) return;

        const taxCode = getTaxCodeForCategory(category);
        if (!taxCode) {
          // Map to "Other Expenses" if no specific code
          const otherCode = CRA_TAX_CODES.find(tc => tc.code === "9936");
          if (otherCode) {
            const summary = taxCodeMap.get(otherCode.code)!;
            summary.receipts.push(receipt);
            const total = receipt.total_cents || 0;
            const tax = taxMap.get(receipt.id) || 0;
            summary.total_cents += total;
            summary.tax_cents += tax;
            summary.deductible_cents += Math.round(
              (total - tax) * (otherCode.deductible_percent / 100)
            );
          }
        } else {
          const summary = taxCodeMap.get(taxCode.code)!;
          summary.receipts.push(receipt);
          const total = receipt.total_cents || 0;
          const tax = taxMap.get(receipt.id) || 0;
          summary.total_cents += total;
          summary.tax_cents += tax;
          summary.deductible_cents += Math.round(
            (total - tax) * (taxCode.deductible_percent / 100)
          );
        }
      });

      // Convert to array and filter out empty codes
      const summaryArray = Array.from(taxCodeMap.values())
        .filter(s => s.receipts.length > 0)
        .sort((a, b) => b.deductible_cents - a.deductible_cents);
      
      setSummaries(summaryArray);
    } catch (err: any) {
      console.error("Failed to load tax codes:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalDeductible = summaries.reduce((sum, s) => sum + s.deductible_cents, 0);
  const totalAmount = summaries.reduce((sum, s) => sum + s.total_cents, 0);
  const totalTax = summaries.reduce((sum, s) => sum + s.tax_cents, 0);

  function exportT2125() {
    let csv = "CRA Tax Code,Line Number,Description,Amount,Deductible Amount\n";
    
    summaries.forEach(s => {
      csv += `${s.taxCode.code},${s.taxCode.line},"${s.taxCode.name}",${(s.total_cents / 100).toFixed(2)},${(s.deductible_cents / 100).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `T2125-tax-summary-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CRA Tax Codes (T2125)</h1>
            <p className="text-gray-600 mt-1">Expenses grouped by Canada Revenue Agency tax codes</p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 underline hover:text-gray-800"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
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

          <button
            onClick={exportT2125}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            disabled={summaries.length === 0}
          >
            📥 Export T2125 Summary
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Expenses</div>
            <div className="text-3xl font-bold text-gray-900">
              ${(totalAmount / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Deductible</div>
            <div className="text-3xl font-bold text-green-600">
              ${(totalDeductible / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              After 50% meal deduction
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">GST/HST Paid</div>
            <div className="text-3xl font-bold text-gray-900">
              ${(totalTax / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Input Tax Credits
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading tax codes...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No categorized receipts found for this period</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <div
                key={summary.taxCode.code}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-gray-900">
                        {summary.taxCode.line}
                      </span>
                      <span className="text-lg font-semibold text-gray-700">
                        {summary.taxCode.name}
                      </span>
                      {summary.taxCode.deductible_percent < 100 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                          {summary.taxCode.deductible_percent}% deductible
                        </span>
                      )}
                      {summary.taxCode.gst_eligible && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          GST/HST eligible
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {summary.taxCode.description}
                    </p>
                    <div className="text-sm text-gray-500">
                      Categories: {summary.taxCode.categories.join(", ") || "Other"}
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-gray-900">
                      ${(summary.total_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-green-600 font-semibold">
                      Deductible: ${(summary.deductible_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {summary.receipts.length} receipt{summary.receipts.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Receipt List */}
                <details className="mt-4">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    View receipts ({summary.receipts.length})
                  </summary>
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                    {summary.receipts.map(receipt => (
                      <Link
                        key={receipt.id}
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {receipt.vendor || "Unknown"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            ${((receipt.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {receipt.receipt_date || "No date"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}