"use client";

import { useEffect, useState } from "react";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";
import { getUserRole } from "@/lib/getUserRole";

export default function UsageStats({ onRefresh }: { onRefresh?: () => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const role = await getUserRole();
      setUserRole(role);

      // Only firm admins and owners see usage stats
      if (role !== "firm_admin" && role !== "owner") {
        setLoading(false);
        return;
      }

      const firmId = await getMyFirmId();

      const { data: firm } = await supabase
        .from("firms")
        .select("subscription_tier, subscription_plan, subscription_status")
        .eq("id", firmId)
        .single();

      const plan = firm?.subscription_tier || firm?.subscription_plan || "starter";

      const limits: Record<string, { clients: number; users: number }> = {
        trial: { clients: 20, users: 3 },
        starter: { clients: 5, users: 1 },
        professional: { clients: 20, users: 3 },
        enterprise: { clients: -1, users: -1 },
      };

      const planLimits = limits[plan] || limits.starter;

      // Count active clients
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("is_active", true);

      // Count accountants only (firm_admin excluded)
      const { count: accountantCount } = await supabase
        .from("firm_users")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("role", "accountant");

      const clients = clientCount || 0;
      const accountants = accountantCount || 0;
      const clientLimit = planLimits.clients;
      const userLimit = planLimits.users;

      setStats({
        plan,
        clients,
        clientLimit,
        accountants,
        userLimit,
        clientPercentage: clientLimit === -1 ? 0 : Math.round((clients / clientLimit) * 100),
        isNearClientLimit: clientLimit !== -1 && clients / clientLimit >= 0.8,
        isAtClientLimit: clientLimit !== -1 && clients >= clientLimit,
      });
    } catch (error) {
      console.error("Failed to load usage stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Don't render for non-admins or while loading
  if (loading || !stats || (userRole !== "firm_admin" && userRole !== "owner")) {
    return null;
  }

  const clientsUnlimited = stats.clientLimit === -1;
  const usersUnlimited = stats.userLimit === -1;

  return (
    <div className={`rounded-2xl border p-6 ${
      stats.isAtClientLimit
        ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"
        : stats.isNearClientLimit
        ? "border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20"
        : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Plan Usage</h3>
        <a
          href="/dashboard/billing"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
        >
          Manage Plan
        </a>
      </div>

      <div className="space-y-4">
        {/* Clients */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clients</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {stats.clients} / {clientsUnlimited ? "∞" : stats.clientLimit}
            </span>
          </div>
          {!clientsUnlimited && (
            <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  stats.isAtClientLimit ? "bg-red-500" : stats.isNearClientLimit ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(stats.clientPercentage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Accountants */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Accountants</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {stats.accountants} / {usersUnlimited ? "∞" : stats.userLimit}
            </span>
          </div>
          {!usersUnlimited && (
            <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all bg-blue-500"
                style={{ width: `${Math.min(Math.round((stats.accountants / stats.userLimit) * 100), 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Receipts */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Receipts</span>
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">Unlimited</span>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
          {stats.plan} plan
        </p>

        {stats.isAtClientLimit && (
          <div className="pt-3 border-t border-red-200 dark:border-red-900">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">
              ⚠️ Client limit reached
            </p>
            <a
              href="/dashboard/billing"
              className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Upgrade Plan
            </a>
          </div>
        )}

        {stats.isNearClientLimit && !stats.isAtClientLimit && (
          <div className="pt-3 border-t border-yellow-200 dark:border-yellow-900">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Approaching client limit — {stats.clientLimit - stats.clients} slot{stats.clientLimit - stats.clients !== 1 ? "s" : ""} remaining
            </p>
          </div>
        )}
      </div>
    </div>
  );
}