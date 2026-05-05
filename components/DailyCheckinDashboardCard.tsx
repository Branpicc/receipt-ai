"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getAssignedClientIds } from "@/lib/getAssignedClients";
import { CheckCircle2, Sparkles } from "lucide-react";

/**
 * Accountant-only dashboard card for the 5-min daily check-in.
 *
 * States:
 *   • idle (haven't started today)        → "Start check-in" button
 *     with an optional client-filter dropdown so they can focus on a
 *     single client's outstanding receipts.
 *   • completed (completed_at is set)     → "Done for today" card with
 *     a "Still want to do more?" button that fires another run.
 *
 * Dispatches `daily-checkin:start` with optional { clientId } in the
 * detail. The DailyCheckinRunner overlay (mounted in dashboard layout)
 * picks it up and drives the rest.
 *
 * Saturday/Sunday: card hides itself entirely — no expectation to log
 * a check-in on weekends.
 */

type Client = { id: string; name: string };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

export default function DailyCheckinDashboardCard() {
  const [completed, setCompleted] = useState<boolean>(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const firmId = await getMyFirmId();
        const { data: fu } = await supabase
          .from("firm_users")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("firm_id", firmId)
          .maybeSingle();
        if (!fu) return;

        // Today's completion row (if any).
        const { data: row } = await supabase
          .from("daily_checklist_completions")
          .select("completed_at")
          .eq("accountant_id", fu.id)
          .eq("completion_date", todayISO())
          .maybeSingle();
        setCompletedAt(row?.completed_at || null);
        setCompleted(!!row?.completed_at);

        // Assigned clients for the optional filter dropdown.
        const ids = await getAssignedClientIds(firmId);
        if (ids && ids.length > 0) {
          const { data: clientRows } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", ids)
            .order("name");
          setClients((clientRows || []) as Client[]);
        }
      } catch (err) {
        console.warn("[DailyCheckinDashboardCard] init failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refresh when the runner finishes — listen for a window event.
  useEffect(() => {
    function onChange() {
      // Re-run the same load logic.
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const firmId = await getMyFirmId();
          const { data: fu } = await supabase
            .from("firm_users")
            .select("id")
            .eq("auth_user_id", user.id)
            .eq("firm_id", firmId)
            .maybeSingle();
          if (!fu) return;
          const { data: row } = await supabase
            .from("daily_checklist_completions")
            .select("completed_at")
            .eq("accountant_id", fu.id)
            .eq("completion_date", todayISO())
            .maybeSingle();
          setCompletedAt(row?.completed_at || null);
          setCompleted(!!row?.completed_at);
        } catch {
          // Quiet refresh.
        }
      })();
    }
    window.addEventListener("daily-checkin:state-changed", onChange);
    return () => window.removeEventListener("daily-checkin:state-changed", onChange);
  }, []);

  if (loading) return null;
  if (isWeekend()) return null;

  function startRun(continueMode = false) {
    window.dispatchEvent(
      new CustomEvent("daily-checkin:start", {
        detail: { clientId: selectedClientId || null, continueMode },
      })
    );
  }

  if (completed) {
    return (
      <div className="bg-gradient-to-br from-green-500 to-green-700 dark:from-green-600 dark:to-green-800 rounded-lg shadow-sm p-6 text-white">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">Daily check-in done</h3>
            <p className="text-sm text-green-50 mb-4">
              {completedAt
                ? `Finished at ${new Date(completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                : "Wrapped up earlier today."}{" "}
              Want to keep working through more receipts?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {clients.length > 1 && (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-sm text-gray-900 bg-white border border-white/40"
                >
                  <option value="">All my clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => startRun(true)}
                className="px-4 py-2 bg-white text-green-700 hover:bg-green-50 text-sm font-semibold rounded-lg transition-colors"
              >
                Still want to do more? →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-accent-500 to-accent-700 dark:from-accent-600 dark:to-accent-800 rounded-lg shadow-sm p-6 text-white">
      <div className="flex items-start gap-4">
        <Sparkles className="w-8 h-8 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">5-minute daily check-in</h3>
          <p className="text-sm text-accent-50 mb-4">
            Knock out 3 receipts, glance at the email inbox, review any flags. We&apos;ll guide you through it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {clients.length > 1 && (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-sm text-gray-900 bg-white border border-white/40"
              >
                <option value="">All my clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => startRun(false)}
              className="px-4 py-2 bg-white text-accent-700 hover:bg-accent-50 text-sm font-semibold rounded-lg transition-colors"
            >
              Start check-in →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
