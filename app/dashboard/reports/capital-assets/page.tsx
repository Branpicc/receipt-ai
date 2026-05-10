"use client";

// app/dashboard/reports/capital-assets/page.tsx
//
// Lists every receipt currently marked as a capital asset. Receipts here
// are excluded from the regular CRA Tax Codes report (they belong on the
// CCA schedule instead). Accountants use this list to populate Areas A–F
// on the T2125 / T776 manually — Receipture doesn't run the CCA math
// itself.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { useClientContext } from "@/lib/ClientContext";
import ClientFilterDropdown from "@/components/ClientFilterDropdown";
import { suggestCcaClass } from "@/lib/capitalAsset";

type Row = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  cca_class: string | null;
  client_id: string;
};

export default function CapitalAssetsReportPage() {
  const { selectedClient } = useClientContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const firmId = await getMyFirmId();
        let q = supabase
          .from("receipts")
          .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, cca_class, client_id")
          .eq("firm_id", firmId)
          .eq("is_capital_asset", true)
          .order("receipt_date", { ascending: false });
        if (selectedClient) q = q.eq("client_id", selectedClient.id);
        const { data } = await q;
        setRows((data as Row[]) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClient]);

  const total = rows.reduce((s, r) => s + (r.total_cents || 0), 0);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🏗️ Capital Assets (CCA)
          </h1>
          <Link href="/dashboard/reports" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
            ← Back to Reports
          </Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Receipts marked as capital assets. These don't appear on the regular
          CRA Tax Codes report — they need to be depreciated using Capital Cost
          Allowance on T2125 Areas A–F (or the equivalent on T776 / employment
          forms). Receipture lists the items and a suggested CCA class; the
          accountant runs the depreciation math.
        </p>

        <ClientFilterDropdown />

        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total cost</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">${(total / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400">Items</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{rows.length}</div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border p-12 text-center">
            <div className="text-4xl mb-2">🏗️</div>
            <p className="text-gray-600 dark:text-gray-400">
              No capital assets yet. Open any receipt and toggle "Capital asset"
              when it's a long-lived purchase ($500+) like equipment, computers
              or vehicles.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Vendor</th>
                  <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Suggested CCA Class</th>
                  <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover">
                    <td className="p-3 text-gray-600 dark:text-gray-400">{r.receipt_date || "—"}</td>
                    <td className="p-3">
                      <Link href={`/dashboard/receipts/${r.id}`} className="text-accent-600 dark:text-accent-400 hover:underline">
                        {r.vendor || "Unknown vendor"}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 text-xs">
                      {r.cca_class || suggestCcaClass(r.approved_category || r.suggested_category) || "—"}
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">${((r.total_cents || 0) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
