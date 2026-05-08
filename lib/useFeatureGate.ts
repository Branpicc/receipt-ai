"use client";

// lib/useFeatureGate.ts
//
// Convenience hook for page-level feature gating. Wrap a page's main
// component in a small parent component that calls this hook so the
// gated content's own hooks/effects don't fire when the user can't
// access the page.
//
// Usage:
//   function BudgetPageContent() { ...existing code... }
//   export default function BudgetPage() {
//     const gate = useFeatureGate("budget_tracking");
//     if (gate.loading) return null;
//     if (!gate.allowed) return <UpgradeRequired feature="budget_tracking" />;
//     return <BudgetPageContent />;
//   }

import { useEffect, useState } from "react";
import { getMyFirmPlan } from "./getMyFirmPlan";
import { hasFeature, type Feature, type Plan } from "./featureGates";

export function useFeatureGate(feature: Feature): {
  loading: boolean;
  allowed: boolean;
  plan: Plan;
} {
  const [plan, setPlan] = useState<Plan>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyFirmPlan().then((p) => {
      if (!cancelled) {
        setPlan(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    allowed: hasFeature(plan, feature),
    plan,
  };
}
