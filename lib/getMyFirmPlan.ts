// lib/getMyFirmPlan.ts
//
// Lightweight client-side helper to fetch the current firm's paid plan.
// Used by the sidebar and route guards for tier-based feature gating.
// Mirrors the pattern in getMyFirmId/getUserRole.
//
// Returns "starter" / "professional" / "enterprise" / "free" / null. Note
// we read subscription_plan (the underlying paid tier), NOT
// subscription_tier — the latter can be "trial" while the user is inside
// their 7-day trial.

import { supabase } from "./supabaseClient";
import type { Plan } from "./featureGates";

export async function getMyFirmPlan(): Promise<Plan> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: firmUser } = await supabase
      .from("firm_users")
      .select("firm_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!firmUser?.firm_id) return null;

    const { data: firm } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_tier")
      .eq("id", firmUser.firm_id)
      .single();

    const plan = firm?.subscription_plan || firm?.subscription_tier || null;
    if (!plan) return null;

    if (
      plan === "starter" ||
      plan === "professional" ||
      plan === "enterprise" ||
      plan === "free" ||
      plan === "personal"
    ) {
      return plan;
    }
    // Anything else (e.g. legacy "trial" left in subscription_tier) → fall
    // back to "starter" as the most-restrictive interpretation.
    return "starter";
  } catch (error) {
    console.error("Error getting firm plan:", error);
    return null;
  }
}
