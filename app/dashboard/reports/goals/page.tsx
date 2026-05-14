"use client";

// app/dashboard/reports/goals/page.tsx
//
// Goals contribution report — personal accounts only. Lets the user
// pick a window (this month / quarter / half-year / year / all time /
// custom) and shows total contributed per goal plus a per-row history.
// Two download options: CSV (in-browser, no server round-trip) and
// styled .xlsx (server route).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getMyAccountType } from "@/lib/getMyAccountType";
import type { Goal, GoalContribution } from "@/lib/goalTypes";

type Period = "month" | "quarter" | "half" | "year" | "all" | "custom";

type ContributionRow = GoalContribution & { goal: Goal };

function periodStart(period: Period, customFrom: string | null): Date | null {
  if (period === "all") return null;
  if (period === "custom") return customFrom ? new Date(customFrom) : null;
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  if (period === "half") {
    const sixAgo = new Date(now);
    sixAgo.setMonth(now.getMonth() - 6);
    return new Date(sixAgo.getFullYear(), sixAgo.getMonth(), 1);
  }
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function GoalsReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contribs, setContribs] = useState<GoalContribution[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const t = await getMyAccountType();
      if (t !== "personal") {
        router.replace("/dashboard/reports");
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

      const { data: goalsData } = await supabase
        .from("personal_goals")
        .select("*")
        .eq("client_id", firmUser.client_id);
      setGoals((goalsData || []) as Goal[]);

      const ids = (goalsData || []).map((g: any) => g.id);
      if (ids.length > 0) {
        const { data: contribsData } = await supabase
          .from("goal_contributions")
          .select("*")
          .in("goal_id", ids)
          .order("contributed_at", { ascending: false });
        setContribs((contribsData || []) as GoalContribution[]);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo<ContributionRow[]>(() => {
    const start = periodStart(period, customFrom || null);
    const end = period === "custom" && customTo ? new Date(customTo) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const goalsById = new Map(goals.map(g => [g.id, g]));
    return contribs
      .filter(c => {
        const at = new Date(c.contributed_at);
        if (start && at < start) return false;
        if (end && at > end) return false;
        return true;
      })
      .map(c => ({ ...c, goal: goalsById.get(c.goal_id)! }))
      .filter(c => c.goal); // archived goals still have contributions but goal record may be missing
  }, [contribs, goals, period, customFrom, customTo]);

  // Per-goal totals for the summary card.
  const perGoal = useMemo(() => {
    const map = new Map<string, { goal: Goal; cents: number; count: number }>();
    filtered.forEach(r => {
      const entry = map.get(r.goal.id) || { goal: r.goal, cents: 0, count: 0 };
      entry.cents += r.amount_cents;
      entry.count += 1;
      map.set(r.goal.id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.cents - a.cents);
  }, [filtered]);

  const totalCents = filtered.reduce((s, r) => s + r.amount_cents, 0);

  function downloadCsv() {
    const headers = ["Date", "Goal", "Category", "Amount", "Source", "Note"];
    const rows = filtered.map(r => [
      new Date(r.contributed_at).toLocaleDateString("en-CA"),
      r.goal.name,
      r.goal.category,
      (r.amount_cents / 100).toFixed(2),
      r.source,
      r.note || "",
    ]);
    rows.push(["", "TOTAL", "", (totalCents / 100).toFixed(2), "", ""]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Goals-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadXlsx() {
    if (!firmId) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Session expired. Sign in again."); return; }
      const start = periodStart(period, customFrom || null);
      const end = period === "custom" && customTo ? new Date(customTo) : null;
      const res = await fetch("/api/exports/goals-xlsx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firmId,
          clientId,
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null,
          periodLabel: period,
        }),
      });
      if (!res.ok) {
        alert("Export failed: " + (await res.text()));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Goals-${period}-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Target className="w-8 h-8 text-accent-500" /> Goal Contributions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              See what you've contributed to each goal over any window. Export to CSV or .xlsx.
            </p>
          </div>
          <Link href="/dashboard/goals" className="text-sm text-accent-600 dark:text-accent-400 hover:underline whitespace-nowrap">
            ← Back to goals
          </Link>
        </div>

        {/* Period filter */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            {([
              ["month", "This month"],
              ["quarter", "This quarter"],
              ["half", "Last 6 months"],
              ["year", "This year"],
              ["all", "All time"],
              ["custom", "Custom range"],
            ] as [Period, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  period === key
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300"
                    : "border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-accent-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary + export */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total contributed in this window</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalCents / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {filtered.length} contribution{filtered.length === 1 ? "" : "s"} across {perGoal.length} goal{perGoal.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5 flex flex-col justify-center gap-2">
            <button
              onClick={downloadXlsx}
              disabled={exporting || filtered.length === 0}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? "Exporting…" : "Download .xlsx"}
            </button>
            <button
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 disabled:opacity-50 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        </div>

        {/* Per-goal totals */}
        {perGoal.length > 0 && (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-dark-border">
              <h3 className="font-semibold text-gray-900 dark:text-white">By goal</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {perGoal.map(g => (
                <div key={g.goal.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{g.goal.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{g.goal.category} · {g.count} contribution{g.count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${(g.cents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contribution history */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-dark-border">
            <h3 className="font-semibold text-gray-900 dark:text-white">Every contribution</h3>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No contributions in this window yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-dark-border max-h-[60vh] overflow-y-auto">
              {filtered.map(r => (
                <div key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {r.goal.name}
                      {r.source === "paycheck_split" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">paycheck</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.contributed_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                      {r.note && <span className="ml-2">· {r.note}</span>}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    ${(r.amount_cents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
