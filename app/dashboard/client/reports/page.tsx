"use client";

/**
 * Client-only entry point for viewing their own reports.
 *
 * Resolves the signed-in client's own client_id from firm_users and
 * forwards them to the existing per-client report page at
 * /dashboard/reports/clients/[clientId]. That page already gates the
 * generate buttons behind isFirmAdmin so clients land on a view-only
 * experience by default.
 *
 * Sidebar always links here (a stable URL, no per-client interpolation),
 * and we resolve once on mount.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useFeatureGate } from "@/lib/useFeatureGate";
import UpgradeRequired from "@/components/UpgradeRequired";

export default function ClientReportsPage() {
  const gate = useFeatureGate("client_reports");
  if (gate.loading) return null;
  if (!gate.allowed) return <UpgradeRequired feature="client_reports" />;
  return <ClientReportsRedirect />;
}

function ClientReportsRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setError("Not signed in.");
          return;
        }
        const { data: firmUser, error: fuErr } = await supabase
          .from("firm_users")
          .select("client_id, role")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (fuErr) throw fuErr;
        if (!firmUser) {
          if (!cancelled) setError("No firm membership found.");
          return;
        }
        if (firmUser.role !== "client" || !firmUser.client_id) {
          if (!cancelled) setError("This page is for client accounts.");
          return;
        }
        if (!cancelled) router.replace(`/dashboard/reports/clients/${firmUser.client_id}`);
      } catch (err) {
        const msg = (err as { message?: string })?.message || "Failed to load reports.";
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-2xl mx-auto">
        {error ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
            <h1 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Couldn&apos;t load your reports
            </h1>
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">{error}</p>
            <Link
              href="/dashboard/client"
              className="text-sm text-accent-600 dark:text-accent-400 underline"
            >
              ← Back to dashboard
            </Link>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Loading your reports…</p>
        )}
      </div>
    </div>
  );
}
