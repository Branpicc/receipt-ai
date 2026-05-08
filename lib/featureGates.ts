// lib/featureGates.ts
//
// Single source of truth for tier-based feature gating. Read by both the
// sidebar (to hide nav items) and route guards (to show an upgrade page if
// a Starter-tier user navigates directly).
//
// Plan source: firms.subscription_plan ("starter" | "professional" |
// "enterprise"). Note that subscription_tier may be "trial" while a user is
// inside their 7-day trial — gating uses the underlying paid plan instead,
// so a Starter trial sees Starter features, an Enterprise trial sees
// Enterprise features.

export type Plan = "starter" | "professional" | "enterprise" | "free" | null | undefined;

// All gates are boolean: a feature is either available on a plan or not.
// Keep the keys human-readable so the upgrade page can use them as IDs.
export type Feature =
  | "budget_tracking"          // /dashboard/budget-settings
  | "edit_history"             // /dashboard/reports/edits
  | "client_reports"           // /dashboard/reports/clients (firm view) and /dashboard/client/reports (client view)
  | "advanced_reports"         // /dashboard/firm-admin (analytics) and other advanced report views
  | "client_detail_profile";   // rich Pro+ sections inside /dashboard/clients/[clientId]

const PRO_PLUS = new Set(["professional", "enterprise"]);

export function hasFeature(plan: Plan, feature: Feature): boolean {
  // Treat unknown / null as the most-restrictive tier. We never silently
  // unlock features for a missing plan.
  if (!plan) return false;

  switch (feature) {
    case "budget_tracking":
    case "edit_history":
    case "client_reports":
    case "advanced_reports":
    case "client_detail_profile":
      return PRO_PLUS.has(plan);
  }
}

// Human-friendly metadata used by the upgrade page. Keep messaging short
// and aimed at the value of the upgrade, not the limitation.
export const FEATURE_META: Record<Feature, { label: string; pitch: string }> = {
  budget_tracking: {
    label: "Budget tracking & alerts",
    pitch: "Set per-category spending budgets for your clients and get notified when they're approaching the limit.",
  },
  edit_history: {
    label: "Edit history & audit trail",
    pitch: "Keep a complete record of every change made to a receipt — who edited it, what they changed, and when.",
  },
  client_reports: {
    label: "Monthly client reports",
    pitch: "Auto-generated monthly summaries with category breakdowns, budget comparisons, and AI-written insights for each client.",
  },
  advanced_reports: {
    label: "Advanced reports & analytics",
    pitch: "Firm-wide spend analytics, cross-client comparisons, accountant performance, and exportable reports.",
  },
  client_detail_profile: {
    label: "Rich client profiles",
    pitch: "Per-client receipt flags, card tracking, edit audits, and detailed spend insights inside each client profile.",
  },
};
