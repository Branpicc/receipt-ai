"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";

type ClientWithReport = {
  id: string;
  name: string;
  email_alias: string | null;
  latest_report_month: string | null;
  latest_report_spend: number | null;
  latest_report_receipts: number | null;
  has_report: boolean;
};

export default function ReportsIndexPage() {
  const [clients, setClients] = useState<ClientWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const firmId = await getMyFirmId();

      // Load all active clients
      const { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, name, email_alias")
        .eq("firm_id", firmId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      // Load latest report for each client
      const withReports = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { data: latestReport } = await supabase
            .from("client_reports")
            .select("report_month, total_spend_cents, total_receipts")
            .eq("client_id", client.id)
            .order("report_month", { ascending: false })
            .limit(1)
            .single();

          return {
            ...client,
            latest_report_month: latestReport?.report_month || null,
            latest_report_spend: latestReport?.total_spend_cents || null,
            latest_report_receipts: latestReport?.total_receipts || null,
            has_report: !!latestReport,
          };
        })
      );

      // Sort — clients with reports first, then alphabetically
      withReports.sort((a, b) => {
        if (a.has_report && !b.has_report) return -1;
        if (!a.has_report && b.has_report) return 1;
        return a.name.localeCompare(b.name);
      });

      setClients(withReports);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateAllReports() {
    if (!confirm("Generate reports for all clients for the current month?")) return;
    setGeneratingAll(true);
    try {
      const firmId = await getMyFirmId();
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      let succeeded = 0;
      let failed = 0;

      for (const client of clients) {
        try {
          const response = await fetch("/api/generate-monthly-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: client.id, firmId, month }),
          });
          if (response.ok) succeeded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      alert(`✅ Done — ${succeeded} generated, ${failed} failed`);
      await loadClients();
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setGeneratingAll(false);
    }
  }

  function formatMonth(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
    });
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const withReports = filtered.filter((c) => c.has_report);
  const withoutReports = filtered.filter((c) => !c.has_report);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Client Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monthly spending reports for all clients — auto-generated at month end
            </p>
          </div>
          <button
            onClick={generateAllReports}
            disabled={generatingAll || clients.length === 0}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generatingAll ? "Generating..." : "⚡ Generate All"}
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading clients...
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No clients yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Add clients to start generating reports
            </p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Clients with reports */}
            {withReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Reports Available ({withReports.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {withReports.map((client) => (
                    <Link
                      key={client.id}
                      href={`/dashboard/reports/${client.id}`}
                      className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 hover:border-accent-500 dark:hover:border-accent-500 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center text-accent-700 dark:text-accent-300 font-bold text-sm">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                              {client.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Latest: {formatMonth(client.latest_report_month!)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                          ✓ Report ready
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total Spend</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            ${((client.latest_report_spend || 0) / 100).toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Receipts</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {client.latest_report_receipts || 0}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-accent-600 dark:text-accent-400 font-medium group-hover:underline">
                        View full report →
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Clients without reports */}
            {withoutReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  No Reports Yet ({withoutReports.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {withoutReports.map((client) => (
                    <Link
                      key={client.id}
                      href={`/dashboard/reports/${client.id}`}
                      className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 hover:border-accent-400 dark:hover:border-accent-400 transition-all group opacity-75 hover:opacity-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-hover flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-sm">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                            {client.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No reports generated yet
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                          Generate →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}