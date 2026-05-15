// lib/goalsApi.ts
//
// Supabase data access for the Goals + Paycheck Splitter feature.
// Centralized so the page and components don't repeat the same queries
// (and so cycle-start logic for resetting goals lives in one place).

import { supabase } from "@/lib/supabaseClient";
import type {
  Goal,
  GoalContribution,
  GoalWithProgress,
  PaycheckSplit,
  ResetFrequency,
  SplitItem,
} from "@/lib/goalTypes";

// ── Cycle math ─────────────────────────────────────────────────────────────
// For a goal with reset_frequency = monthly/weekly/biweekly, we compute
// the start of the current cycle so the UI can show "contributed THIS
// cycle". Lifetime contributions remain in goal_contributions for the
// history view + reports.

function startOfCurrentCycle(reset: ResetFrequency): Date | null {
  if (!reset || reset === "never" || reset === "per_paycheck") return null;
  const now = new Date();
  if (reset === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (reset === "weekly") {
    const day = now.getDay(); // 0 = Sun
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (reset === "biweekly") {
    // Anchor biweekly cycle on the first Sunday of 2025 — deterministic
    // so all clients agree on the boundary regardless of when they signed up.
    const anchor = new Date(2025, 0, 5); // Sunday Jan 5 2025
    const ms = now.getTime() - anchor.getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const periodDay = days % 14;
    const start = new Date(now);
    start.setDate(now.getDate() - periodDay);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return null;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export async function fetchGoalsWithProgress(clientId: string): Promise<GoalWithProgress[]> {
  const { data: goals, error } = await supabase
    .from("personal_goals")
    .select("*")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!goals || goals.length === 0) return [];

  const ids = goals.map(g => g.id);
  const { data: contribs } = await supabase
    .from("goal_contributions")
    .select("goal_id, amount_cents, contributed_at")
    .in("goal_id", ids);

  const lifetime = new Map<string, number>();
  const byGoal = new Map<string, { amount: number; at: string }[]>();
  (contribs || []).forEach(c => {
    lifetime.set(c.goal_id, (lifetime.get(c.goal_id) || 0) + c.amount_cents);
    const arr = byGoal.get(c.goal_id) || [];
    arr.push({ amount: c.amount_cents, at: c.contributed_at });
    byGoal.set(c.goal_id, arr);
  });

  return goals.map(g => {
    const cycleStart = startOfCurrentCycle(g.reset_frequency);
    const cycleStartIso = cycleStart?.toISOString() || null;
    const cycleSum = cycleStart
      ? (byGoal.get(g.id) || []).reduce(
          (s, c) => s + (new Date(c.at) >= cycleStart ? c.amount : 0),
          0
        )
      : lifetime.get(g.id) || 0;
    return {
      ...g,
      contributed_total_cents: lifetime.get(g.id) || 0,
      current_cycle_cents: cycleSum,
      cycle_start: cycleStartIso,
    };
  });
}

// Determines whether a goal should live in the "Completed" section.
// A goal is considered completed when:
//   • it has a positive target AND the lifetime contributions have
//     hit/exceeded that target, AND it does NOT recur (recurring
//     goals like bills always reset and shouldn't move to completed), OR
//   • its target_date is in the past (regardless of progress) — e.g.
//     a vacation goal whose trip date has come and gone, whether or
//     not the user hit their savings target.
//
// Used by the goals page to split the grid into Active and Completed.
export function isGoalCompleted(g: GoalWithProgress): boolean {
  const recurring = !!g.reset_frequency && g.reset_frequency !== "never";
  if (g.target_cents > 0 && !recurring && g.contributed_total_cents >= g.target_cents) {
    return true;
  }
  if (g.target_date) {
    const target = new Date(g.target_date);
    target.setHours(23, 59, 59, 999);
    if (target.getTime() < Date.now()) return true;
  }
  return false;
}

export async function fetchGoalContributions(goalId: string): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("contributed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function createGoal(input: {
  clientId: string;
  firmId: string;
  name: string;
  icon: string | null;
  emoji: string | null;
  category: Goal["category"];
  isImportant: boolean;
  targetCents: number;
  targetDate: string | null;
  resetFrequency: ResetFrequency;
  notes: string | null;
}): Promise<Goal> {
  // Defensive: coerce numbers so a NaN never reaches Supabase (which
  // would fail with an opaque "invalid input syntax" message).
  const targetCentsSafe = Number.isFinite(input.targetCents) ? Math.max(0, Math.round(input.targetCents)) : 0;
  const payload = {
    client_id: input.clientId,
    firm_id: input.firmId,
    name: input.name,
    icon: input.icon,
    emoji: input.emoji,
    category: input.category,
    is_important: input.isImportant,
    target_cents: targetCentsSafe,
    target_date: input.targetDate,
    reset_frequency: input.resetFrequency,
    notes: input.notes,
  };
  const { data, error } = await supabase
    .from("personal_goals")
    .insert(payload)
    .select()
    .single();
  if (error) {
    // Log the raw error to the console so users (and we) can see the
    // actual Supabase complaint — "value too long", "violates not-null",
    // "duplicate key value", etc. The Goal modal surfaces error.message
    // to the UI, which previously hid the detail field.
    console.error("[createGoal] Supabase error:", error, "payload was:", payload);
    throw new Error(error.message + (error.details ? ` — ${error.details}` : ""));
  }
  return data as Goal;
}

export async function updateGoal(goalId: string, patch: Partial<Goal>): Promise<void> {
  const { error } = await supabase
    .from("personal_goals")
    .update(patch)
    .eq("id", goalId);
  if (error) throw error;
}

export async function archiveGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from("personal_goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", goalId);
  if (error) throw error;
}

// Hard-delete a goal AND all its contributions. The cascade on the
// FK definition (`goal_contributions.goal_id ... on delete cascade`)
// drops the history rows automatically. Use this when the user wants
// to truly remove a goal — archive is the soft alternative that keeps
// the row around for analytics.
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from("personal_goals")
    .delete()
    .eq("id", goalId);
  if (error) throw error;
}

export async function contribute(input: {
  goalId: string;
  amountCents: number;
  note?: string | null;
  source?: "manual" | "paycheck_split";
}): Promise<void> {
  const { error } = await supabase
    .from("goal_contributions")
    .insert({
      goal_id: input.goalId,
      amount_cents: input.amountCents,
      note: input.note || null,
      source: input.source || "manual",
    });
  if (error) throw error;
}

// ── Paycheck splits ────────────────────────────────────────────────────────

export async function fetchPaycheckSplits(clientId: string): Promise<PaycheckSplit[]> {
  const { data, error } = await supabase
    .from("paycheck_splits")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // items column is JSONB; Supabase returns it as a parsed value already.
  return (data || []) as PaycheckSplit[];
}

export async function createPaycheckSplit(input: {
  clientId: string;
  firmId: string;
  name: string;
  payFrequency: PaycheckSplit["pay_frequency"];
  items: SplitItem[];
}): Promise<PaycheckSplit> {
  const { data, error } = await supabase
    .from("paycheck_splits")
    .insert({
      client_id: input.clientId,
      firm_id: input.firmId,
      name: input.name,
      pay_frequency: input.payFrequency,
      items: input.items,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaycheckSplit;
}

export async function updatePaycheckSplit(splitId: string, patch: Partial<PaycheckSplit>): Promise<void> {
  const { error } = await supabase
    .from("paycheck_splits")
    .update(patch)
    .eq("id", splitId);
  if (error) throw error;
}

export async function deletePaycheckSplit(splitId: string): Promise<void> {
  const { error } = await supabase
    .from("paycheck_splits")
    .update({ is_active: false })
    .eq("id", splitId);
  if (error) throw error;
}

// Compute how much each split item gets given a paycheck $ amount.
//   - '%' rows: paycheck × percent
//   - '$' rows: fixed dollars (in cents)
//   - 'remainder' rows: whatever's left after % + $ rows are subtracted
//     from the paycheck. If multiple remainder rows exist (shouldn't,
//     but defensively) the leftover is split evenly across them. If the
//     %/$ rows already exceed the paycheck, remainder rows get $0
//     (never negative).
// Returns the per-item dollar amount AND a leftover cents value. With a
// remainder row present, leftover is always 0 (remainder ate it all);
// without one, leftover equals the unallocated chunk.
export function computeSplitAllocation(
  paycheckCents: number,
  items: SplitItem[]
): { items: { item: SplitItem; allocatedCents: number }[]; leftoverCents: number } {
  // First pass: compute fixed and percent rows, leave remainder=0.
  const allocations = items.map(item => {
    let cents = 0;
    if (item.kind === "%") cents = Math.round(paycheckCents * (item.value / 100));
    else if (item.kind === "$") cents = Math.round(item.value * 100);
    // remainder rows resolve in the second pass below
    return { item, allocatedCents: Math.max(0, cents) };
  });
  const nonRemainderTotal = allocations
    .filter(a => a.item.kind !== "remainder")
    .reduce((s, a) => s + a.allocatedCents, 0);
  const remainderRows = allocations.filter(a => a.item.kind === "remainder");

  const remainderPool = Math.max(0, paycheckCents - nonRemainderTotal);

  if (remainderRows.length === 0) {
    return { items: allocations, leftoverCents: paycheckCents - nonRemainderTotal };
  }

  // Distribute the remainder pool evenly across remainder rows. With
  // one row (the common case) it just gets everything that's left.
  const perRow = Math.floor(remainderPool / remainderRows.length);
  const rounding = remainderPool - perRow * remainderRows.length;
  let extra = rounding;
  for (const a of allocations) {
    if (a.item.kind === "remainder") {
      a.allocatedCents = perRow + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
    }
  }
  return { items: allocations, leftoverCents: 0 };
}

// Bulk-commit a paycheck split — writes a goal_contributions row for
// every split item that has a goal_id. Items without a goal_id (e.g.
// "Chequing") are skipped; they're labels for the user's own ledger.
export async function commitPaycheckSplit(
  allocations: { item: SplitItem; allocatedCents: number }[],
  splitName: string
): Promise<{ committedCount: number }> {
  const rows = allocations
    .filter(a => a.item.goal_id && a.allocatedCents > 0)
    .map(a => ({
      goal_id: a.item.goal_id!,
      amount_cents: a.allocatedCents,
      note: `From paycheck (${splitName})`,
      source: "paycheck_split" as const,
    }));
  if (rows.length === 0) return { committedCount: 0 };
  const { error } = await supabase.from("goal_contributions").insert(rows);
  if (error) throw error;
  return { committedCount: rows.length };
}
