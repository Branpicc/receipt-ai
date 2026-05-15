"use client";

// components/GoalCard.tsx
//
// Renders a single goal in the grid. Shows icon (lucide or emoji),
// name, target/progress, target date, "+ Contribute" button, and edit/
// archive menu. Cycle-based goals (bills with monthly reset, etc.) show
// "this cycle" progress; open-ended goals show lifetime totals.

import { useState } from "react";
import { Pencil, Archive, Star, CalendarDays, Repeat, Trash2 } from "lucide-react";
import { getLucideIcon } from "@/lib/goalIcons";
import type { GoalWithProgress, ResetFrequency } from "@/lib/goalTypes";

type Props = {
  goal: GoalWithProgress;
  onContribute: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
};

const RESET_LABEL: Record<NonNullable<ResetFrequency>, string> = {
  never: "No reset",
  weekly: "Resets weekly",
  biweekly: "Resets biweekly",
  monthly: "Resets monthly",
  per_paycheck: "Per paycheck",
};

export default function GoalCard({ goal, onContribute, onEdit, onArchive, onDelete, onOpenHistory }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Cycle-based goals (bills, monthly investing) use current_cycle_cents
  // for the bar; open-ended goals show lifetime accumulation.
  const isCycle = !!goal.reset_frequency && goal.reset_frequency !== "never";
  const progressCents = isCycle ? goal.current_cycle_cents : goal.contributed_total_cents;
  const target = goal.target_cents;
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((progressCents / target) * 100)) : 0;
  const remaining = hasTarget ? Math.max(0, target - progressCents) : 0;

  const Icon = getLucideIcon(goal.icon);

  const barColor =
    goal.category === "bills"
      ? (pct >= 100 ? "bg-green-500" : pct >= 80 ? "bg-orange-500" : "bg-blue-500")
      : pct >= 100
      ? "bg-green-500"
      : "bg-accent-500";

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-dark-surface p-5 flex flex-col transition-all relative ${
        goal.is_important
          ? "border-amber-300 dark:border-amber-700 shadow-md"
          : "border-gray-200 dark:border-dark-border"
      }`}
    >
      {goal.is_important && (
        <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 rounded-full p-1 shadow-sm">
          <Star className="w-3.5 h-3.5 fill-current" />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-dark-hover flex items-center justify-center flex-shrink-0">
          {Icon ? (
            <Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          ) : goal.emoji ? (
            <span className="text-2xl">{goal.emoji}</span>
          ) : (
            <span className="text-2xl">🎯</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={onOpenHistory}
            className="text-left w-full"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{goal.name}</h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{goal.category}</div>
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Goal options"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden tabIndex={-1} />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onArchive(); }}
                  className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover flex items-center gap-2"
                  title="Hide from the active list but keep history"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  title="Permanently remove this goal and all its contributions"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {hasTarget ? (
        <div className="mb-3">
          <div className="flex items-baseline justify-between text-sm mb-1">
            <span className="font-semibold text-gray-900 dark:text-white">
              ${(progressCents / 100).toFixed(2)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              of ${(target / 100).toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-dark-bg rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            <span>{pct}%</span>
            {remaining > 0 && <span>${(remaining / 100).toFixed(2)} to go</span>}
            {pct >= 100 && <span className="text-green-600 dark:text-green-400 font-medium">Reached</span>}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            ${(progressCents / 100).toFixed(2)} contributed
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Open-ended goal</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-4">
        {goal.target_date && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-dark-hover rounded">
            <CalendarDays className="w-3 h-3" />
            {new Date(goal.target_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
        {goal.reset_frequency && goal.reset_frequency !== "never" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-dark-hover rounded">
            <Repeat className="w-3 h-3" />
            {RESET_LABEL[goal.reset_frequency]}
          </span>
        )}
      </div>

      <button
        onClick={onContribute}
        className="mt-auto w-full px-3 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        + Contribute
      </button>
    </div>
  );
}
