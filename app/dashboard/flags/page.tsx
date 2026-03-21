"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Flag = {
  id: string;
  receipt_id: string;
  flag_type: string;
  severity: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  receipt?: {
    vendor: string | null;
    total_cents: number | null;
    receipt_date: string | null;
    client_id: string | null;
  };
  client?: {
    name: string;
  };
};

type FilterType = "all" | "unresolved" | "resolved";
type SeverityFilter = "all" | "high" | "medium" | "low";
type FlagTypeFilter = "all" | "mismatch" | "missing_info" | "duplicate" | "manual";

export default function FlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterType>("unresolved");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [flagTypeFilter, setFlagTypeFilter] = useState<FlagTypeFilter>("all");

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (userRole) {
      loadFlags();
    }
  }, [statusFilter, severityFilter, flagTypeFilter, userRole]);

  async function checkAccess() {
    const role = await getUserRole();
    setUserRole(role);

    if (role !== "firm_admin" && role !== "owner" && role !== "accountant") {
      alert("Access denied. Only firm admins and accountants can view flags.");
      router.push("/dashboard");
      return;
    }
  }

  async function loadFlags() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      let query = supabase
        .from("receipt_flags")
        .select(`
          id,
          receipt_id,
          flag_type,
          severity,
          message,
          created_at,
          resolved_at,
          receipts (
            vendor,
            total_cents,
            receipt_date,
            client_id,
            clients (
              name
            )
          )
        `)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      // Status filter
      if (statusFilter === "unresolved") {
        query = query.is("resolved_at", null);
      } else if (statusFilter === "resolved") {
        query = query.not("resolved_at", "is", null);
      }

      // Severity filter
      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }

      // Flag type filter
      if (flagTypeFilter !== "all") {
        query = query.eq("flag_type", flagTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

// Transform nested data - handle Supabase array returns
const transformedFlags = (data || []).map(flag => {
  const receipt = Array.isArray(flag.receipts) ? flag.receipts[0] : flag.receipts;
  const client = receipt?.clients ? (Array.isArray(receipt.clients) ? receipt.clients[0] : receipt.clients) : null;
  
  return {
    ...flag,
    receipt: receipt ? {
      vendor: receipt.vendor,
      total_cents: receipt.total_cents,
      receipt_date: receipt.receipt_date,
      client_id: receipt.client_id,
    } : undefined,
    client: client ? { name: client.name } : undefined,
  };
});

setFlags(transformedFlags as Flag[]);
    } catch (error: any) {
      console.error("Failed to load flags:", error);
      alert("Failed to load flags: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function resolveFlag(flagId: string) {
    try {
      const { error } = await supabase
        .from("receipt_flags")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", flagId);

      if (error) throw error;

      alert("✅ Flag resolved");
      loadFlags();
    } catch (error: any) {
      console.error("Failed to resolve flag:", error);
      alert("Failed to resolve flag: " + error.message);
    }
  }

  async function unresolveFlag(flagId: string) {
    try {
      const { error } = await supabase
        .from("receipt_flags")
        .update({ resolved_at: null })
        .eq("id", flagId);

      if (error) throw error;

      alert("✅ Flag reopened");
      loadFlags();
    } catch (error: any) {
      console.error("Failed to reopen flag:", error);
      alert("Failed to reopen flag: " + error.message);
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case "high":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "low":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300";
    }
  }

  function getFlagTypeIcon(flagType: string) {
    switch (flagType) {
      case "mismatch":
        return "⚠️";
      case "missing_info":
        return "❓";
      case "duplicate":
        return "📋";
      case "manual":
        return "🚩";
      default:
        return "⚠️";
    }
  }

  if (loading && !userRole) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const unresolvedCount = flags.filter(f => !f.resolved_at).length;
  const highSeverityCount = flags.filter(f => f.severity === "high" && !f.resolved_at).length;

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Flagged Receipts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and resolve receipt issues across your firm
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Flags</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{flags.length}</div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Unresolved</div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{unresolvedCount}</div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">High Priority</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{highSeverityCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <div className="flex gap-2">
                {(["all", "unresolved", "resolved"] as FilterType[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                      statusFilter === status
                        ? "bg-accent-500 text-white"
                        : "bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Flag Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Flag Type
              </label>
              <select
                value={flagTypeFilter}
                onChange={(e) => setFlagTypeFilter(e.target.value as FlagTypeFilter)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="mismatch">Mismatches</option>
                <option value="missing_info">Missing Info</option>
                <option value="duplicate">Duplicates</option>
                <option value="manual">Manual Flags</option>
              </select>
            </div>
          </div>
        </div>

        {/* Flags List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading flags...
          </div>
        ) : flags.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-12 text-center border border-transparent dark:border-dark-border">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Flags Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {statusFilter === "unresolved" 
                ? "All receipts are properly categorized!" 
                : "No flags match your current filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-dark-border">
              {flags.map((flag) => (
                <div key={flag.id} className="p-6 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getFlagTypeIcon(flag.flag_type)}</span>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {flag.receipt?.vendor || "Unknown Vendor"}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {flag.receipt?.receipt_date || "No date"} • 
                            ${((flag.receipt?.total_cents || 0) / 100).toFixed(2)}
                            {flag.client && ` • ${flag.client.name}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(flag.severity)}`}>
                          {flag.severity?.toUpperCase() || "UNKNOWN"}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                          {flag.flag_type?.replace("_", " ").toUpperCase()}
                        </span>
                      </div>

                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        {flag.message}
                      </p>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Flagged {new Date(flag.created_at).toLocaleDateString()}
                        {flag.resolved_at && (
                          <span> • Resolved {new Date(flag.resolved_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Link
                        href={`/dashboard/receipts/${flag.receipt_id}`}
                        className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600 text-center"
                      >
                        View Receipt
                      </Link>

                      {!flag.resolved_at ? (
                        <button
                          onClick={() => resolveFlag(flag.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => unresolveFlag(flag.id)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}