"use client";

// app/dashboard/tax-codes/page.tsx
//
// CRA tax-code mapping is deferred until v2 — accountants want to apply
// their own rules in QuickBooks/Sage rather than rely on auto-mapping,
// and personal users mostly file through TurboTax which walks them
// through per-category. We keep the route alive so old links don't 404,
// but it just renders a "coming soon" page that points users at the
// features that still work (Categories dashboard for spend grouping,
// Net Income for self-employed totals, Master Excel export for raw
// data their tax preparer can apply line codes to).
//
// The original tax-codes implementation is preserved in git history if
// we re-enable it later. Per-receipt category, deductible math, and
// recoverable-tax calculations still run unchanged in
// lib/computeReceiptDeductible.ts — they just aren't surfaced on this
// page anymore.

import Link from "next/link";
import {
  Receipt as ReceiptIcon,
  FolderOpen,
  DollarSign,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

export default function TaxCodesComingSoonPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                CRA Tax Codes — coming soon
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Per-line T2125 / T776 / T2200 mapping
              </p>
            </div>
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-6">
            We&apos;re holding this feature back until it&apos;s been validated by
            real accountants. In the meantime, your receipts are still being
            categorized (Meals, Office Supplies, Travel, etc.) and the
            deductible math still runs — so your reports below stay accurate.
            When tax-code mapping ships, the categories you&apos;ve already
            assigned will roll into the right CRA lines automatically.
          </p>

          <div className="space-y-2 mb-6">
            <Link
              href="/dashboard/category-dashboard"
              className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4" /> Categories &amp; Deductibles
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Spending grouped by category — what you actually need for tax prep
              </div>
            </Link>
            <Link
              href="/dashboard/reports/net-income"
              className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Monthly Net Income
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Revenue minus deductibles by month (self-employed)
              </div>
            </Link>
            <Link
              href="/dashboard/reports"
              className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Master Excel Export
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Every receipt, every category, ready for QuickBooks or your tax preparer
              </div>
            </Link>
            <Link
              href="/dashboard/receipts"
              className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <ReceiptIcon className="w-4 h-4" /> All Receipts
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Browse and search every receipt
              </div>
            </Link>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Want early access when tax-code mapping ships? Email us at{" "}
            <a href="mailto:brandanpicc@receipture.ca" className="text-accent-600 dark:text-accent-400 underline">
              brandanpicc@receipture.ca
            </a>{" "}
            and we&apos;ll loop you in.
          </p>
        </div>
      </div>
    </div>
  );
}
