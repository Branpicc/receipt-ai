"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getAssignedClientIds } from "@/lib/getAssignedClients";
import { CheckCircle2, Sparkles, X, ChevronRight, Loader2 } from "lucide-react";

/**
 * 5-minute Daily Check-in Runner.
 *
 * Self-driving guided flow for accountants. When the accountant clicks
 * "Start your 5-min check-in" on their dashboard:
 *   1. Loads the 3 oldest receipts where approved_category IS NULL OR
 *      purpose_text IS NULL (their assigned clients only).
 *   2. Navigates to receipt #1, shows a sticky widget with progress.
 *   3. After they save category + purpose on each receipt, the widget
 *      auto-advances. Listens for a `daily-checkin:receipt-done` window
 *      event so the receipt detail page can ping us.
 *   4. After 3 receipts (or fewer if there weren't 3), navigates to
 *      /dashboard/email-inbox; visit auto-marks step 2 done.
 *   5. Then /dashboard/flags; visit auto-marks step 3 done.
 *   6. Returns to /dashboard with a Done celebration.
 *
 * State persists in localStorage so a refresh / navigation doesn't
 * break the run. Sat/Sun: the widget never auto-prompts; the firm-
 * admin panel doesn't show "missed today" on weekends.
 *
 * Renders nothing for non-accountant roles.
 */

type RunnerState =
  | { kind: "idle" }
  | { kind: "loading-queue" }
  | {
      kind: "running";
      step: "receipts" | "emails" | "flags";
      queue: string[]; // receipt ids
      index: number;
      // Track which step has been auto-completed already so a stale page
      // navigation doesn't double-fire.
      emailsDone: boolean;
      flagsDone: boolean;
      // Continue mode — fired by "Still want to do more?" after a
      // completed daily check-in. In this mode the receipts step is
      // unbounded: each completed receipt fetches the next-oldest, and
      // the user wraps up on their own with the Finish button. The
      // emails / flags steps are skipped entirely.
      continueMode?: boolean;
      // For continue mode — the optional client filter to keep applying
      // when the queue auto-extends.
      clientFilter?: string | null;
    }
  | { kind: "done" };

const STORAGE_KEY = "receipture-daily-checkin-v1";

function todayISO(): string {
  // YYYY-MM-DD in the user's local timezone. The DB column is DATE so
  // the time portion is dropped on insert anyway.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function loadPersistedState(): RunnerState {
  if (typeof window === "undefined") return { kind: "idle" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: "idle" };
    const parsed = JSON.parse(raw) as RunnerState & { savedDate?: string };
    // Stale: state from a previous day. Clear it.
    if ((parsed as { savedDate?: string }).savedDate !== todayISO()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { kind: "idle" };
    }
    return parsed;
  } catch {
    return { kind: "idle" };
  }
}

function persistState(state: RunnerState) {
  if (typeof window === "undefined") return;
  try {
    // Idle state = no run in progress. Skip writing so we don't trample
    // the localStorage entry on mount before the runner has had a
    // chance to read the persisted in-progress state. Terminal states
    // (cancel, finish) clear the entry explicitly.
    if (state.kind === "idle") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedDate: todayISO() })
    );
  } catch {
    // Quota / privacy mode — silently ignore.
  }
}

function clearPersistedState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function DailyCheckinRunner() {
  const pathname = usePathname();
  const router = useRouter();

  const [state, setState] = useState<RunnerState>({ kind: "idle" });
  const [accountantId, setAccountantId] = useState<string | null>(null);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ── Identify the caller. Only accountants get the runner.
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const fId = await getMyFirmId();
        const { data: fu } = await supabase
          .from("firm_users")
          .select("id, role")
          .eq("auth_user_id", user.id)
          .eq("firm_id", fId)
          .maybeSingle();
        setUserRole(fu?.role || null);
        if (fu?.role === "accountant") {
          setAccountantId(fu.id);
          setFirmId(fId);
          // Restore any in-progress run.
          setState(loadPersistedState());
        }
      } catch (err) {
        console.warn("[DailyCheckinRunner] init failed:", err);
      }
    })();
  }, []);

  // ── Persist state whenever it changes.
  useEffect(() => {
    persistState(state);
  }, [state]);

  const upsertCompletion = useCallback(async (patch: Record<string, unknown>) => {
    if (!firmId || !accountantId) return;
    try {
      // Upsert the row for today, then merge the patch.
      await supabase
        .from("daily_checklist_completions")
        .upsert(
          {
            firm_id: firmId,
            accountant_id: accountantId,
            completion_date: todayISO(),
            ...patch,
          },
          { onConflict: "accountant_id,completion_date" }
        );
    } catch (err) {
      console.warn("[DailyCheckinRunner] upsert failed:", err);
    }
  }, [firmId, accountantId]);

  // ── Start: load the queue, write started_at, navigate to receipt #1.
  // `clientFilter` (optional) narrows the queue to a single client when
  // the accountant wants to focus on one specifically.
  // `continueMode` (optional) — fired by "Still want to do more?" — the
  // receipts step becomes unbounded and email / flags steps are skipped.
  const start = useCallback(async (clientFilter?: string | null, continueMode?: boolean) => {
    if (!firmId || !accountantId) return;
    setState({ kind: "loading-queue" });
    try {
      // Accountant scope — assigned clients only (or just one if filtered).
      const assignedIds = await getAssignedClientIds(firmId);
      if (assignedIds === null) {
        // Shouldn't happen for accountant role.
        setState({ kind: "idle" });
        return;
      }
      if (assignedIds.length === 0) {
        alert("You don't have any assigned clients yet — nothing to check in on today.");
        setState({ kind: "idle" });
        return;
      }
      const scopedIds = clientFilter && assignedIds.includes(clientFilter)
        ? [clientFilter]
        : assignedIds;
      // Receipts where approved_category OR purpose_text is missing.
      // Fixed first 3 in normal mode; in continue mode we still seed
      // with one batch and grow the queue as the user works through it.
      const { data: receiptRows } = await supabase
        .from("receipts")
        .select("id, approved_category, purpose_text, receipt_date, created_at")
        .eq("firm_id", firmId)
        .in("client_id", scopedIds)
        .or("approved_category.is.null,purpose_text.is.null")
        .order("receipt_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(continueMode ? 25 : 3);
      const queue = (receiptRows || []).map(r => r.id);

      await upsertCompletion({ step: "running", started_at: new Date().toISOString() });

      if (queue.length === 0) {
        if (continueMode) {
          alert("All caught up — no more receipts need attention right now.");
          setState({ kind: "done" });
          router.push("/dashboard");
          return;
        }
        // Normal mode: skip to the email step — no receipts need work.
        setState({
          kind: "running",
          step: "emails",
          queue: [],
          index: 0,
          emailsDone: false,
          flagsDone: false,
        });
        router.push("/dashboard/email-inbox");
        return;
      }

      setState({
        kind: "running",
        step: "receipts",
        queue,
        index: 0,
        emailsDone: false,
        flagsDone: false,
        continueMode: !!continueMode,
        clientFilter: clientFilter ?? null,
      });
      router.push(`/dashboard/receipts/${queue[0]}`);
    } catch (err) {
      console.error("[DailyCheckinRunner] start failed:", err);
      setState({ kind: "idle" });
      alert("Couldn't start your check-in — please try again.");
    }
  }, [firmId, accountantId, router, upsertCompletion]);

  // ── End: write completed_at and clear local state.
  const finish = useCallback(async () => {
    await upsertCompletion({ step: "done", completed_at: new Date().toISOString() });
    clearPersistedState();
    setState({ kind: "done" });
    if (typeof window !== "undefined") {
      // Tell the dashboard card to refresh and flip into "done" state.
      window.dispatchEvent(new Event("daily-checkin:state-changed"));
    }
    router.push("/dashboard");
  }, [router, upsertCompletion]);

  const cancel = useCallback(async () => {
    await upsertCompletion({ step: "idle" });
    clearPersistedState();
    setState({ kind: "idle" });
  }, [upsertCompletion]);

  // ── Advance after a receipt is completed.
  const advanceFromReceipt = useCallback(async () => {
    if (state.kind !== "running" || state.step !== "receipts") return;
    const completedSoFar = state.index + 1;
    // Bump the persisted counter so the firm-admin "today" panel can
    // show progress even before the run finishes.
    upsertCompletion({ receipts_categorized_today: completedSoFar });

    const nextIndex = completedSoFar;
    if (nextIndex < state.queue.length) {
      setState({ ...state, index: nextIndex });
      router.push(`/dashboard/receipts/${state.queue[nextIndex]}`);
      return;
    }

    // No more in the queue. In continue mode try to extend it with
    // the next batch of oldest-uncategorized; if there are none left
    // we wrap up.
    if (state.continueMode && firmId) {
      try {
        const assignedIds = await getAssignedClientIds(firmId);
        if (assignedIds && assignedIds.length > 0) {
          const scopedIds = state.clientFilter && assignedIds.includes(state.clientFilter)
            ? [state.clientFilter]
            : assignedIds;
          const { data: more } = await supabase
            .from("receipts")
            .select("id")
            .eq("firm_id", firmId)
            .in("client_id", scopedIds)
            .or("approved_category.is.null,purpose_text.is.null")
            .not("id", "in", `(${state.queue.join(",")})`)
            .order("receipt_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true })
            .limit(25);
          const moreIds = (more || []).map(r => r.id);
          if (moreIds.length > 0) {
            const newQueue = [...state.queue, ...moreIds];
            setState({ ...state, queue: newQueue, index: nextIndex });
            router.push(`/dashboard/receipts/${moreIds[0]}`);
            return;
          }
        }
        // No more — finish up.
        alert("All caught up — nice work.");
        await upsertCompletion({ step: "done", completed_at: new Date().toISOString() });
        clearPersistedState();
        setState({ kind: "done" });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("daily-checkin:state-changed"));
        }
        router.push("/dashboard");
      } catch (err) {
        console.warn("[DailyCheckinRunner] continue-extend failed:", err);
      }
      return;
    }

    // Normal mode: done with receipts → emails step.
    setState({ ...state, step: "emails" });
    router.push("/dashboard/email-inbox");
  }, [state, router, upsertCompletion, firmId]);

  // ── Listen for window events:
  //   daily-checkin:start        → kick off the run (from dashboard button).
  //                                Detail may carry { clientId } to narrow
  //                                the queue to a single client.
  //   daily-checkin:receipt-done → advance to next item (from receipt page)
  useEffect(() => {
    function onStart(ev: Event) {
      // Don't restart if already running.
      if (state.kind === "running" || state.kind === "loading-queue") return;
      const detail = (ev as CustomEvent<{ clientId?: string | null; continueMode?: boolean }>).detail;
      start(detail?.clientId ?? null, !!detail?.continueMode);
    }
    function onReceiptDone(ev: Event) {
      // Only advance when the saved receipt is the runner's current
      // target — receipts not in the queue shouldn't move us forward.
      const detail = (ev as CustomEvent<{ receiptId?: string }>).detail;
      if (state.kind !== "running" || state.step !== "receipts") return;
      const expected = state.queue[state.index];
      if (!detail?.receiptId || !expected || detail.receiptId !== expected) return;
      advanceFromReceipt();
    }
    window.addEventListener("daily-checkin:start", onStart);
    window.addEventListener("daily-checkin:receipt-done", onReceiptDone);
    return () => {
      window.removeEventListener("daily-checkin:start", onStart);
      window.removeEventListener("daily-checkin:receipt-done", onReceiptDone);
    };
  }, [advanceFromReceipt, start, state.kind]);

  // ── Auto-mark email + flags step on visit. The `!state.emailsDone` /
  //    `!state.flagsDone` guards make this idempotent — once each is
  //    true the effect short-circuits, so the linter's worry about
  //    cascading renders doesn't apply here.
  useEffect(() => {
    if (state.kind !== "running") return;
    if (state.step === "emails" && !state.emailsDone && pathname === "/dashboard/email-inbox") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ ...state, emailsDone: true });
      upsertCompletion({ email_inbox_visited_at: new Date().toISOString() });
    } else if (state.step === "flags" && !state.flagsDone && pathname === "/dashboard/flags") {
      setState({ ...state, flagsDone: true });
      upsertCompletion({ flags_reviewed_at: new Date().toISOString() });
    }
  }, [state, pathname, upsertCompletion]);

  // ── Render
  if (userRole !== "accountant") return null;
  if (isWeekend() && state.kind === "idle") return null;
  if (state.kind === "idle") return null; // Start button lives on the dashboard panel.

  if (state.kind === "loading-queue") {
    return (
      <FloatingCard>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-accent-600" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Loading your queue…</span>
        </div>
      </FloatingCard>
    );
  }

  if (state.kind === "done") {
    return (
      <FloatingCard>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Done for today</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Nice work — see you tomorrow.</div>
          </div>
          <button
            onClick={() => setState({ kind: "idle" })}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </FloatingCard>
    );
  }

  // running
  const total = state.queue.length || 1;
  const stepNum =
    state.step === "receipts" ? 1 : state.step === "emails" ? 2 : 3;
  const inContinueMode = !!state.continueMode;

  return (
    <FloatingCard>
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-accent-600 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
            {inContinueMode ? "Continue check-in" : `Daily check-in · Step ${stepNum} of 3`}
          </div>
          {state.step === "receipts" && state.queue.length > 0 && (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {inContinueMode
                  ? `Receipt #${state.index + 1}`
                  : `Categorize this receipt (${state.index + 1} of ${total})`}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {inContinueMode
                  ? "Set category + purpose. Click Save and we'll fetch the next."
                  : "Set the category and purpose, then click Save."}
              </div>
            </>
          )}
          {state.step === "emails" && (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Review email inbox
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {state.emailsDone ? "Done. Move on when ready." : "Have a quick look at any pending emails."}
              </div>
            </>
          )}
          {state.step === "flags" && (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Review flagged items
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {state.flagsDone ? "Done. Wrap it up below." : "Look at any open flags and resolve what you can."}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mt-3">
            {state.step === "emails" && state.emailsDone && (
              <button
                onClick={() => {
                  setState({ ...state, step: "flags" });
                  router.push("/dashboard/flags");
                }}
                className="text-xs px-3 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg font-medium flex items-center gap-1"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {state.step === "flags" && state.flagsDone && (
              <button
                onClick={finish}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Finish check-in
              </button>
            )}
            {state.step === "receipts" && state.queue.length > 0 && pathname !== `/dashboard/receipts/${state.queue[state.index]}` && (
              <Link
                href={`/dashboard/receipts/${state.queue[state.index]}`}
                className="text-xs px-3 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg font-medium"
              >
                Open receipt
              </Link>
            )}
            {inContinueMode && state.step === "receipts" && (
              <button
                onClick={finish}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Finish for now
              </button>
            )}
            <button
              onClick={cancel}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              {inContinueMode ? "Stop" : "Skip for today"}
            </button>
          </div>
        </div>
      </div>
    </FloatingCard>
  );
}

function FloatingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border p-4 max-w-sm">
        {children}
      </div>
    </div>
  );
}
