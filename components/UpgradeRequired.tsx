"use client";

// components/UpgradeRequired.tsx
//
// Shown when a Starter-tier user navigates to a Pro+ gated route, or when
// a Pro+ section is rendered inside a page (`inline` mode).
//
// Two render modes:
//   • Default (full page): use as the entire page body when wrapping a
//     gated route. Sells the upgrade and links to the billing page.
//   • inline: renders a compact bordered card useful for hiding a
//     sub-section inside an otherwise-accessible page (e.g. flags / cards
//     / edits tabs inside the client detail profile).
//
// The component itself doesn't fetch the plan — the caller decides whether
// to render it. This keeps it pure and testable.

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { FEATURE_META, type Feature } from "@/lib/featureGates";

type Props = {
  feature: Feature;
  inline?: boolean;
};

export default function UpgradeRequired({ feature, inline = false }: Props) {
  const meta = FEATURE_META[feature];

  if (inline) {
    return (
      <div className="rounded-xl border border-dashed border-accent-300 dark:border-accent-700 bg-accent-50/50 dark:bg-accent-900/10 p-5 text-center">
        <Sparkles className="w-6 h-6 mx-auto text-accent-600 dark:text-accent-400 mb-2" />
        <p className="font-semibold text-gray-900 dark:text-white text-sm">
          {meta.label} — Professional plan
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-md mx-auto">
          {meta.pitch}
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-block mt-3 px-4 py-1.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Upgrade to Professional →
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-7 h-7 text-accent-600 dark:text-accent-400" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent-600 dark:text-accent-400 mb-2">
          Professional plan
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {meta.label}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {meta.pitch}
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-block px-6 py-3 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-xl transition-colors"
        >
          Upgrade to Professional
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Includes everything in Starter, plus advanced reports, edit history, budget tracking, and rich client profiles.
        </p>
      </div>
    </div>
  );
}
