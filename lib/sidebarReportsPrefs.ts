"use client";

// lib/sidebarReportsPrefs.ts
//
// Per-user preference for which tax reports show up in the sidebar.
// Stored in user_preferences.sidebar_reports (text[]). Null = the user
// hasn't picked yet — on the next visit to /dashboard/reports we show
// the first-time picker.
//
// The available report keys mirror the cards on /dashboard/reports.

import { supabase } from "./supabaseClient";

// `tax_codes` is intentionally NOT exposed in v1 — the CRA line-code
// mapping feature is deferred until accountants have validated it.
// Anyone whose stored prefs still contain the value is filtered out by
// the ALL_REPORT_KEYS guard in loadSidebarReportsPrefs below.
export const ALL_REPORT_KEYS = [
  "capital_assets",
  "home_office",
  "quarterly_hst",
  "net_income",
  "client_reports",
  "edit_history",
] as const;
export type SidebarReportKey = (typeof ALL_REPORT_KEYS)[number];

export const REPORT_META: Record<SidebarReportKey, { label: string; icon: string; href: string; desc: string }> = {
  capital_assets:{ label: "Capital Assets",  icon: "🏗️", href: "/dashboard/reports/capital-assets",   desc: "Items for CCA depreciation" },
  home_office:   { label: "Home Office",     icon: "🏠", href: "/dashboard/reports/home-office",       desc: "Line 9945 calculation" },
  quarterly_hst: { label: "Quarterly HST",   icon: "📅", href: "/dashboard/reports/quarterly-hst",    desc: "ITCs by calendar quarter" },
  net_income:    { label: "Net Income",      icon: "💰", href: "/dashboard/reports/net-income",       desc: "Revenue − deductibles per month" },
  client_reports:{ label: "Client Reports",  icon: "📋", href: "/dashboard/reports/clients",          desc: "Monthly client summaries" },
  edit_history:  { label: "Edit History",    icon: "✏️", href: "/dashboard/reports/edits",            desc: "Receipt change audit log" },
};

// Sensible default — pinned by default for new users until they
// customize. Heavy reports like Capital Assets / Quarterly HST hidden
// by default to keep the sidebar uncluttered.
export const DEFAULT_PINNED: SidebarReportKey[] = ["net_income"];

export async function loadSidebarReportsPrefs(): Promise<SidebarReportKey[] | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("user_preferences")
      .select("sidebar_reports")
      .eq("user_id", user.id)
      .maybeSingle();
    const raw = (data?.sidebar_reports as string[] | null) ?? null;
    if (!raw) return null;
    // Filter to known keys in case the schema picked up legacy values.
    return raw.filter((k): k is SidebarReportKey =>
      (ALL_REPORT_KEYS as readonly string[]).includes(k)
    );
  } catch (err) {
    console.error("[sidebarReportsPrefs] load failed:", err);
    return null;
  }
}

export async function saveSidebarReportsPrefs(keys: SidebarReportKey[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert on user_id — schema has a unique constraint on it.
  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, sidebar_reports: keys, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
