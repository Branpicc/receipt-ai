"use client";

// app/dashboard/reports/home-office/page.tsx
//
// Pro-rated home-office expenses (Line 9945 on T2125). Multiplies the
// client's home_office_percentage by the qualifying receipts (rent,
// utilities, internet, insurance) and shows what flows onto Line 9945.
//
// Note: this does NOT subtract the home-office portion from the original
// utility/rent receipts — accountants typically claim the full amount on
// the corresponding "Office Expenses" / "Telephone & Utilities" lines
// AND separately claim the home-office portion on Line 9945 (the
// home-office portion is then NETTED OUT in the actual T2125 form via
// the home office worksheet). For Receipture's purposes this report
// just shows the dollar value the accountant should plug into the home
// office worksheet.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { useClientContext } from "@/lib/ClientContext";
import ClientFilterDropdown from "@/components/ClientFilterDropdown";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  expense_type: "business" | "personal" | null;
  is_capital_asset: boolean | null;
};

const HOME_OFFICE_CATEGORIES = new Set([
  "Rent & Lease",
  "Telephone & Internet",
  "Utilities",
  "Insurance",
  "Repairs & Maintenance",
]);

export default function HomeOfficeReportPage() {
  const { selectedClient } = useClientContext();
  const [pct, setPct] = useState<number>(0);
  const [rows, setRows] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!selectedClient) {
        setRows([]);
        setPct(0);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const firmId = await getMyFirmId();
        const [clientRes, receiptsRes] = await Promise.all([
          supabase
            .from("clients")
            .select("home_office_percentage")
            .eq("id", selectedClient.id)
            .single(),
          supabase
            .from("receipts")
            .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, expense_type, is_capital_asset")
            .eq("firm_id", firmId)
            .eq("client_id", selectedClient.id)
            .order("receipt_date", { ascending: false }),
        ]);
        setPct(clientRes.data?.home_office_percentage || 0);
        setRows((receiptsRes.data as Receipt[]) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClient]);

  const qualifyingRows = useMemo(() => {
    return rows.filter(r => {
      if (r.expense_type === "personal" || r.is_capital_asset) return false;
      const cat = r.approved_category || r.suggested_category;
      return cat ? HOME_OFFICE_CATEGORIES.has(cat) : false;
    });
  }, [rows]);

  const totalQualifying = qualifyingRows.reduce((s, r) => s + (r.total_cents || 0), 0);
  const homeOfficePortion = Math.round(totalQualifying * (pct / 100));

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏠 Home Office (Line 9945)</h1>
          <Link href="/dashboard/reports" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
            ← Back to Reports
          </Link>
        </div>

        <ClientFilterDropdown />

        {!selectedClient ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              ⚠️ Select a client above to view their home office calculation.
            </p>
          </div>
        ) : loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : pct === 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              This client doesn't have a home office percentage set. Update it in
              Settings &rarr; Profile to enable Line 9945 deductions.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Home office %</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{pct}%</div>
              </div>
              <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total qualifying expenses</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">${(totalQualifying / 100).toFixed(2)}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="text-xs text-green-700 dark:text-green-300">Home office deduction (Line 9945)</div>
                <div className="text-xl font-bold text-green-700 dark:text-green-400">${(homeOfficePortion / 100).toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Qualifying categories: rent, utilities, telephone & internet,
                insurance, and repairs & maintenance. The home-office portion
                ({pct}% of these) goes on T2125 Line 9945. Personal receipts
                and capital assets are excluded.
              </p>
            </div>

            {qualifyingRows.length === 0 ? (
              <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No qualifying receipts yet. Receipts categorized as Rent,
                  Utilities, Telephone & Internet, Insurance, or Repairs &
                  Maintenance will show up here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Vendor</th>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">{pct}% home office</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualifyingRows.map(r => {
                      const t = r.total_cents || 0;
                      const portion = Math.round(t * (pct / 100));
                      return (
                        <tr key={r.id} className="border-b border-gray-100 dark:border-dark-border">
                          <td className="p-3 text-gray-600 dark:text-gray-400">{r.receipt_date || "—"}</td>
                          <td className="p-3">
                            <Link href={`/dashboard/receipts/${r.id}`} className="text-accent-600 dark:text-accent-400 hover:underline">
                              {r.vendor || "Unknown vendor"}
                            </Link>
                          </td>
                          <td className="p-3 text-gray-700 dark:text-gray-300 text-xs">
                            {r.approved_category || r.suggested_category || "—"}
                          </td>
                          <td className="p-3 text-right text-gray-700 dark:text-gray-300">${(t / 100).toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-green-700 dark:text-green-400">${(portion / 100).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
