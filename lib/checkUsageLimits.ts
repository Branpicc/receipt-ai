// lib/checkUsageLimits.ts
import { supabase } from "./supabaseClient";

// Define plan limits here (don't import from stripe.ts which is server-only)
const PLAN_LIMITS = {
  free: {
    receipts: 10,
    users: 1,
    features: ['manual_categorization', 'csv_export'],
  },
  starter: {
    receipts: 100,
    users: 1,
    features: ['manual_categorization', 'csv_export', 'ocr'],
  },
  professional: {
    receipts: 999999, // Unlimited
    users: 3,
    features: ['manual_categorization', 'csv_export', 'ocr', 'quickbooks_export', 'api_access'],
  },
  enterprise: {
    receipts: -1, // unlimited
    users: -1,
    features: ['all'],
  },
};

type UsageCheckResult = {
  canUpload: boolean;
  currentCount: number;
  limit: number;
  plan: string;
  message?: string;
};

export async function checkReceiptUploadLimit(firmId: string): Promise<UsageCheckResult> {
  try {
    // Get firm's subscription plan
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("subscription_plan, subscription_status, subscription_tier")
      .eq("id", firmId)
      .single();

    if (firmError || !firm) {
      return {
        canUpload: false,
        currentCount: 0,
        limit: 0,
        plan: "none",
        message: "Firm not found.",
      };
    }

    // Use subscription_tier if available, fallback to subscription_plan
    const plan = firm.subscription_tier || firm.subscription_plan || "free";
    
    // Free plan works without active subscription status
    // Paid plans require active subscription
    if (plan !== 'free' && firm.subscription_status !== "active") {
      return {
        canUpload: false,
        currentCount: 0,
        limit: 0,
        plan,
        message: "Your subscription is not active. Please update your payment method or use the free plan.",
      };
    }

    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

    // If unlimited receipts (enterprise or professional), always allow
    if (planLimits.receipts === -1 || planLimits.receipts >= 999999) {
      return {
        canUpload: true,
        currentCount: 0,
        limit: -1,
        plan,
      };
    }

    // Get current month's receipt count (BOTH regular AND email receipts)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Count regular receipts
    const { count: regularCount, error: regularError } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .gte("created_at", startOfMonth.toISOString());

    // Count approved email receipts
    const { count: emailCount, error: emailError } = await supabase
      .from("email_receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("status", "approved")
      .gte("created_at", startOfMonth.toISOString());

    if (regularError || emailError) {
      console.error("Error counting receipts:", regularError || emailError);
      return {
        canUpload: false,
        currentCount: 0,
        limit: planLimits.receipts,
        plan,
        message: "Error checking usage. Please try again.",
      };
    }

    const currentCount = (regularCount || 0) + (emailCount || 0);
    const canUpload = currentCount < planLimits.receipts;

    return {
      canUpload,
      currentCount,
      limit: planLimits.receipts,
      plan,
      message: canUpload
        ? undefined
        : `You've reached your monthly limit of ${planLimits.receipts} receipts. ${plan === 'free' ? 'Upgrade to continue uploading!' : 'Please upgrade your plan.'}`,
    };
  } catch (error) {
    console.error("Usage check error:", error);
    return {
      canUpload: false,
      currentCount: 0,
      limit: 0,
      plan: "unknown",
      message: "Error checking usage limits.",
    };
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
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

    // Get current month's receipt count (BOTH regular AND email receipts)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Count regular receipts
    const { count: regularCount } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .gte("created_at", startOfMonth.toISOString());

    // Count approved email receipts
    const { count: emailCount } = await supabase
      .from("email_receipts")
      .select("*", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("status", "approved")
      .gte("created_at", startOfMonth.toISOString());

    const currentCount = (regularCount || 0) + (emailCount || 0);
    const limit = planLimits.receipts;
    const percentage = limit === -1 || limit >= 999999 ? 0 : Math.round((currentCount / limit) * 100);

    return {
      currentCount,
      limit,
      percentage,
      plan,
      isNearLimit: percentage >= 80 && limit !== -1 && limit < 999999,
      isOverLimit: currentCount >= limit && limit !== -1 && limit < 999999,
    };
  } catch (error) {
    console.error("Error getting usage stats:", error);
    return null;
  }
}

export function hasFeature(plan: string, feature: string): boolean {
  const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  if (!planLimits) return false;
  
  if (planLimits.features.includes('all')) return true;
  return planLimits.features.includes(feature);
}