"use client";

// components/ClientMonthlyRevenueCard.tsx
//
// Small dashboard card that prompts the client to enter their monthly
// revenue. Shown:
//   • prominently on the 1st–7th of every month with last month's prompt
//   • collapsed/edit form for the current month otherwise
//
// Saves to client_monthly_revenue (one row per client / year / month).
// Feeds the Net Income report.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { DollarSign } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ClientMonthlyRevenueCard({ clientId }: { clientId: string | null }) {
  const [firmId, setFirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Two months we care about: last month (the prompt-on-the-1st) and the
  // current month (so users can also pre-enter it / update if they
  // already have a number).
  const now = new Date();
  const dayOfMonth = now.getDate();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthYear = lastMonth.getFullYear();
  const lastMonthMonth = lastMonth.getMonth() + 1;

  const [lastMonthRevenue, setLastMonthRevenue] = useState<string>("");
  const [hasLastMonthSaved, setHasLastMonthSaved] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      const fid = await getMyFirmId();
      setFirmId(fid);
      const { data } = await supabase
        .from("client_monthly_revenue")
        .select("revenue_cents")
        .eq("client_id", clientId)
        .eq("year", lastMonthYear)
        .eq("month", lastMonthMonth)
        .maybeSingle();
      if (data) {
        setLastMonthRevenue(((data.revenue_cents || 0) / 100).toFixed(2));
        setHasLastMonthSaved(true);
      }
      setLoading(false);
    })();
  }, [clientId, lastMonthYear, lastMonthMonth]);

  async function save() {
    if (!clientId || !firmId) return;
    const cents = Math.round((parseFloat(lastMonthRevenue.replace(/[^0-9.]/g, "")) || 0) * 100);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_monthly_revenue")
        .upsert(
          {
            client_id: clientId,
            firm_id: firmId,
            year: lastMonthYear,
            month: lastMonthMonth,
            revenue_cents: cents,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,year,month" }
        );
      if (error) throw error;
      setHasLastMonthSaved(true);
    } catch (err: any) {
      alert("Couldn't save revenue: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !clientId) return null;

  // Only nudge during the first week of the new month — once they save,
  // shrink the card so it stops dominating the dashboard.
  const isPromptWindow = dayOfMonth <= 7 && !hasLastMonthSaved;
  const monthLabel = `${MONTHS[lastMonthMonth - 1]} ${lastMonthYear}`;

  if (!isPromptWindow && hasLastMonthSaved) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Revenue for {monthLabel}</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">${lastMonthRevenue}</div>
          </div>
          <button
            onClick={() => setHasLastMonthSaved(false)}
            className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-5 mb-6 ${
      isPromptWindow
        ? "bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-700"
        : "bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border"
    }`}>
      <div className="flex items-start gap-3">
        <DollarSign className="w-6 h-6 text-accent-600 dark:text-accent-400 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {isPromptWindow ? `How much did you earn in ${monthLabel}?` : `Revenue for ${monthLabel}`}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            We use this with your tracked expenses to calculate net income for tax season. Just total revenue — no breakdown needed.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={lastMonthRevenue}
              onChange={(e) => setLastMonthRevenue(e.target.value)}
              placeholder="0.00"
              className="flex-1 px-3 py-2 text-base border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : hasLastMonthSaved ? "Update" : "Save"}
            </button>
          </div>
          {hasLastMonthSaved && !isPromptWindow && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-2">✓ Saved</p>
          )}
        </div>
      </div>
    </div>
  );
}
