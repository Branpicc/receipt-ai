// components/UsageStats.tsx
"use client";

import { useEffect, useState } from "react";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";

const PLAN_LIMITS = {
  free: {
    receipts: 10,
    users: 1,
  },
  starter: {
    receipts: 100,
    users: 1,
  },
  professional: {
    receipts: 999999,
    users: 3,
  },
  enterprise: {
    receipts: -1,
    users: -1,
  },
};

export default function UsageStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const firmId = await getMyFirmId();
      
      const { data: firm, error } = await supabase
        .from('firms')
        .select('subscription_plan, subscription_status, subscription_tier')
        .eq('id', firmId)
        .single();

      if (error) {
        console.error('Error loading firm:', error);
        setLoading(false);
        return;
      }

      const plan = firm?.subscription_tier || firm?.subscription_plan || 'free';
      
      if (plan !== 'free' && firm?.subscription_status !== 'active') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: regularCount } = await supabase
          .from("receipts")
          .select("*", { count: "exact", head: true })
          .eq("firm_id", firmId)
          .gte("created_at", startOfMonth.toISOString());

        const { count: emailCount } = await supabase
          .from("email_receipts")
          .select("*", { count: "exact", head: true })
          .eq("firm_id", firmId)
          .eq("status", "approved")
          .gte("created_at", startOfMonth.toISOString());

        const currentCount = (regularCount || 0) + (emailCount || 0);
        const freeLimit = 10;
        const percentage = Math.round((currentCount / freeLimit) * 100);

        setStats({
          currentCount,
          limit: freeLimit,
          percentage,
          plan: 'free',
          isNearLimit: percentage >= 80,
          isOverLimit: currentCount >= freeLimit,
        });
        setLoading(false);
        return;
      }

      const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: regularCount } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .gte("created_at", startOfMonth.toISOString());

      const { count: emailCount } = await supabase
        .from("email_receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("status", "approved")
        .gte("created_at", startOfMonth.toISOString());

      const currentCount = (regularCount || 0) + (emailCount || 0);
      const limit = planLimits?.receipts || 10;
      const percentage = limit === -1 || limit >= 999999 ? 0 : Math.round((currentCount / limit) * 100);

      setStats({
        currentCount,
        limit,
        percentage,
        plan,
        isNearLimit: percentage >= 80 && limit !== -1 && limit < 999999,
        isOverLimit: currentCount >= limit && limit !== -1 && limit < 999999,
      });
    } catch (error) {
      console.error("Failed to load usage stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return null;
  }

  const isUnlimited = stats.limit === -1 || stats.limit >= 999999;

  return (
    <div className={`rounded-2xl border p-6 ${stats.isOverLimit ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20" : stats.isNearLimit ? "border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20" : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Usage</h3>
        <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline">
          View Plans
        </a>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.currentCount}</span>
          <span className="text-gray-500 dark:text-gray-400">/ {isUnlimited ? "∞" : stats.limit} receipts</span>
        </div>

        {!isUnlimited && (
          <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${stats.isOverLimit ? "bg-red-600 dark:bg-red-500" : stats.isNearLimit ? "bg-yellow-500 dark:bg-yellow-400" : "bg-green-600 dark:bg-green-500"}`} style={{ width: `${Math.min(stats.percentage, 100)}%` }} />
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="capitalize">{stats.plan === 'free' ? 'Free' : stats.plan}</span> plan • {isUnlimited ? "Unlimited receipts" : `${Math.max(0, stats.limit - stats.currentCount)} remaining this month`}
        </p>

        {stats.isOverLimit && stats.plan === 'free' && (
          <div className="pt-3 border-t border-red-200 dark:border-red-900">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">⚠️ You've used all your free receipts this month</p>
            <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors">
              Upgrade to Continue
            </a>
          </div>
        )}

        {stats.isOverLimit && stats.plan !== 'free' && (
          <div className="pt-3 border-t border-red-200 dark:border-red-900">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">⚠️ You've reached your monthly limit</p>
            <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors">
              Upgrade Plan
            </a>
          </div>
        )}

        {stats.isNearLimit && !stats.isOverLimit && (
          <div className="pt-3 border-t border-yellow-200 dark:border-yellow-900">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">You're at {stats.percentage}% of your monthly limit</p>
          </div>
        )}
      </div>
    </div>
  );
}