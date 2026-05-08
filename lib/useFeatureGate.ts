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
import { getUserRole, type UserRole } from "./getUserRole";
import { hasFeature, type Feature, type Plan } from "./featureGates";

export function useFeatureGate(feature: Feature): {
  loading: boolean;
  allowed: boolean;
  plan: Plan;
  role: UserRole | null;
} {
  const [plan, setPlan] = useState<Plan>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyFirmPlan(), getUserRole()]).then(([p, r]) => {
      if (!cancelled) {
        setPlan(p);
        setRole(r);
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
    role,
  };
}
