"use client";

// components/GoalModals.tsx
//
// Two related modals for the goals page:
//   • GoalEditorModal — create a new goal OR edit an existing one.
//     Same UI for both since the fields are identical. Parent passes
//     `existing` for the edit case.
//   • GoalContributeModal — log a contribution amount on a single
//     goal. Shows the current progress and lets the user contribute
//     a partial amount, the full remaining, or any custom value.
//
// Both modals close themselves via onClose; the parent refetches goals
// in onSaved/onContributed callbacks.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import GoalIconPicker from "@/components/GoalIconPicker";
import { createGoal, updateGoal, contribute } from "@/lib/goalsApi";
import { defaultIconForCategory } from "@/lib/goalIcons";
import type { Goal, GoalCategory, GoalWithProgress, ResetFrequency } from "@/lib/goalTypes";

// ── Editor ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: GoalCategory; label: string; hint: string }[] = [
  { value: "savings", label: "Savings", hint: "Emergency fund, rainy-day money" },
  { value: "investment", label: "Investment", hint: "Stocks, RRSP, TFSA contributions" },
  { value: "vacation", label: "Vacation", hint: "Travel target with a deadline" },
  { value: "bills", label: "Bills", hint: "Recurring expense to set aside money for (no celebration)" },
  { value: "spending", label: "Spending", hint: "Discretionary spend budget" },
  { value: "custom", label: "Custom", hint: "Anything else" },
];

const RESET_OPTIONS: { value: NonNullable<ResetFrequency>; label: string }[] = [
  { value: "never", label: "Never (one-time goal)" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "per_paycheck", label: "Every paycheck" },
];

export function GoalEditorModal({
  clientId,
  firmId,
  existing,
  onClose,
  onSaved,
}: {
  clientId: string;
  firmId: string;
  existing?: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name || "");
  const [category, setCategory] = useState<GoalCategory>(existing?.category || "savings");
  const [icon, setIcon] = useState<string | null>(existing?.icon ?? defaultIconForCategory(category));
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji || null);
  const [targetDollars, setTargetDollars] = useState<string>(
    existing && existing.target_cents > 0 ? (existing.target_cents / 100).toString() : ""
  );
  const [targetDate, setTargetDate] = useState<string>(existing?.target_date || "");
  const [resetFrequency, setResetFrequency] = useState<NonNullable<ResetFrequency>>(
    (existing?.reset_frequency as NonNullable<ResetFrequency>) || "never"
  );
  const [isImportant, setIsImportant] = useState<boolean>(existing?.is_important || false);
  const [notes, setNotes] = useState<string>(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // When the user changes category and hasn't set a custom icon, swap
  // to a sensible default — but only if they haven't already picked one.
  useEffect(() => {
    if (!isEdit && !emoji) {
      setIcon(defaultIconForCategory(category));
    }
    // Bills get an automatic monthly reset suggestion. User can override.
    if (!isEdit && category === "bills" && resetFrequency === "never") {
      setResetFrequency("monthly");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const targetCents = targetDollars ? Math.round(parseFloat(targetDollars) * 100) : 0;
    if (targetDollars && (isNaN(targetCents) || targetCents < 0)) {
      setError("Target must be a positive number.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && existing) {
        await updateGoal(existing.id, {
          name: name.trim(),
          icon,
          emoji,
          category,
          is_important: isImportant,
          target_cents: targetCents,
          target_date: targetDate || null,
          reset_frequency: resetFrequency,
          notes: notes.trim() || null,
        });
      } else {
        await createGoal({
          clientId,
          firmId,
          name: name.trim(),
          icon,
          emoji,
          category,
          isImportant,
          targetCents,
          targetDate: targetDate || null,
          resetFrequency,
          notes: notes.trim() || null,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Edit goal" : "New goal"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Italy vacation 2027"
            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_OPTIONS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  category === c.value
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300"
                    : "border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-accent-300"
                }`}
              >
                <div className="font-medium">{c.label}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{c.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
          <GoalIconPicker
            icon={icon}
            emoji={emoji}
            onChange={({ icon: i, emoji: e }) => { setIcon(i); setEmoji(e); }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={targetDollars}
                onChange={(e) => setTargetDollars(e.target.value)}
                placeholder="0 = open-ended"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reset frequency</label>
          <select
            value={resetFrequency}
            onChange={(e) => setResetFrequency(e.target.value as NonNullable<ResetFrequency>)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
          >
            {RESET_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            One-time goals never reset. Recurring goals (bills, monthly investing) reset the progress bar each period — history is preserved.
          </p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg cursor-pointer">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
            disabled={category === "bills"}
            className="mt-0.5 accent-amber-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Mark as important goal</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {category === "bills"
                ? "Bills don't trigger celebrations — paying a bill isn't a party."
                : "Triggers a fireworks animation when this goal is completed. Normal goals get confetti."}
            </div>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create goal"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Contribute ────────────────────────────────────────────────────────────

export function GoalContributeModal({
  goal,
  onClose,
  onContributed,
}: {
  goal: GoalWithProgress;
  onClose: () => void;
  onContributed: (didCompleteGoal: boolean) => void;
}) {
  const isCycle = !!goal.reset_frequency && goal.reset_frequency !== "never";
  const currentCents = isCycle ? goal.current_cycle_cents : goal.contributed_total_cents;
  const hasTarget = goal.target_cents > 0;
  const remainingCents = hasTarget ? Math.max(0, goal.target_cents - currentCents) : 0;

  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setRemaining() {
    if (remainingCents > 0) setAmount((remainingCents / 100).toFixed(2));
  }

  async function handleContribute() {
    setError("");
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || isNaN(cents) || cents <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    try {
      await contribute({
        goalId: goal.id,
        amountCents: cents,
        note: note.trim() || null,
        source: "manual",
      });
      const newTotal = currentCents + cents;
      const completedNow = hasTarget && currentCents < goal.target_cents && newTotal >= goal.target_cents;
      onContributed(completedNow);
    } catch (err: any) {
      setError(err.message || "Failed to contribute");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Contribute to ${goal.name}`} onClose={onClose}>
      <div className="space-y-4">
        {hasTarget && (
          <div className="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">
                {isCycle ? "This cycle" : "Total contributed"}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${(currentCents / 100).toFixed(2)} / ${(goal.target_cents / 100).toFixed(2)}
              </span>
            </div>
            {remainingCents > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ${(remainingCents / 100).toFixed(2)} remaining
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
          {hasTarget && remainingCents > 0 && (
            <button
              type="button"
              onClick={setRemaining}
              className="mt-2 text-xs text-accent-600 dark:text-accent-400 hover:underline"
            >
              Contribute full remaining (${(remainingCents / 100).toFixed(2)})
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. From May 14 paycheck"
            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleContribute}
            disabled={saving}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Contribute"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-60px)]">{children}</div>
      </div>
    </div>
  );
}
