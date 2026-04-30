"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Receipt, Users, UserPlus, BarChart3, Settings as SettingsIcon, Sparkles } from "lucide-react";

/**
 * First-login wizard tour for firm_admin / accountant roles.
 *
 * Triggers automatically when:
 *   - role is firm_admin or accountant (clients use the existing onboarding;
 *     their UX is intentionally simpler),
 *   - email has been verified (so we're not stacking three things at once),
 *   - the existing written onboarding has been completed OR skipped,
 *   - the tour itself hasn't been completed or skipped yet.
 *
 * The tour persists `firm_users.tour_completed_at` (Done) or
 * `tour_skipped_at` (Skip). Either marker prevents re-trigger. Clearing
 * both columns from Settings → Replay re-arms the tour.
 *
 * Listens for a `first-login-tour:start` window event so Settings can
 * replay the tour without a navigation.
 */
type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to Receipture",
    body:
      "You're all set up. This quick walk-through points out where the main pieces live so you can hit the ground running. You can skip at any time and replay it later from Settings.",
  },
  {
    icon: Receipt,
    title: "Receipts",
    body:
      "Every receipt across your firm lives under Operations → Receipts. Upload them, filter by client, and click any row to see the full detail and edit history.",
  },
  {
    icon: Users,
    title: "Clients",
    body:
      "Add and manage clients from Team & Clients → Clients. Each client gets their own dedicated email address you can give them to forward receipts to.",
  },
  {
    icon: UserPlus,
    title: "Invite your team",
    body:
      "Team & Clients → Team is where you invite accountants. They'll get a Receipture email with a one-click link to join your firm.",
  },
  {
    icon: BarChart3,
    title: "Reports & Edit History",
    body:
      "Reports → Client Reports has per-client monthly + comprehensive PDFs. Edit History tracks every edit and deletion request, so the full audit trail is one click away.",
  },
  {
    icon: SettingsIcon,
    title: "Settings",
    body:
      "Settings holds your preferences, theme, billing, and replay buttons for both onboarding and this tour. You can come back here any time.",
  },
];

export default function FirstLoginTour() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Re-check eligibility. Used both on first mount and whenever the
  // existing onboarding emits "receipture:onboarding-finished" so the
  // tour can fire the moment the onboarding gate lifts.
  async function checkEligibility() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: fu } = await supabase
        .from("firm_users")
        .select("role, email_verified_at, onboarding_completed, onboarding_skipped, tour_completed_at, tour_skipped_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!fu) return;
      setAuthUserId(user.id);
      const tourEligibleRole = fu.role === "firm_admin" || fu.role === "accountant";
      const verified = !!fu.email_verified_at;
      const onboardingDone = !!fu.onboarding_completed || !!fu.onboarding_skipped;
      const alreadyDone = !!fu.tour_completed_at || !!fu.tour_skipped_at;
      if (tourEligibleRole && verified && onboardingDone && !alreadyDone) {
        setStepIdx(0);
        setOpen(true);
      }
    } catch {
      // Quiet: don't block the dashboard if we can't read state.
    }
  }

  useEffect(() => {
    checkEligibility();

    function onReplay() {
      setStepIdx(0);
      setOpen(true);
    }
    function onOnboardingFinished() {
      checkEligibility();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("first-login-tour:start", onReplay);
      window.addEventListener("receipture:onboarding-finished", onOnboardingFinished);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("first-login-tour:start", onReplay);
        window.removeEventListener("receipture:onboarding-finished", onOnboardingFinished);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(field: "tour_completed_at" | "tour_skipped_at") {
    if (!authUserId) return;
    try {
      const now = new Date().toISOString();
      // Always clear the opposite marker so a replay-after-skip ends in a
      // clean state.
      const opposite = field === "tour_completed_at" ? "tour_skipped_at" : "tour_completed_at";
      await supabase
        .from("firm_users")
        .update({ [field]: now, [opposite]: null })
        .eq("auth_user_id", authUserId);
    } catch {
      // Marker write is best-effort. Worst case the tour re-fires next load.
    }
  }

  function next() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      setOpen(false);
      persist("tour_completed_at");
    }
  }

  function skip() {
    setOpen(false);
    persist("tour_skipped_at");
  }

  if (!open) return null;

  const step = STEPS[stepIdx];
  const Icon = step.icon;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-md w-full p-8 border border-transparent dark:border-dark-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{step.title}</h2>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
          {step.body}
        </p>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === stepIdx
                  ? "bg-accent-500"
                  : i < stepIdx
                  ? "bg-accent-300 dark:bg-accent-700"
                  : "bg-gray-200 dark:bg-dark-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={skip}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx(stepIdx - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-2 text-sm font-medium bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4">
          Step {stepIdx + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
