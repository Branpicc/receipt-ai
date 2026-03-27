// lib/checkUsageLimits.ts
import { supabase } from "./supabaseClient";

// Firm version: receipts are unlimited for all paid plans
// Client limits are enforced instead
// Keep receipt limit infrastructure for personal version later
const PLAN_LIMITS = {
  trial: {
    receipts: -1, // unlimited
    clients: 20,
    users: 3,
  },
  starter: {
    receipts: -1, // unlimited
    clients: 5,
    users: 1,
  },
  professional: {
    receipts: -1, // unlimited
    clients: 20,
    users: 3,
  },
  enterprise: {
    receipts: -1, // unlimited
    clients: -1,  // unlimited
    users: -1,    // unlimited
  },
  // Legacy — kept for personal version
  free: {
    receipts: 10,
    clients: 1,
    users: 1,
  },
};

type UsageCheckResult = {
  canUpload: boolean;
  currentCount: number;
  limit: number;
  plan: string;
  message?: string;
};

type ClientLimitResult = {
  canAdd: boolean;
  currentCount: number;
  limit: number;
  plan: string;
  message?: string;
};

export async function checkReceiptUploadLimit(firmId: string): Promise<UsageCheckResult> {
  try {
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_status, subscription_tier")
      .eq("id", firmId)
      .single();

    if (firmError || !firm) {
      return { canUpload: false, currentCount: 0, limit: 0, plan: "none", message: "Firm not found." };
    }

    const plan = firm.subscription_tier || firm.subscription_plan || "free";

    // All paid firm plans have unlimited receipts
    if (plan !== "free") {
      return { canUpload: true, currentCount: 0, limit: -1, plan };
    }

    // Free plan (legacy / personal version support)
    const planLimits = PLAN_LIMITS["free"];
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
    const canUpload = currentCount < planLimits.receipts;

    return {
      canUpload,
      currentCount,
      limit: planLimits.receipts,
      plan,
      message: canUpload ? undefined : `You've reached your monthly limit of ${planLimits.receipts} receipts. Upgrade to continue uploading!`,
    };
  } catch (error) {
    console.error("Usage check error:", error);
    return { canUpload: false, currentCount: 0, limit: 0, plan: "unknown", message: "Error checking usage limits." };
  }
}

export async function checkClientLimit(firmId: string): Promise<ClientLimitResult> {
  try {
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_status, subscription_tier")
      .eq("id", firmId)
      .single();

    if (firmError || !firm) {
      return { canAdd: false, currentCount: 0, limit: 0, plan: "none", message: "Firm not found." };
    }

    const plan = firm.subscription_tier || firm.subscription_plan || "free";
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    // Unlimited clients
    if (planLimits.clients === -1) {
      return { canAdd: true, currentCount: 0, limit: -1, plan };
    }

    const { count: currentCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("is_active", true);

    const count = currentCount || 0;
    const canAdd = count < planLimits.clients;

    return {
      canAdd,
      currentCount: count,
      limit: planLimits.clients,
      plan,
      message: canAdd
        ? undefined
        : `You've reached your client limit of ${planLimits.clients} on the ${plan} plan. Upgrade to add more clients.`,
    };
  } catch (error) {
    console.error("Client limit check error:", error);
    return { canAdd: false, currentCount: 0, limit: 0, plan: "unknown", message: "Error checking client limit." };
  }
}

export async function checkUserLimit(firmId: string): Promise<ClientLimitResult> {
  try {
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_status, subscription_tier")
      .eq("id", firmId)
      .single();

    if (firmError || !firm) {
      return { canAdd: false, currentCount: 0, limit: 0, plan: "none", message: "Firm not found." };
    }

    const plan = firm.subscription_tier || firm.subscription_plan || "free";
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    // Unlimited users
    if (planLimits.users === -1) {
      return { canAdd: true, currentCount: 0, limit: -1, plan };
    }

    // Count accountants only — firm_admin does NOT count against the limit
    const { count: currentCount } = await supabase
      .from("firm_users")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("role", "accountant");

    const count = currentCount || 0;
    const canAdd = count < planLimits.users;

    return {
      canAdd,
      currentCount: count,
      limit: planLimits.users,
      plan,
      message: canAdd
        ? undefined
        : `You've reached your accountant seat limit of ${planLimits.users} on the ${plan} plan. Upgrade to add more accountants.`,
    };
  } catch (error) {
    console.error("User limit check error:", error);
    return { canAdd: false, currentCount: 0, limit: 0, plan: "unknown", message: "Error checking user limit." };
  }
}

export async function getUsageStats(firmId: string) {
  try {
    const { data: firm } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_status, subscription_tier")
      .eq("id", firmId)
      .single();

    const plan = firm?.subscription_tier || firm?.subscription_plan || "free";
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    // Client usage
    const { count: clientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("is_active", true);

    // Accountant usage (firm_admin excluded)
    const { count: accountantCount } = await supabase
      .from("firm_users")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("role", "accountant");

    const clients = clientCount || 0;
    const accountants = accountantCount || 0;
    const clientLimit = planLimits.clients;
    const userLimit = planLimits.users;

    return {
      clients,
      clientLimit,
      clientPercentage: clientLimit === -1 ? 0 : Math.round((clients / clientLimit) * 100),
      accountants,
      userLimit,
      userPercentage: userLimit === -1 ? 0 : Math.round((accountants / userLimit) * 100),
      plan,
      isNearClientLimit: clientLimit !== -1 && clients / clientLimit >= 0.8,
      isAtClientLimit: clientLimit !== -1 && clients >= clientLimit,
    };
  } catch (error) {
    console.error("Error getting usage stats:", error);
    return null;
  }
}

export function hasFeature(plan: string, feature: string): boolean {
  const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  if (!planLimits) return false;
  if ((planLimits as any).features?.includes("all")) return true;
  return (planLimits as any).features?.includes(feature) ?? false;
}