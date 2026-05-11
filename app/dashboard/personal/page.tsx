"use client";

// app/dashboard/personal/page.tsx
//
// Client-only view of receipts the user has marked as personal expenses.
// These receipts are excluded from the CRA tax-codes report (they don't
// belong on a business return), but the client still wants to see them
// so they know how much non-business spending they've tracked. Useful
// for personal budgeting and for spotting receipts that were
// accidentally marked personal.
//
// Accountants and firm admins don't get this page — they have a
// Business / Personal filter on the main receipts list instead.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  card_brand: string | null;
  card_last_four: string | null;
};

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "vendor_asc";

export default function PersonalExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [vendorSearch, setVendorSearch] = useState("");

  useEffect(() => {
    (async () => {
      const role = await getUserRole();
      if (role !== "client") {
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);
      try {
        const firmId = await getMyFirmId();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: firmUser } = await supabase
          .from("firm_users")
          .select("client_id")
          .eq("auth_user_id", user.id)
          .eq("firm_id", firmId)
          .maybeSingle();
        if (!firmUser?.client_id) return;

        const { data } = await supabase
          .from("receipts")
          .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, card_brand, card_last_four")
          .eq("firm_id", firmId)
          .eq("client_id", firmUser.client_id)
          .eq("expense_type", "personal")
          .order("receipt_date", { ascending: false })
          .limit(500);

        setReceipts((data as Receipt[]) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This page is only available for client accounts.
        </p>
      </div>
    );
  }

  // Filter + sort the receipts client-side. Vendor search and sort
  // mirror the patterns on /dashboard/receipts so the experience feels
  // consistent.
  const visibleReceipts = useMemo(() => {
    const filtered = receipts.filter(r => {
      if (!vendorSearch.trim()) return true;
      const q = vendorSearch.trim().toLowerCase();
      return (r.vendor || "").toLowerCase().includes(q);
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return (a.receipt_date || "").localeCompare(b.receipt_date || "");
        case "date_desc":
          return (b.receipt_date || "").localeCompare(a.receipt_date || "");
        case "amount_asc":
          return (a.total_cents || 0) - (b.total_cents || 0);
        case "amount_desc":
          return (b.total_cents || 0) - (a.total_cents || 0);
        case "vendor_asc":
          return (a.vendor || "").localeCompare(b.vendor || "");
      }
    });
    return sorted;
  }, [receipts, vendorSearch, sortKey]);

  const total = visibleReceipts.reduce((s, r) => s + (r.total_cents || 0), 0);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          🏠 My Personal Expenses
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Receipts you've marked as personal. These don't appear on your business
          tax reports — they're here for your own tracking.
        </p>

        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total personal{vendorSearch ? " (filtered)" : ""}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">${(total / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400">Receipts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{visibleReceipts.length}</div>
          </div>
        </div>

        {/* Search + sort — mirrors the receipts list so behaviour is
            consistent across the app. */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            placeholder="🔍 Search vendor…"
            className="flex-1 min-w-[200px] text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Largest amount</option>
            <option value="amount_asc">Smallest amount</option>
            <option value="vendor_asc">Vendor (A–Z)</option>
          </select>
        </div>

        {receipts.length === 0 ? (
          <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border p-12 text-center">
            <div className="text-4xl mb-2">🏠</div>
            <p className="text-gray-600 dark:text-gray-400">
              No personal expenses yet. When you mark a receipt as personal in
              its details page, it'll show up here.
            </p>
          </div>
        ) : visibleReceipts.length === 0 ? (
          <div className="bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No personal expenses match the search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleReceipts.map(r => (
              <Link
                key={r.id}
                href={`/dashboard/receipts/${r.id}`}
                className="block p-4 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-accent-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{r.vendor || "Unknown vendor"}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {r.receipt_date || "No date"}
                      {r.card_brand && r.card_last_four ? ` · ${r.card_brand} ****${r.card_last_four}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">${((r.total_cents || 0) / 100).toFixed(2)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
