// components/UsageStats.tsx
"use client";

import { useEffect, useState } from "react";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const PLAN_LIMITS = {
  free: {
    receipts: 5,
    users: 1,
  },
  starter: {
    receipts: 100,
    users: 1,
  },
  professional: {
    receipts: 500,
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
      
      // Get firm subscription info
      const { data: firm, error } = await supabase
        .from('firms')
        .select('subscription_plan, subscription_status')
        .eq('id', firmId)
        .single();

      if (error) {
        console.error('Error loading firm:', error);
        setLoading(false);
        return;
      }

      // If no active PAID subscription, use free plan
      if (!firm?.subscription_plan || (firm.subscription_plan !== 'free' && firm?.subscription_status !== 'active')) {
        // Check current usage for free plan
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from("receipts")
          .select("*", { count: "exact", head: true })
          .eq("firm_id", firmId)
          .gte("created_at", startOfMonth.toISOString());

        const currentCount = count || 0;
        const freeLimit = 5;
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

      const plan = firm.subscription_plan;
      const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

      // Get current month's receipt count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .gte("created_at", startOfMonth.toISOString());

      const currentCount = count || 0;
      const limit = planLimits?.receipts || 100;
      const percentage = limit === -1 ? 0 : Math.round((currentCount / limit) * 100);

      setStats({
        currentCount,
        limit,
        percentage,
        plan,
        isNearLimit: percentage >= 80 && limit !== -1,
        isOverLimit: currentCount >= limit && limit !== -1,
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

  return (
    <div
      className={`rounded-2xl border p-6 ${
        stats.isOverLimit
          ? "border-red-200 bg-red-50"
          : stats.isNearLimit
          ? "border-yellow-200 bg-yellow-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Usage</h3>
        <Link
          href="/dashboard/billing"
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          View Plans
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {stats.currentCount}
          </span>
          <span className="text-gray-500">
            / {stats.limit === -1 ? "∞" : stats.limit} receipts
          </span>
        </div>

        {stats.limit !== -1 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.isOverLimit
                  ? "bg-red-600"
                  : stats.isNearLimit
                  ? "bg-yellow-500"
                  : "bg-green-600"
              }`}
              style={{ width: `${Math.min(stats.percentage, 100)}%` }}
            />
          </div>
        )}

        <p className="text-sm text-gray-600">
          <span className="capitalize">{stats.plan === 'free' ? 'Free' : stats.plan}</span> plan •{" "}
          {stats.limit === -1
            ? "Unlimited receipts"
            : `${Math.max(0, stats.limit - stats.currentCount)} remaining this month`}
        </p>

        {stats.isOverLimit && stats.plan === 'free' && (
          <div className="pt-3 border-t border-red-200">
            <p className="text-sm text-red-800 font-medium mb-2">
              ⚠️ You've used all your free receipts this month
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Upgrade to Continue
            </Link>
          </div>
        )}

        {stats.isOverLimit && (
          <div className="pt-3 border-t border-red-200">
            <p className="text-sm text-red-800 font-medium mb-2">
              ⚠️ You've reached your monthly limit
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Upgrade Plan
            </Link>
          </div>
        )}

        {stats.isNearLimit && !stats.isOverLimit && (
          <div className="pt-3 border-t border-yellow-200">
            <p className="text-sm text-yellow-800">
              You're at {stats.percentage}% of your monthly limit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}