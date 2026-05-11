"use client";

// components/ClientNetIncomeCard.tsx
//
// Compact monthly revenue + deductibles + net income summary for the
// client dashboard. Shows the last 6 months. Uses the same
// computeReceiptDeductible helper as the Net Income report so the
// numbers match what the accountant sees in /dashboard/reports/net-income.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { computeReceiptDeductible, type DeductibleLineItem } from "@/lib/computeReceiptDeductible";
import { getTaxCodeForCategory } from "@/lib/taxCodes";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

type Row = { year: number; month: number; revenue_cents: number; deductible_cents: number };

export default function ClientNetIncomeCard({ clientId }: { clientId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      try {
        const [profileRes, receiptsRes, revenueRes] = await Promise.all([
          supabase
            .from("clients")
            .select("province, gst_hst_registered")
            .eq("id", clientId)
            .single(),
          supabase
            .from("receipts")
            .select("id, receipt_date, total_cents, approved_category, suggested_category, expense_type, business_percentage, is_capital_asset")
            .eq("client_id", clientId)
            .not("receipt_date", "is", null),
          supabase
            .from("client_monthly_revenue")
            .select("year, month, revenue_cents")
            .eq("client_id", clientId),
        ]);

        const profile = {
          province: profileRes.data?.province || "ON",
          gst_hst_registered: !!profileRes.data?.gst_hst_registered,
        };
        const receipts = (receiptsRes.data as Receipt[]) || [];

        // Pull line items in one query, keyed by receipt_id.
        const itemMap = new Map<string, DeductibleLineItem[]>();
        const ids = receipts.map(r => r.id);
        if (ids.length > 0) {
          const { data: items } = await supabase
            .from("receipt_items")
            .select("receipt_id, total_cents, expense_type")
            .in("receipt_id", ids);
          (items || []).forEach((li: any) => {
            const arr = itemMap.get(li.receipt_id) || [];
            arr.push({ total_cents: li.total_cents, expense_type: li.expense_type });
            itemMap.set(li.receipt_id, arr);
          });
        }

        // Seed buckets from revenue rows so months with revenue but no
        // expenses still appear.
        const buckets = new Map<string, Row>();
        ((revenueRes.data as { year: number; month: number; revenue_cents: number }[]) || []).forEach(r => {
          buckets.set(`${r.year}-${r.month}`, {
            year: r.year, month: r.month,
            revenue_cents: r.revenue_cents,
            deductible_cents: 0,
          });
        });

        receipts.forEach(r => {
          if (r.expense_type === "personal" || r.is_capital_asset) return;
          const d = new Date(r.receipt_date!);
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const key = `${year}-${month}`;
          const cat = r.approved_category || r.suggested_category;
          const taxCode = cat ? getTaxCodeForCategory(cat, "T2125") : null;
          const result = computeReceiptDeductible(r, itemMap.get(r.id) || [], profile, taxCode);
          if (result.deductible_cents <= 0) return;
          const existing = buckets.get(key) || { year, month, revenue_cents: 0, deductible_cents: 0 };
          existing.deductible_cents += result.deductible_cents;
          buckets.set(key, existing);
        });

        const sorted = Array.from(buckets.values()).sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
        // Cap to the last 6 months so the dashboard card stays compact.
        setRows(sorted.slice(0, 6));
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (!clientId) return null;

  const totalRevenue = rows.reduce((s, r) => s + r.revenue_cents, 0);
  const totalDeductible = rows.reduce((s, r) => s + r.deductible_cents, 0);
  const totalNet = totalRevenue - totalDeductible;

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          📈 Monthly Net Income
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Last 6 months</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No revenue or deductibles tracked yet. Enter last month&apos;s revenue above and your net income will start showing here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Revenue</div>
              <div className="font-semibold text-gray-900 dark:text-white">${(totalRevenue / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Deductibles</div>
              <div className="font-semibold text-gray-900 dark:text-white">${(totalDeductible / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Net income</div>
              <div className={`font-semibold ${totalNet >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                ${(totalNet / 100).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {rows.map(r => {
              const net = r.revenue_cents - r.deductible_cents;
              return (
                <div key={`${r.year}-${r.month}`} className="flex items-center justify-between text-xs py-2 border-t border-gray-100 dark:border-dark-border">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{MONTHS[r.month - 1]} {r.year}</span>
                  <div className="flex gap-4 text-right">
                    <span className="text-gray-500 dark:text-gray-400 w-20">
                      <span className="block text-[10px]">Revenue</span>
                      <span>${(r.revenue_cents / 100).toFixed(2)}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 w-20">
                      <span className="block text-[10px]">Deductibles</span>
                      <span>${(r.deductible_cents / 100).toFixed(2)}</span>
                    </span>
                    <span className={`w-20 ${net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      <span className="block text-[10px]">Net</span>
                      <span className="font-semibold">${(net / 100).toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
