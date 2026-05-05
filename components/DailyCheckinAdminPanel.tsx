"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { CheckCircle2, Circle, Trophy, Users } from "lucide-react";

/**
 * Firm-admin only panel for the daily check-in feature.
 *
 * Two views:
 *   • Today  — list of every accountant in the firm with today's
 *              completion status (3 step icons + a final ✓ if they're
 *              all the way done). Sat/Sun: shows "Weekend — no check-in
 *              required" and skips the missed indicators.
 *   • Leaderboard — rolling 7-day / 30-day count of receipts an
 *              accountant categorized (set approved_category from null).
 *              Counts pulled from receipt_edits because that's where
 *              we know who did the change.
 *
 * Owner accounts are excluded from the listing per spec.
 */

type Accountant = { id: string; display_name: string | null; auth_user_id: string };
type Completion = {
  accountant_id: string;
  email_inbox_visited_at: string | null;
  flags_reviewed_at: string | null;
  completed_at: string | null;
  receipts_categorized_today: number;
};

function todayISO(): string {
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

export default function DailyCheckinAdminPanel() {
  const [tab, setTab] = useState<"today" | "leaderboard">("today");
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [completions, setCompletions] = useState<Map<string, Completion>>(new Map());
  const [leaderboardWindow, setLeaderboardWindow] = useState<7 | 30>(7);
  const [leaderboard, setLeaderboard] = useState<{ accountant_id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const firmId = await getMyFirmId();

        // Pull all accountants (not owners — owners aren't shown per spec).
        const { data: accts } = await supabase
          .from("firm_users")
          .select("id, display_name, auth_user_id")
          .eq("firm_id", firmId)
          .eq("role", "accountant")
          .order("display_name", { ascending: true });
        setAccountants((accts || []) as Accountant[]);

        // Today's completions for every accountant.
        const { data: rows } = await supabase
          .from("daily_checklist_completions")
          .select("accountant_id, email_inbox_visited_at, flags_reviewed_at, completed_at, receipts_categorized_today")
          .eq("firm_id", firmId)
          .eq("completion_date", todayISO());
        const map = new Map<string, Completion>();
        for (const r of rows || []) map.set(r.accountant_id, r as Completion);
        setCompletions(map);
      } catch (err) {
        console.warn("[DailyCheckinAdminPanel] load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Lazy-load the leaderboard the first time the user clicks the tab.
  useEffect(() => {
    if (tab !== "leaderboard") return;
    let cancelled = false;
    (async () => {
      try {
        const firmId = await getMyFirmId();
        const since = new Date();
        since.setDate(since.getDate() - leaderboardWindow);
        // Receipts categorized = receipt_edits where 'approved_category'
        // appears in the changes JSON for the period. Group by editor.
        const { data: edits } = await supabase
          .from("receipt_edits")
          .select("firm_user_id, changes")
          .eq("firm_id", firmId)
          .gte("created_at", since.toISOString());
        const counts = new Map<string, number>();
        for (const e of edits || []) {
          if (!e.firm_user_id) continue;
          const changes = e.changes as Record<string, unknown> | null;
          if (changes && Object.prototype.hasOwnProperty.call(changes, "approved_category")) {
            counts.set(e.firm_user_id, (counts.get(e.firm_user_id) || 0) + 1);
          }
        }
        const list = Array.from(counts.entries())
          .map(([accountant_id, count]) => ({ accountant_id, count }))
          .sort((a, b) => b.count - a.count);
        if (!cancelled) setLeaderboard(list);
      } catch (err) {
        console.warn("[DailyCheckinAdminPanel] leaderboard load failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, leaderboardWindow]);

  if (loading) return null;
  if (accountants.length === 0) return null;

  const weekend = isWeekend();

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          Daily check-ins
        </h3>
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-dark-bg">
          <button
            onClick={() => setTab("today")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              tab === "today"
                ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              tab === "leaderboard"
                ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard
          </button>
        </div>
      </div>

      {tab === "today" && (
        <>
          {weekend && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Weekend — no check-in expected. Showing whoever decided to log on anyway.
            </p>
          )}
          <ul className="divide-y divide-gray-100 dark:divide-dark-border">
            {accountants.map(a => {
              const c = completions.get(a.id);
              const r = c?.receipts_categorized_today || 0;
              const e = !!c?.email_inbox_visited_at;
              const f = !!c?.flags_reviewed_at;
              const done = !!c?.completed_at;
              return (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    {a.display_name || "Unnamed accountant"}
                  </span>
                  <div className="flex items-center gap-1.5 ml-3 flex-shrink-0" title="Receipts · Email · Flags">
                    <StepIcon ok={r >= 3} label={`${r}/3 receipts`} />
                    <StepIcon ok={e} label="Email inbox" />
                    <StepIcon ok={f} label="Flags" />
                    {done && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide font-semibold text-green-700 dark:text-green-400">
                        Done
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "leaderboard" && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">Window:</span>
            <button
              onClick={() => setLeaderboardWindow(7)}
              className={`text-xs px-2.5 py-1 rounded ${
                leaderboardWindow === 7
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400"
              }`}
            >
              7 days
            </button>
            <button
              onClick={() => setLeaderboardWindow(30)}
              className={`text-xs px-2.5 py-1 rounded ${
                leaderboardWindow === 30
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400"
              }`}
            >
              30 days
            </button>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No category edits in the last {leaderboardWindow} days yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.map((row, idx) => {
                const acct = accountants.find(a => a.id === row.accountant_id);
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                return (
                  <li key={row.accountant_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-dark-hover">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 w-5 text-right">{medal || `${idx + 1}.`}</span>
                      <span className="text-sm text-gray-900 dark:text-white truncate">
                        {acct?.display_name || "Unknown"}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {row.count}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
            Counts every receipt where an accountant set the approved category in the rolling window.
          </p>
        </>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border">
        <Link
          href="/dashboard/team"
          className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
        >
          Manage team →
        </Link>
      </div>
    </div>
  );
}

function StepIcon({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="relative" title={label}>
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      )}
    </span>
  );
}
