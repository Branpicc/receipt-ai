"use client";

// app/dashboard/goals/page.tsx
//
// Personal-account Goals + Paycheck Splitter page. Two tabs:
//   • Goals — grid of GoalCards with "+ New goal" button. Editing,
//     archiving, contributing all happen via modals. Completing a goal
//     triggers a celebration overlay scaled by the goal's importance
//     (fireworks for important, confetti for normal, none for bills).
//   • Paycheck Splitter — define income sources, enter a paycheck $
//     amount, commit → every linked goal gets a contribution row.
//
// Personal accounts only. Firm/accountant users have no use for this
// page (their clients each have their own personal data scoped through
// the firm relationship).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getMyAccountType } from "@/lib/getMyAccountType";
import GoalCard from "@/components/GoalCard";
import { GoalEditorModal, GoalContributeModal } from "@/components/GoalModals";
import GoalCelebration, { celebrationTier, type CelebrationTier } from "@/components/GoalCelebration";
import PaycheckSplitter from "@/components/PaycheckSplitter";
import { fetchGoalsWithProgress, archiveGoal, deleteGoal, isGoalCompleted } from "@/lib/goalsApi";
import type { Goal, GoalWithProgress } from "@/lib/goalTypes";

type Tab = "goals" | "splitter";

export default function GoalsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("goals");
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>();
  const [contributing, setContributing] = useState<GoalWithProgress | null>(null);
  const [celebration, setCelebration] = useState<{ tier: CelebrationTier; key: number; goalNames: string[] } | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const accountType = await getMyAccountType();
      if (accountType !== "personal") {
        // Firm/accountant users shouldn't be here — bounce back to /dashboard.
        router.replace("/dashboard");
        return;
      }
      const fId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", fId)
        .single();
      if (!firmUser?.client_id) return;
      setFirmId(fId);
      setClientId(firmUser.client_id);
      await loadGoals(firmUser.client_id);
    } finally {
      setLoading(false);
    }
  }

  async function loadGoals(cId: string) {
    const data = await fetchGoalsWithProgress(cId);
    setGoals(data);
  }

  function triggerCelebrationFor(goalId: string) {
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    const tier = celebrationTier(g.category, g.is_important);
    if (tier === "none") return;
    // `key` bumps so the overlay re-mounts even if the same tier fires
    // twice in a row.
    setCelebration({ tier, key: Date.now(), goalNames: [g.name] });
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading goals…</p>
      </div>
    );
  }

  if (!clientId || !firmId) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Could not load your profile.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-accent-500" /> Goals
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track what you're saving for, what you're paying down, and how each paycheck gets split.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 inline-flex bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-1">
          <button
            onClick={() => setTab("goals")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "goals"
                ? "bg-accent-500 text-white"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Goals
          </button>
          <button
            onClick={() => setTab("splitter")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "splitter"
                ? "bg-accent-500 text-white"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Paycheck Splitter
          </button>
        </div>

        {tab === "goals" ? (
          <GoalsTab
            goals={goals}
            onCreateNew={() => { setEditing(undefined); setEditorOpen(true); }}
            onContribute={(g) => setContributing(g)}
            onEdit={(g) => { setEditing(g); setEditorOpen(true); }}
            onArchive={async (g) => {
              if (!confirm(`Archive "${g.name}"? It'll move out of the active list but history is kept.`)) return;
              await archiveGoal(g.id);
              await loadGoals(clientId!);
            }}
            onDelete={async (g) => {
              if (!confirm(
                `Permanently delete "${g.name}"?\n\nThis removes the goal AND every contribution recorded against it. ` +
                `This can't be undone — use Archive instead if you want to keep the history.`
              )) return;
              await deleteGoal(g.id);
              await loadGoals(clientId!);
            }}
          />
        ) : (
          <PaycheckSplitter
            clientId={clientId}
            firmId={firmId}
            goals={goals}
            onCommitted={async (completedGoalIds) => {
              await loadGoals(clientId);
              // Trigger a celebration for each completed goal. If
              // multiple completed at once we play the highest tier
              // present and list every completed goal name in the
              // banner — the splitter doesn't show per-goal feedback
              // anywhere else, so without names the user wouldn't know
              // which goal just crossed the line.
              if (completedGoalIds.length > 0) {
                const completedGoals = completedGoalIds
                  .map(id => goals.find(x => x.id === id))
                  .filter((g): g is GoalWithProgress => !!g);
                const tiers = completedGoals.map(g => celebrationTier(g.category, g.is_important));
                const best = tiers.includes("fireworks") ? "fireworks" : tiers.includes("confetti") ? "confetti" : "none";
                if (best !== "none") {
                  // Drop "bills" goals from the name list since they
                  // don't visually celebrate — but we still keep the
                  // banner if a non-bill goal also completed.
                  const namedGoals = completedGoals
                    .filter(g => celebrationTier(g.category, g.is_important) !== "none")
                    .map(g => g.name);
                  setCelebration({ tier: best, key: Date.now(), goalNames: namedGoals });
                }
              }
            }}
          />
        )}
      </div>

      {/* Modals */}
      {editorOpen && (
        <GoalEditorModal
          clientId={clientId}
          firmId={firmId}
          existing={editing}
          onClose={() => { setEditorOpen(false); setEditing(undefined); }}
          onSaved={async () => {
            await loadGoals(clientId);
            setEditorOpen(false);
            setEditing(undefined);
          }}
        />
      )}

      {contributing && (
        <GoalContributeModal
          goal={contributing}
          onClose={() => setContributing(null)}
          onContributed={async (didComplete) => {
            const completedId = contributing.id;
            setContributing(null);
            await loadGoals(clientId);
            if (didComplete) triggerCelebrationFor(completedId);
          }}
        />
      )}

      {celebration && (
        <GoalCelebration
          key={celebration.key}
          tier={celebration.tier}
          show={true}
          goalNames={celebration.goalNames}
          onDone={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

// ── Goals tab — splits the list into Active and Completed ─────────────────
// "Completed" = isGoalCompleted() from goalsApi (target hit on a
// non-recurring goal, OR target_date has passed). The Completed section
// is collapsed by default so it stays out of the way once a user
// accumulates a long history.
function GoalsTab({
  goals,
  onCreateNew,
  onContribute,
  onEdit,
  onArchive,
  onDelete,
}: {
  goals: GoalWithProgress[];
  onCreateNew: () => void;
  onContribute: (g: GoalWithProgress) => void;
  onEdit: (g: GoalWithProgress) => void;
  onArchive: (g: GoalWithProgress) => void;
  onDelete: (g: GoalWithProgress) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const active = goals.filter(g => !isGoalCompleted(g));
  const completed = goals.filter(g => isGoalCompleted(g));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {active.length} active goal{active.length === 1 ? "" : "s"}
          {completed.length > 0 && (
            <span className="ml-2 text-gray-400 dark:text-gray-500">· {completed.length} completed</span>
          )}
        </p>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-10 text-center">
          <Sparkles className="w-10 h-10 text-accent-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Start with a goal
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
            Save for a vacation, pay down a credit card, build an emergency fund, or
            budget for monthly bills. Mark a goal as <strong>important</strong> for a
            fireworks animation when you cross the finish line.
          </p>
          <button
            onClick={onCreateNew}
            className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create your first goal
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onContribute={() => onContribute(g)}
                  onEdit={() => onEdit(g)}
                  onOpenHistory={() => onEdit(g)}
                  onArchive={() => onArchive(g)}
                  onDelete={() => onDelete(g)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No active goals — everything in this section is finished. Nice work.
            </div>
          )}

          {completed.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowCompleted(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover"
              >
                <span className="flex items-center gap-2">
                  🏁 Completed goals ({completed.length})
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {showCompleted ? "Hide" : "Show"}
                </span>
              </button>
              {showCompleted && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3 opacity-90">
                  {completed.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      onContribute={() => onContribute(g)}
                      onEdit={() => onEdit(g)}
                      onOpenHistory={() => onEdit(g)}
                      onArchive={() => onArchive(g)}
                      onDelete={() => onDelete(g)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
