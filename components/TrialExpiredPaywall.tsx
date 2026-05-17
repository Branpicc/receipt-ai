"use client";

// components/TrialExpiredPaywall.tsx
//
// Personal-account paywall. Mounted by the dashboard layout. Reads
// firms.trial_ends_at + subscription_status. When the trial is over
// AND the user hasn't subscribed (status !== 'active' && !== 'trialing'
// past the deadline), shows a non-dismissable overlay over the entire
// dashboard. The only escape is the "Subscribe now" button which kicks
// off Stripe Checkout for the Personal plan.
//
// We don't try to PREVENT data load — we just stop the user from
// interacting with anything until they subscribe. That's gentler than
// blocking API calls, which would break the back-link from Stripe's
// success page.

import { useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getMyAccountType } from "@/lib/getMyAccountType";

type Plan = {
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_tier: string | null;
};

// Cache the active-subscription answer for 60 seconds. The dashboard
// layout remounts this component on every page navigation; without the
// cache, that fires a fresh Supabase round-trip each time even though
// a user's subscription status almost never changes mid-session. 60s
// is short enough that a webhook-triggered upgrade is reflected
// quickly, long enough to absorb routine navigation.
const CACHE_KEY = "receipture-cache:v1:paywallState";
const CACHE_TTL_MS = 60 * 1000;
type CachedState = {
  shouldBlock: boolean;
  trialEndsAt: string | null; // ISO
  fetchedAt: number;
};
function readCache(): CachedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as CachedState;
    if (Date.now() - v.fetchedAt > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}
function writeCache(v: CachedState) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

export default function TrialExpiredPaywall() {
  const [shouldBlock, setShouldBlock] = useState(false);
  const [opening, setOpening] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Hydrate from cache immediately so the paywall doesn't briefly
    // disappear-then-reappear on quick navigations.
    const cached = readCache();
    if (cached) {
      if (cancelled) return;
      setShouldBlock(cached.shouldBlock);
      if (cached.trialEndsAt) setTrialEndsAt(new Date(cached.trialEndsAt));
      // Still refresh in the background so a paywall lift triggered by
      // a webhook (e.g. user just subscribed in another tab) is picked
      // up within the next minute.
    }

    (async () => {
      try {
        // Personal-only: firm accounts have their own seat-count gating
        // and don't use this paywall.
        const at = await getMyAccountType();
        if (at !== "personal") {
          // Cache the "no block" decision so we don't re-run the check
          // on every page nav for firm accounts either.
          writeCache({ shouldBlock: false, trialEndsAt: null, fetchedAt: Date.now() });
          return;
        }
        const firmId = await getMyFirmId();
        const { data } = await supabase
          .from("firms")
          .select("trial_ends_at, subscription_status, subscription_plan, subscription_tier")
          .eq("id", firmId)
          .single<Plan>();
        if (cancelled || !data) return;

        let nextBlock = false;
        let nextTrialEndsAt: string | null = null;

        // Active paying customer? Never block.
        if (data.subscription_status !== "active") {
          // Trial deadline check. If trial_ends_at is null we have no
          // hard deadline (legacy account created before the column
          // existed) — be permissive.
          if (data.trial_ends_at) {
            const ends = new Date(data.trial_ends_at);
            nextTrialEndsAt = ends.toISOString();
            if (Date.now() >= ends.getTime()) nextBlock = true;
          }
        }

        if (!cancelled) {
          setShouldBlock(nextBlock);
          setTrialEndsAt(nextTrialEndsAt ? new Date(nextTrialEndsAt) : null);
        }
        writeCache({ shouldBlock: nextBlock, trialEndsAt: nextTrialEndsAt, fetchedAt: Date.now() });
      } catch (err) {
        console.warn("[TrialExpiredPaywall] check failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubscribe() {
    if (opening) return;
    setOpening(true);
    try {
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Your session expired. Please sign in again.");
        return;
      }
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planName: "personal",
          firmId,
          interval: "monthly",
        }),
      });
      const { url, error } = await res.json();
      if (error) {
        alert("Could not start checkout: " + error);
        return;
      }
      if (url) window.location.href = url;
    } catch (err: any) {
      alert("Could not start checkout: " + (err?.message || "unknown error"));
    } finally {
      setOpening(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!shouldBlock) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-200 dark:border-dark-border">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-accent-600 dark:text-accent-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Your free trial has ended
        </h2>
        {trialEndsAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Trial ended {trialEndsAt.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.
          </p>
        )}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Subscribe to the Personal plan to keep accessing your receipts,
          goals, reports, and tax-prep tools. Your data is safe — nothing
          is deleted while you decide.
        </p>

        <div className="bg-gray-50 dark:bg-dark-bg rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-500" />
              Personal plan
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              $6.99<span className="text-xs font-normal text-gray-500 dark:text-gray-400">/mo</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Unlimited receipts · AI categorization · CRA tax-prep forms · .xlsx exports · Goals + Paycheck Splitter
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cancel anytime from Settings → Billing.
          </p>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={opening}
          className="w-full py-3 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl mb-3"
        >
          {opening ? "Opening checkout…" : "Subscribe now →"}
        </button>
        <button
          onClick={handleSignOut}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
