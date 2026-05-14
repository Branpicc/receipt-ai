"use client";

// app/dashboard/reports/quarterly-hst/page.tsx
//
// Calendar-quarter breakdown of recoverable GST/HST (Input Tax Credits)
// per client. Used to support the GST/HST return filing — accountants
// pull this when computing the ITC line on the GST/HST return.
//
// Note: this only shows ITCs PAID (= GST/HST you can claim back). To
// compute the actual remittance you'd subtract this from GST/HST
// COLLECTED on revenue. Receipture doesn't track collected sales tax
// today — that needs invoicing data the platform doesn't have. Banner
// at the top of the report says so.

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

type QuarterRow = {
  year: number;
  quarter: number;
  itcs_cents: number;
  business_cents: number;
  receipt_count: number;
};

export default function QuarterlyHstReportPage() {
  const { selectedClient, isPersonal } = useClientContext();
  const [profile, setProfile] = useState<{ province: string; gst_hst_registered: boolean }>({
    province: "ON",
    gst_hst_registered: false,
  });
  const [rows, setRows] = useState<Receipt[]>([]);
  const [items, setItems] = useState<Map<string, DeductibleLineItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!selectedClient) {
        setRows([]);
        setProfile({ province: "ON", gst_hst_registered: false });
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const firmId = await getMyFirmId();
        const [clientRes, receiptsRes] = await Promise.all([
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
        ]);
        setProfile({
          province: clientRes.data?.province || "ON",
          gst_hst_registered: !!clientRes.data?.gst_hst_registered,
        });
        const receipts = (receiptsRes.data as Receipt[]) || [];
        setRows(receipts);

        const ids = receipts.map(r => r.id);
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

  const quarterRows = useMemo<QuarterRow[]>(() => {
    const buckets = new Map<string, QuarterRow>();
    rows.forEach(r => {
      if (r.expense_type === "personal" || r.is_capital_asset) return;
      if (!r.receipt_date) return;
      const d = new Date(r.receipt_date);
      const year = d.getFullYear();
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      const key = `${year}-Q${quarter}`;
      const cat = r.approved_category || r.suggested_category;
      const taxCode = cat ? getTaxCodeForCategory(cat, "T2125") : null;
      const result = computeReceiptDeductible(
        r,
        items.get(r.id) || [],
        profile,
        taxCode
      );
      if (result.business_cents <= 0) return;

      const existing = buckets.get(key) || {
        year,
        quarter,
        itcs_cents: 0,
        business_cents: 0,
        receipt_count: 0,
      };
      existing.itcs_cents += result.recoverable_tax_cents;
      existing.business_cents += result.business_cents;
      existing.receipt_count += 1;
      buckets.set(key, existing);
    });
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }, [rows, items, profile]);

  const totalItcs = quarterRows.reduce((s, q) => s + q.itcs_cents, 0);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📅 Quarterly HST/GST</h1>
          <Link href="/dashboard/reports" className="text-sm text-accent-600 dark:text-accent-400 hover:underline">
            ← Back to Reports
          </Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Input Tax Credits (ITCs) the client paid each calendar quarter.
          Subtract these from GST/HST collected on revenue to compute the
          remittance for that quarter's GST/HST return.
        </p>

        <ClientFilterDropdown />

        {!selectedClient ? (
          isPersonal ? (
            // Personal accounts auto-resolve their lone client — show a
            // loader during the brief async window instead of the
            // "pick a client" firm warning.
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️ Select a client above to see their quarterly HST/GST breakdown.
              </p>
            </div>
          )
        ) : !profile.gst_hst_registered ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              This client is not registered for GST/HST, so there are no
              Input Tax Credits to report. Update the registration status in
              the client's settings if that's incorrect.
            </p>
          </div>
        ) : loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total ITCs</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">${(totalItcs / 100).toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">Quarters</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{quarterRows.length}</div>
              </div>
            </div>

            {quarterRows.length === 0 ? (
              <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">No qualifying receipts in any quarter yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Quarter</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Receipts</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Business expense (pre-tax)</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">ITCs claimable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterRows.map((q, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-dark-border">
                        <td className="p-3 text-gray-900 dark:text-white font-medium">{q.year} Q{q.quarter}</td>
                        <td className="p-3 text-right text-gray-700 dark:text-gray-300">{q.receipt_count}</td>
                        <td className="p-3 text-right text-gray-700 dark:text-gray-300">${(q.business_cents / 100).toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold text-green-700 dark:text-green-400">${(q.itcs_cents / 100).toFixed(2)}</td>
                      </tr>
                    ))}
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
