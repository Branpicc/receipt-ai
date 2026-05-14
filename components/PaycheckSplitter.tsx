"use client";

// components/PaycheckSplitter.tsx
//
// Tab content for the Goals page. Lets the user define one or more
// income sources, each with a configurable split (rows of % or $ that
// route money to a goal or to a labeled bucket like "Chequing"). Enter
// a paycheck amount, see the breakdown, click Commit — every linked
// goal gets a contribution row inserted in one transaction.
//
// Multi-paycheck support: the "+ Add another income source" button
// creates a second (or third) row. Each splitter persists until the
// user deletes it.

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchPaycheckSplits,
  createPaycheckSplit,
  updatePaycheckSplit,
  deletePaycheckSplit,
  computeSplitAllocation,
  commitPaycheckSplit,
} from "@/lib/goalsApi";
import type { PaycheckSplit, SplitItem, GoalWithProgress, PayFrequency } from "@/lib/goalTypes";

type Props = {
  clientId: string;
  firmId: string;
  goals: GoalWithProgress[];
  // Called after a successful commit so the parent can re-fetch goals
  // (their progress just changed) and trigger any celebration animation
  // for newly-completed goals.
  onCommitted: (completedGoalIds: string[]) => void;
};

const FREQ_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "semimonthly", label: "Semi-monthly" },
  { value: "monthly", label: "Monthly" },
  { value: "irregular", label: "Irregular" },
];

export default function PaycheckSplitter({ clientId, firmId, goals, onCommitted }: Props) {
  const [splits, setSplits] = useState<PaycheckSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFreq, setNewFreq] = useState<PayFrequency>("biweekly");

  useEffect(() => {
    if (!clientId) return;
    load();
  }, [clientId]);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchPaycheckSplits(clientId);
      setSplits(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const created = await createPaycheckSplit({
      clientId,
      firmId,
      name: newName.trim(),
      payFrequency: newFreq,
      items: [],
    });
    setSplits(s => [...s, created]);
    setNewName("");
    setNewFreq("biweekly");
    setAdding(false);
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading paycheck splits…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          Tell Receipture how you usually split each paycheck (% or fixed $).
          When payday rolls around, enter your paycheck amount, double-check
          the numbers, and click <strong>Commit</strong> — every linked goal
          gets a contribution automatically.
        </p>
      </div>

      {splits.length === 0 && !adding && (
        <div className="text-center py-10 bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No paycheck splits yet. Set one up to start auto-contributing.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg"
          >
            + Create paycheck split
          </button>
        </div>
      )}

      {splits.map(split => (
        <SplitterCard
          key={split.id}
          split={split}
          goals={goals}
          onSave={async (next) => {
            await updatePaycheckSplit(split.id, next);
            setSplits(arr => arr.map(s => (s.id === split.id ? { ...s, ...next } : s)));
          }}
          onDelete={async () => {
            if (!confirm(`Remove "${split.name}"? Contribution history is preserved.`)) return;
            await deletePaycheckSplit(split.id);
            setSplits(arr => arr.filter(s => s.id !== split.id));
          }}
          onCommitted={onCommitted}
        />
      ))}

      {/* Add another income source. The button stays visible after the
          first source exists — the user can have a main job and a
          freelance gig, each with its own split. */}
      {!adding && splits.length > 0 && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:border-accent-400 hover:text-accent-600 transition-colors"
        >
          + Add another income source
        </button>
      )}

      {adding && (
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-5">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">New income source</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Main job"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pay frequency</label>
              <select
                value={newFreq}
                onChange={(e) => setNewFreq(e.target.value as PayFrequency)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              >
                {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setAdding(false); setNewName(""); }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-4 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── A single splitter card ───────────────────────────────────────────────

function SplitterCard({
  split,
  goals,
  onSave,
  onDelete,
  onCommitted,
}: {
  split: PaycheckSplit;
  goals: GoalWithProgress[];
  onSave: (next: Partial<PaycheckSplit>) => Promise<void>;
  onDelete: () => Promise<void>;
  onCommitted: (completedGoalIds: string[]) => void;
}) {
  const [items, setItems] = useState<SplitItem[]>(split.items || []);
  const [paycheckDollars, setPaycheckDollars] = useState<string>("");
  const [committing, setCommitting] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    setItems(split.items || []);
  }, [split.id, split.items]);

  const paycheckCents = Math.round((parseFloat(paycheckDollars) || 0) * 100);
  const { items: allocations, leftoverCents } = computeSplitAllocation(paycheckCents, items);

  // Sanity check that percent rows don't exceed 100%. We let users
  // proceed anyway (sometimes you double-allocate on purpose) but
  // surface the warning.
  const percentTotal = items.filter(i => i.kind === "%").reduce((s, i) => s + i.value, 0);
  const percentExceeds = percentTotal > 100;

  // True if at least one row already absorbs the leftover. We use this
  // to disable the "remainder" preset button — having two remainder
  // rows works (the leftover is split evenly) but is almost never what
  // the user intends, so we steer them away from it.
  const hasRemainder = items.some(i => i.kind === "remainder");

  function addRow(preset: "savings" | "investment" | "bills" | "spending" | "remainder" | "custom") {
    const presets: Record<string, { label: string; kind: SplitItem["kind"]; value: number }> = {
      savings: { label: "Savings", kind: "%", value: 10 },
      investment: { label: "Investments", kind: "%", value: 15 },
      bills: { label: "Bills", kind: "$", value: 0 },
      spending: { label: "Spending / chequing", kind: "%", value: 0 },
      // Remainder row: "Put what's left into Chequing" is the canonical
      // use case, so we pre-fill the label that way. User can rename.
      remainder: { label: "Chequing (leftover)", kind: "remainder", value: 0 },
      custom: { label: "", kind: "%", value: 0 },
    };
    const p = presets[preset];
    setItems(arr => [
      ...arr,
      { id: cryptoRandom(), label: p.label, kind: p.kind, value: p.value, goal_id: null },
    ]);
  }

  function updateItem(id: string, patch: Partial<SplitItem>) {
    setItems(arr => arr.map(it => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems(arr => arr.filter(it => it.id !== id));
  }

  async function saveItems() {
    await onSave({ items });
  }

  async function handleCommit() {
    if (paycheckCents <= 0) return;
    setCommitting(true);
    setConfirmation("");
    try {
      // Snapshot pre-commit progress so we can detect which goals just
      // crossed their target.
      const beforeProgress = new Map<string, { current: number; target: number; cycle: boolean }>();
      goals.forEach(g => {
        const cycle = !!g.reset_frequency && g.reset_frequency !== "never";
        beforeProgress.set(g.id, {
          current: cycle ? g.current_cycle_cents : g.contributed_total_cents,
          target: g.target_cents,
          cycle,
        });
      });

      // Persist any unsaved edits to the items array first.
      await onSave({ items });
      // Then write contribution rows.
      const { committedCount } = await commitPaycheckSplit(allocations, split.name);

      // Compute which goals just got completed (target > 0 and crossed it).
      const completed: string[] = [];
      allocations.forEach(a => {
        if (!a.item.goal_id) return;
        const before = beforeProgress.get(a.item.goal_id);
        if (!before || before.target <= 0) return;
        const after = before.current + a.allocatedCents;
        if (before.current < before.target && after >= before.target) {
          completed.push(a.item.goal_id);
        }
      });

      setConfirmation(`✓ Committed ${committedCount} contribution${committedCount === 1 ? "" : "s"} from this paycheck.`);
      setPaycheckDollars("");
      onCommitted(completed);
    } catch (err: any) {
      setConfirmation(`Failed: ${err.message || "unknown error"}`);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{split.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{split.pay_frequency.replace("_", "-")}</p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
          title="Remove this income source"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Items editor */}
      <div className="space-y-2 mb-3">
        {items.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 italic">
            No split rows yet — add one below.
          </p>
        )}
        {items.map((it, idx) => {
          const allocCents = paycheckCents > 0 ? allocations[idx]?.allocatedCents ?? 0 : 0;
          return (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={it.label}
                onChange={(e) => updateItem(it.id, { label: e.target.value })}
                placeholder="Label"
                className="col-span-4 px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
              <select
                value={it.kind}
                onChange={(e) => updateItem(it.id, { kind: e.target.value as SplitItem["kind"] })}
                className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              >
                <option value="%">%</option>
                <option value="$">$</option>
                <option value="remainder">Rest</option>
              </select>
              {/* Value input is meaningless for remainder rows — disable
                  it and show a placeholder so the user knows it auto-
                  fills with whatever's left after the other rows. */}
              {it.kind === "remainder" ? (
                <div className="col-span-2 px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 italic border border-dashed border-gray-300 dark:border-dark-border rounded-lg">
                  whatever's left
                </div>
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={it.kind === "%" ? "1" : "0.01"}
                  value={it.value || ""}
                  onChange={(e) => updateItem(it.id, { value: parseFloat(e.target.value) || 0 })}
                  className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              )}
              <select
                value={it.goal_id || ""}
                onChange={(e) => updateItem(it.id, { goal_id: e.target.value || null })}
                className="col-span-3 px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white truncate"
              >
                <option value="">— No goal (just label) —</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={() => removeItem(it.id)}
                className="col-span-1 flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                aria-label="Remove row"
              >
                <X className="w-4 h-4" />
              </button>
              {paycheckCents > 0 && (
                <div className="col-span-12 ml-1 text-[11px] text-gray-500 dark:text-gray-400">
                  → ${(allocCents / 100).toFixed(2)} per paycheck
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add row preset shortcuts */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["savings", "investment", "bills", "spending", "custom"] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => addRow(p)}
            className="px-2.5 py-1 text-[11px] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-border rounded-full hover:border-accent-400 hover:text-accent-600 transition-colors capitalize"
          >
            <Plus className="inline w-3 h-3 -mt-0.5" /> {p}
          </button>
        ))}
        {/* "Put remaining into…" — single remainder row only. Disable
            once one exists since splitting the leftover across multiple
            remainder rows is rarely what the user wants. */}
        <button
          type="button"
          onClick={() => addRow("remainder")}
          disabled={hasRemainder}
          className="px-2.5 py-1 text-[11px] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-border rounded-full hover:border-accent-400 hover:text-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasRemainder ? "Only one remainder row per split" : undefined}
        >
          <Plus className="inline w-3 h-3 -mt-0.5" /> Put rest into…
        </button>
      </div>

      {/* Save the edits without committing a paycheck */}
      {items.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={saveItems}
            className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
          >
            Save changes
          </button>
        </div>
      )}

      {/* Commit panel */}
      <div className="border-t border-gray-200 dark:border-dark-border pt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Paycheck amount
        </label>
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paycheckDollars}
              onChange={(e) => setPaycheckDollars(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleCommit}
            disabled={committing || paycheckCents <= 0 || items.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg whitespace-nowrap"
          >
            {committing ? "Committing…" : "Commit (Contributed)"}
          </button>
        </div>

        {paycheckCents > 0 && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Allocated</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${((paycheckCents - leftoverCents) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Leftover (unallocated)</span>
              <span className={`font-semibold ${leftoverCents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                ${(leftoverCents / 100).toFixed(2)}
              </span>
            </div>
            {percentExceeds && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                ⚠️ Your % rows total {percentTotal}% — over 100%. You can still commit, but check the math.
              </p>
            )}
          </div>
        )}

        {confirmation && (
          <p className={`mt-3 text-sm ${confirmation.startsWith("✓") ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {confirmation}
          </p>
        )}
      </div>
    </div>
  );
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
