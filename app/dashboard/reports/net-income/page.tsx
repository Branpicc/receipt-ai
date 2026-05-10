"use client";

// app/dashboard/reports/net-income/page.tsx
//
// Per-month net business income for a client: revenue (entered manually
// since Receipture doesn't have invoicing data) minus the total
// deductible expenses computed the same way the CRA Tax Codes report
// does. Lets the firm see month-by-month profitability and feeds the
// number that flows onto T1 / T2125.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { useClientContext } from "@/lib/ClientContext";
import ClientFilterDropdown from "@/components/ClientFilterDropdown";
import { computeReceiptDeductible, type DeductibleLineItem } from "@/lib/computeReceiptDeductible";
import { getTaxCodeForCategory } from "@/lib/taxCodes";

type Receipt = {
  id: string;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  expense_type: "business" | "personal" | null;
  business_percentage: number | null;
  is_capital_asset: boolean | null;
};

type RevenueRow = { year: number; month: number; revenue_cents: number };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function NetIncomeReportPage() {
  const { selectedClient } = useClientContext();
  const [profile, setProfile] = useState<{ province: string; gst_hst_registered: boolean }>({ province: "ON", gst_hst_registered: false });
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [items, setItems] = useState<Map<string, DeductibleLineItem[]>>(new Map());
  const [revenue, setRevenue] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [revenueDraft, setRevenueDraft] = useState<string>("");
  const [savingMonth, setSavingMonth] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!selectedClient) {
        setReceipts([]);
        setRevenue(new Map());
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const firmId = await getMyFirmId();
        const [clientRes, receiptsRes, revenueRes] = await Promise.all([
          supabase
            .from("clients")
            .select("province, gst_hst_registered")
            .eq("id", selectedClient.id)
            .single(),
          supabase
            .from("receipts")
            .select("id, receipt_date, total_cents, approved_category, suggested_category, expense_type, business_percentage, is_capital_asset")
            .eq("firm_id", firmId)
            .eq("client_id", selectedClient.id)
            .not("receipt_date", "is", null)
            .order("receipt_date", { ascending: false }),
          supabase
            .from("client_monthly_revenue")
            .select("year, month, revenue_cents")
            .eq("client_id", selectedClient.id),
        ]);
        setProfile({
          province: clientRes.data?.province || "ON",
          gst_hst_registered: !!clientRes.data?.gst_hst_registered,
        });
        const rs = (receiptsRes.data as Receipt[]) || [];
        setReceipts(rs);

        const revMap = new Map<string, number>();
        ((revenueRes.data as RevenueRow[]) || []).forEach(r => {
          revMap.set(ymKey(r.year, r.month), r.revenue_cents);
        });
        setRevenue(revMap);

        const ids = rs.map(r => r.id);
        if (ids.length > 0) {
          const { data: itemsData } = await supabase
            .from("receipt_items")
            .select("receipt_id, total_cents, expense_type")
            .in("receipt_id", ids);
          const map = new Map<string, DeductibleLineItem[]>();
          (itemsData || []).forEach((li: any) => {
            const arr = map.get(li.receipt_id) || [];
            arr.push({ total_cents: li.total_cents, expense_type: li.expense_type });
            map.set(li.receipt_id, arr);
          });
          setItems(map);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClient]);

  type Row = { year: number; month: number; deductible_cents: number; revenue_cents: number };
  const rows = useMemo<Row[]>(() => {
    const buckets = new Map<string, Row>();

    // Pre-seed buckets for every month that has revenue, so months with
    // revenue but no expenses still show up.
    revenue.forEach((rev, key) => {
      const [y, m] = key.split("-").map(Number);
      buckets.set(key, { year: y, month: m, deductible_cents: 0, revenue_cents: rev });
    });

    receipts.forEach(r => {
      if (r.expense_type === "personal" || r.is_capital_asset) return;
      if (!r.receipt_date) return;
      const d = new Date(r.receipt_date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = ymKey(year, month);
      const cat = r.approved_category || r.suggested_category;
      const taxCode = cat ? getTaxCodeForCategory(cat, "T2125") : null;
      const result = computeReceiptDeductible(r, items.get(r.id) || [], profile, taxCode);
      if (result.deductible_cents <= 0) return;

      const existing = buckets.get(key) || {
        year, month, deductible_cents: 0, revenue_cents: revenue.get(key) || 0,
      };
      existing.deductible_cents += result.deductible_cents;
      buckets.set(key, existing);
    });

    return Array.from(buckets.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [receipts, items, revenue, profile]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue_cents, 0);
  const totalDeductible = rows.reduce((s, r) => s + r.deductible_cents, 0);
  const netIncome = totalRevenue - totalDeductible;

  async function saveRevenue(year: number, month: number, dollars: string) {
    if (!selectedClient) return;
    const cents = Math.round((parseFloat(dollars.replace(/[^0-9.]/g, "")) || 0) * 100);
    const key = ymKey(year, month);
    setSavingMonth(key);
    try {
      const firmId = await getMyFirmId();
      // Upsert by (client_id, year, month) — uses the unique constraint
      // we added in the migration.
      const { error } = await supabase
        .from("client_monthly_revenue")
        .upsert(
          {
            client_id: selectedClient.id,
            firm_id: firmId,
            year,
            month,
            revenue_cents: cents,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,year,month" }
        );
      if (error) throw error;
      const next = new Map(revenue);
      next.set(key, cents);
      setRevenue(next);
      setEditingMonth(null);
    } catch (err: any) {
      alert("Couldn't save revenue: " + err.message);
    } finally {
      setSavingMonth(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💰 Net Income Summary</h1>
          <Link href="/dashboard/reports" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
            ← Back to Reports
          </Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Monthly revenue minus deductible business expenses. Receipture doesn't
          have invoicing data, so revenue is entered manually — click any
          month's revenue to edit it.
        </p>

        <ClientFilterDropdown />

        {!selectedClient ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              ⚠️ Select a client above to view their net income summary.
            </p>
          </div>
        ) : loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total revenue</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">${(totalRevenue / 100).toFixed(2)}</div>
              </div>
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total deductibles</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">${(totalDeductible / 100).toFixed(2)}</div>
              </div>
              <div className={`rounded-xl border p-4 ${netIncome >= 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
                <div className="text-xs text-gray-700 dark:text-gray-300">Net business income</div>
                <div className={`text-xl font-bold ${netIncome >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>${(netIncome / 100).toFixed(2)}</div>
              </div>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Month</th>
                    <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Revenue</th>
                    <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Deductibles</th>
                    <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Net income</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-gray-500 dark:text-gray-400">
                        No revenue or deductibles recorded yet. Click a month's
                        revenue below (after adding receipts) to enter income.
                      </td>
                    </tr>
                  ) : rows.map((r) => {
                    const key = ymKey(r.year, r.month);
                    const net = r.revenue_cents - r.deductible_cents;
                    const isEditing = editingMonth === key;
                    return (
                      <tr key={key} className="border-b border-gray-100 dark:border-dark-border">
                        <td className="p-3 text-gray-900 dark:text-white font-medium">{MONTH_NAMES[r.month - 1]} {r.year}</td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-gray-500">$</span>
                              <input
                                type="text"
                                value={revenueDraft}
                                onChange={(e) => setRevenueDraft(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRevenue(r.year, r.month, revenueDraft);
                                  if (e.key === "Escape") setEditingMonth(null);
                                }}
                                className="w-24 text-right border border-gray-300 dark:border-dark-border rounded px-2 py-1 bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => saveRevenue(r.year, r.month, revenueDraft)}
                                disabled={savingMonth === key}
                                className="text-xs px-2 py-1 bg-accent-500 hover:bg-accent-600 text-white rounded disabled:opacity-50"
                              >
                                {savingMonth === key ? "…" : "Save"}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingMonth(key); setRevenueDraft(((r.revenue_cents) / 100).toFixed(2)); }}
                              className="text-gray-700 dark:text-gray-300 hover:text-accent-600 dark:hover:text-accent-400 underline"
                            >
                              ${(r.revenue_cents / 100).toFixed(2)}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-right text-gray-700 dark:text-gray-300">${(r.deductible_cents / 100).toFixed(2)}</td>
                        <td className={`p-3 text-right font-semibold ${net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>${(net / 100).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
