"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getChaptersForRole, TourChapter, TourStep, TourPosition } from "@/lib/sidebarTourChapters";
import { Sparkles, X, ChevronRight, ChevronLeft, BookOpen } from "lucide-react";

/**
 * Immersive role-aware sidebar tour.
 *
 * Lifecycle:
 *   idle           — nothing rendered (already-completed users, ineligible)
 *   seeding        — POSTing /api/seed-demo-data, brief loader card
 *   running        — tour is on screen, spotlight + popover
 *
 * Eligibility check runs on mount and on receipture:onboarding-finished
 * window event. Settings can replay via first-login-tour:start.
 *
 * The spotlight is implemented as four fixed-position rectangles that
 * frame the highlighted element, dimming everything outside. Popover
 * positions itself relative to the same element rect, clamped to the
 * viewport. For steps with selector=null we render a centered modal
 * with no spotlight.
 */

type State =
  | { kind: "idle" }
  | { kind: "seeding" }
  | { kind: "running"; chapterIdx: number; stepIdx: number };

type ElementRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const POPOVER_GAP = 12; // px between spotlight edge and popover
const POPOVER_MAX_WIDTH = 380; // px

export default function SidebarTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<TourChapter[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const seedingStartedRef = useRef(false);

  // ── Eligibility + replay listeners ─────────────────────────────────
  const checkEligibility = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: fu } = await supabase
        .from("firm_users")
        .select("role, email_verified_at, onboarding_completed, onboarding_skipped, tour_completed_at, tour_skipped_at, firm_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!fu) return;

      // Personal accounts run the dedicated PERSONAL_CHAPTERS set
      // instead of the firm-admin one. The personal chapters live
      // entirely under /dashboard/client + subroutes the personal user
      // is allowed to visit — pointing any step at /dashboard would
      // bounce the user via the dashboard's personal redirect and
      // produce a navigation loop, so the chapter file is responsible
      // for keeping that invariant.
      const { data: firm } = await supabase
        .from("firms")
        .select("account_type")
        .eq("id", fu.firm_id)
        .maybeSingle();
      const isPersonal = firm?.account_type === "personal";

      setAuthUserId(user.id);
      const role = isPersonal ? "personal" : fu.role;
      // Eligibility: firm_admin/accountant for firm accounts, and
      // personal-account users get the tour too. Clients aren't
      // eligible — they get the client-style dashboard but not the
      // immersive sidebar tour.
      const eligibleRole = role === "firm_admin" || role === "accountant" || role === "personal";
      const verified = !!fu.email_verified_at;
      const onboardingDone = !!fu.onboarding_completed || !!fu.onboarding_skipped;
      const alreadyDone = !!fu.tour_completed_at || !!fu.tour_skipped_at;

      const roleChapters = getChaptersForRole(role);
      setChapters(roleChapters);

      if (eligibleRole && verified && onboardingDone && !alreadyDone && roleChapters.length > 0) {
        startTour();
      }
    } catch {
      // Quiet — tour is non-critical, never block the dashboard.
    }
  }, []);

  useEffect(() => {
    checkEligibility();

    const onReplay = () => startTour();
    const onOnboardingFinished = () => checkEligibility();
    window.addEventListener("first-login-tour:start", onReplay);
    window.addEventListener("receipture:onboarding-finished", onOnboardingFinished);
    return () => {
      window.removeEventListener("first-login-tour:start", onReplay);
      window.removeEventListener("receipture:onboarding-finished", onOnboardingFinished);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tour lifecycle ────────────────────────────────────────────────
  async function startTour() {
    if (seedingStartedRef.current) return; // dedupe accidental double-fire
    seedingStartedRef.current = true;
    setState({ kind: "seeding" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        await fetch("/api/seed-demo-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch (err) {
      console.warn("[SidebarTour] seed failed (non-blocking):", err);
    } finally {
      seedingStartedRef.current = false;
      setState({ kind: "running", chapterIdx: 0, stepIdx: 0 });
    }
  }

  function endTour(field: "tour_completed_at" | "tour_skipped_at") {
    setState({ kind: "idle" });
    setShowChapters(false);
    setTargetRect(null);
    if (!authUserId) return;
    const now = new Date().toISOString();
    const opposite = field === "tour_completed_at" ? "tour_skipped_at" : "tour_completed_at";
    supabase
      .from("firm_users")
      .update({ [field]: now, [opposite]: null })
      .eq("auth_user_id", authUserId)
      .then(() => {});
  }

  // ── Step navigation ───────────────────────────────────────────────
  function currentStep(): TourStep | null {
    if (state.kind !== "running") return null;
    return chapters[state.chapterIdx]?.steps[state.stepIdx] ?? null;
  }

  function goToStep(chapterIdx: number, stepIdx: number) {
    if (chapterIdx < 0 || chapterIdx >= chapters.length) return;
    const chapter = chapters[chapterIdx];
    if (!chapter) return;
    if (stepIdx < 0 || stepIdx >= chapter.steps.length) return;
    setState({ kind: "running", chapterIdx, stepIdx });
    setShowChapters(false);
  }

  function next() {
    if (state.kind !== "running") return;
    const chapter = chapters[state.chapterIdx];
    if (!chapter) return;
    if (state.stepIdx < chapter.steps.length - 1) {
      goToStep(state.chapterIdx, state.stepIdx + 1);
    } else if (state.chapterIdx < chapters.length - 1) {
      goToStep(state.chapterIdx + 1, 0);
    } else {
      endTour("tour_completed_at");
    }
  }

  function prev() {
    if (state.kind !== "running") return;
    if (state.stepIdx > 0) {
      goToStep(state.chapterIdx, state.stepIdx - 1);
    } else if (state.chapterIdx > 0) {
      const prevChapter = chapters[state.chapterIdx - 1];
      goToStep(state.chapterIdx - 1, prevChapter.steps.length - 1);
    }
  }

  // ── Route navigation when a step lives on a different page ────────
  useEffect(() => {
    const step = currentStep();
    if (!step) return;
    if (pathname !== step.route) {
      router.push(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Find + track the highlighted element ──────────────────────────
  useEffect(() => {
    const step = currentStep();
    if (!step) {
      setTargetRect(null);
      return;
    }
    if (!step.selector) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let observer: MutationObserver | null = null;

    function updateRect() {
      if (cancelled) return;
      const el = document.querySelector(step!.selector!) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    function pollUntilFound(attempts: number) {
      if (cancelled) return;
      const el = document.querySelector(step!.selector!);
      if (el) {
        updateRect();
        observer = new MutationObserver(() => updateRect());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        return;
      }
      if (attempts <= 0) return;
      raf = window.setTimeout(() => pollUntilFound(attempts - 1), 50) as unknown as number;
    }

    pollUntilFound(40); // wait up to ~2s

    function onScrollOrResize() {
      updateRect();
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelled = true;
      if (raf) clearTimeout(raf);
      if (observer) observer.disconnect();
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pathname]);

  // ── Render ────────────────────────────────────────────────────────
  if (state.kind === "idle") return null;

  if (state.kind === "seeding") {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-accent-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Setting up your demo
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adding a few sample clients and receipts so you have something to explore. One moment…
          </p>
        </div>
      </div>
    );
  }

  const step = currentStep();
  if (!step) return null;

  const totalSteps = chapters.reduce((sum, c) => sum + c.steps.length, 0);
  const stepNumber = chapters
    .slice(0, state.chapterIdx)
    .reduce((sum, c) => sum + c.steps.length, 0) + state.stepIdx + 1;
  const chapter = chapters[state.chapterIdx];

  return (
    <>
      {/* Spotlight: 4 dim rectangles framing the target, OR a single
          full-screen dim if no selector. */}
      {targetRect && step.selector ? (
        <SpotlightFrame rect={targetRect} />
      ) : (
        <div className="fixed inset-0 bg-black/60 z-[55] pointer-events-auto" />
      )}

      {/* Popover */}
      <div
        className="fixed z-[60] pointer-events-auto"
        style={popoverStyle(step.position, targetRect)}
      >
        <div
          className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border w-full overflow-y-auto"
          style={{ maxWidth: POPOVER_MAX_WIDTH, maxHeight: "calc(100vh - 32px)" }}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-accent-600 dark:text-accent-400 uppercase tracking-wide mb-1">
                  {chapter.title}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{step.title}</h3>
              </div>
              <button
                onClick={() => endTour("tour_skipped_at")}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                title="Skip tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              {step.body}
            </p>

            {/* Progress bar */}
            <div className="flex gap-1 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < stepNumber - 1
                      ? "bg-accent-300 dark:bg-accent-700"
                      : i === stepNumber - 1
                      ? "bg-accent-500"
                      : "bg-gray-200 dark:bg-dark-border"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowChapters(true)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Chapters
              </button>
              <div className="flex items-center gap-1">
                {(state.chapterIdx > 0 || state.stepIdx > 0) && (
                  <button
                    onClick={prev}
                    className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                    title="Previous"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => endTour("tour_skipped_at")}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Skip tour
                </button>
                <button
                  onClick={next}
                  className="px-4 py-2 text-sm font-medium bg-accent-600 text-white rounded-lg hover:bg-accent-700 flex items-center gap-1"
                >
                  {stepNumber === totalSteps ? "Finish" : "Continue"}
                  {stepNumber !== totalSteps && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
              Step {stepNumber} of {totalSteps}
            </div>
          </div>
        </div>
      </div>

      {/* Chapters drawer */}
      {showChapters && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowChapters(false)}>
          <div
            className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Chapters
              </h3>
              <button onClick={() => setShowChapters(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              {chapters.map((c, ci) => (
                <button
                  key={c.id}
                  onClick={() => goToStep(ci, 0)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    ci === state.chapterIdx
                      ? "bg-accent-50 dark:bg-accent-900/20 text-accent-900 dark:text-accent-100"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {c.steps.length} step{c.steps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SpotlightFrame({ rect }: { rect: ElementRect }) {
  const padding = 6;
  const top = rect.top - padding;
  const left = rect.left - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;
  return (
    <>
      {/* Top */}
      <div
        className="fixed bg-black/60 z-[55] pointer-events-auto transition-all"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }}
      />
      {/* Bottom */}
      <div
        className="fixed bg-black/60 z-[55] pointer-events-auto transition-all"
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      {/* Left */}
      <div
        className="fixed bg-black/60 z-[55] pointer-events-auto transition-all"
        style={{ top, left: 0, width: Math.max(0, left), height }}
      />
      {/* Right */}
      <div
        className="fixed bg-black/60 z-[55] pointer-events-auto transition-all"
        style={{ top, left: left + width, right: 0, height }}
      />
      {/* Highlighted ring */}
      <div
        className="fixed pointer-events-none rounded-lg ring-2 ring-accent-400 z-[55] transition-all"
        style={{ top, left, width, height }}
      />
    </>
  );
}

function popoverStyle(position: TourPosition | undefined, rect: ElementRect | null): React.CSSProperties {
  // No element to anchor to — center on viewport.
  if (!rect || !position || position === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "100%",
      maxWidth: POPOVER_MAX_WIDTH,
    };
  }
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(POPOVER_MAX_WIDTH, vw - 32);

  let top = 0;
  let left = 0;
  // For left/right anchored popovers we want them to have as much vertical
  // space as possible. When the target is in the bottom half of the viewport
  // (e.g. the sidebar Settings link, which sits near the bottom), anchor
  // the popover near the top of the viewport so its internal scroll can
  // use the full height. Otherwise center it on the target.
  const targetCenterY = rect.top + rect.height / 2;
  const anchorTop = targetCenterY > vh / 2 ? 16 : Math.max(16, targetCenterY - 100);

  if (position === "top") {
    top = Math.max(16, rect.top - POPOVER_GAP - 200);
    left = clamp(rect.left + rect.width / 2 - w / 2, 16, vw - w - 16);
  } else if (position === "bottom") {
    top = rect.top + rect.height + POPOVER_GAP;
    left = clamp(rect.left + rect.width / 2 - w / 2, 16, vw - w - 16);
  } else if (position === "left") {
    top = anchorTop;
    left = Math.max(16, rect.left - POPOVER_GAP - w);
  } else if (position === "right") {
    top = anchorTop;
    left = rect.left + rect.width + POPOVER_GAP;
  }
  return { top, left, width: w };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
