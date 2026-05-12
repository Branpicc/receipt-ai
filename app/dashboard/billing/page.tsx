"use client";

import { useState, useEffect } from "react";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";
import { getMyAccountType, type AccountType } from "@/lib/getMyAccountType";

type Plan = {
  name: string;
  tier: string;
  price: string;
  priceMonthly?: number;
  description: string;
  clients: string;
  users: string;
  features: string[];
  recommended?: boolean;
  isTrial?: boolean;
  isEnterprise?: boolean;
};

// Personal-account plan. Two billing intervals: $6.99/mo or $54.99/yr.
// Annual saves ~34% vs. paying monthly ($83.88/yr). We render this on
// its own when account_type is 'personal' — the firm tiers are
// completely hidden in that view.
const PERSONAL_MONTHLY_PRICE = 6.99;
const PERSONAL_ANNUAL_PRICE = 54.99;
const personalPlan: Plan = {
  name: "Personal",
  tier: "personal",
  price: `$${PERSONAL_MONTHLY_PRICE}`,
  priceMonthly: PERSONAL_MONTHLY_PRICE,
  description: "For individuals and self-employed Canadians",
  clients: "Just you — one profile",
  users: "Single user",
  features: [
    "Unlimited receipts (photo, email, SMS)",
    "AI categorization & OCR",
    "Self-employed CRA tax-prep forms",
    "Capital Cost Allowance & home office tracking",
    "Monthly net income summary",
    "Real .xlsx + CSV exports",
    "Email support",
  ],
};

const plans: Plan[] = [
  {
    name: "Starter",
    tier: "starter",
    price: "$199",
    priceMonthly: 199,
    description: "Perfect for small firms getting started",
    clients: "Up to 5 clients",
    users: "1 accountant seat",
    features: [
      "Unlimited receipts",
      "AI categorization & OCR",
      "Tax code mapping (GST/HST/PST)",
      "Project folders",
      "Email receipt forwarding",
      "SMS purpose collection",
      "CSV export",
      "In-app AI support chat",
    ],
  },
  {
    name: "Professional",
    tier: "professional",
    price: "$249",
    priceMonthly: 249,
    description: "For growing firms with more clients",
    clients: "Up to 20 clients",
    users: "3 accountant seats",
    recommended: true,
    features: [
      "Everything in Starter",
      "Advanced reports & edit history",
      "Budget tracking & alerts",
      "Monthly client reports",
      "Business card fraud detection",
      "Client detail profiles",
      "Multi-user collaboration",
      "Receipt edit tracking",
    ],
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    price: "$349",
    priceMonthly: 349,
    description: "For large firms with complex needs",
    clients: "Unlimited clients",
    users: "Unlimited accountant seats",
    isEnterprise: true,
    features: [
      "Everything in Professional",
      "Unlimited clients & users",
      "Training & onboarding modules",
      "Priority onboarding call with founder",
      "Custom feature requests",
      "SLA guarantee",
      "Dedicated support channel",
    ],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<{ clients: number; clientLimit: number; accountants: number; userLimit: number } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  // Personal accounts see a one-card layout for the $6.99 plan; firm
  // accounts see the existing three-tier grid. We hold the page back
  // with `accountTypeReady=false` until the lookup resolves — without
  // this gate, the firm pricing flashes for personal users on first
  // paint while the async getMyAccountType call is in flight.
  const [accountType, setAccountType] = useState<AccountType>("firm");
  const [accountTypeReady, setAccountTypeReady] = useState(false);

  useEffect(() => {
    loadCurrentPlan();
    getMyAccountType()
      .then((t) => { setAccountType(t); setAccountTypeReady(true); })
      .catch(() => { setAccountType("firm"); setAccountTypeReady(true); });
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("success") === "true") {
      setTimeout(() => loadCurrentPlan(), 2000);
    }
  }, []);

  async function loadCurrentPlan() {
    try {
      const firmId = await getMyFirmId();
      const { data: firm } = await supabase
        .from("firms")
        .select("subscription_tier, subscription_plan, subscription_status")
        .eq("id", firmId)
        .single();

      const plan = firm?.subscription_plan || firm?.subscription_tier || null;
      setCurrentPlan(plan);
      setSubscriptionStatus(firm?.subscription_status || null);

      // Load usage stats
      const { count: clients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("is_active", true);

      const { count: accountants } = await supabase
        .from("firm_users")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", firmId)
        .eq("role", "accountant");

      const limits: Record<string, { clients: number; users: number }> = {
        starter: { clients: 5, users: 1 },
        professional: { clients: 20, users: 3 },
        enterprise: { clients: -1, users: -1 },
        trial: { clients: 20, users: 3 },
      };

      const planLimits = limits[plan || ""] || { clients: 0, users: 0 };

      setUsageStats({
        clients: clients || 0,
        clientLimit: planLimits.clients,
        accountants: accountants || 0,
        userLimit: planLimits.users,
      });
    } catch (error) {
      console.error("Failed to load current plan:", error);
    }
  }

  async function handleSubscribe(tier: string) {
    if (currentPlan?.toLowerCase() === tier.toLowerCase()) {
      alert("You already have this plan.");
      return;
    }

    if (currentPlan && currentPlan.toLowerCase() !== "trial") {
      const targetName = plans.find(p => p.tier === tier)?.name || tier;
      const ok = window.confirm(
        `You're currently on the ${currentPlan} plan. Switching to ${targetName} will cancel your existing subscription and start a new one. Continue?`
      );
      if (!ok) return;
    }

    try {
      setLoading(tier);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Your session expired. Please log in again.");
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planName: tier,
          firmId,
          interval: billingInterval,
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout: " + error.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      setLoading("portal");
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Your session expired. Please log in again.");
        return;
      }
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ firmId }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      alert("Failed to open customer portal");
    } finally {
      setLoading(null);
    }
  }

  const isTrialing = subscriptionStatus === "trialing";
  const isActive = subscriptionStatus === "active" || isTrialing;
  const annualDiscount = 0.833; // 2 months free = ~16.7% off

  // Hold the page until we know firm vs. personal so we don't flash
  // the wrong pricing grid on first paint.
  if (!accountTypeReady) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Billing & Plans</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Simple, transparent pricing that scales with your firm
        </p>

        {/* Current plan banner */}
        {currentPlan && (
          <div className="mb-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100 text-lg">
                  Current Plan: <span className="capitalize">{currentPlan}</span>
                  {isTrialing && <span className="ml-2 text-sm font-normal text-green-700 dark:text-green-300">— 7-day trial</span>}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {isActive ? "Your subscription is active" : "Subscription inactive — please update payment method"}
                </p>
                {/* Usage stats */}
                {usageStats && (
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-green-700 dark:text-green-400">
                      Clients: {usageStats.clients}{usageStats.clientLimit !== -1 ? `/${usageStats.clientLimit}` : " (unlimited)"}
                    </span>
                    <span className="text-xs text-green-700 dark:text-green-400">
                      Accountants: {usageStats.accountants}{usageStats.userLimit !== -1 ? `/${usageStats.userLimit}` : " (unlimited)"}
                    </span>
                    <span className="text-xs text-green-700 dark:text-green-400">
                      Receipts: Unlimited
                    </span>
                  </div>
                )}
              </div>
              {!isTrialing && isActive && (
                <button
                  onClick={handleManageSubscription}
                  disabled={loading === "portal"}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading === "portal" ? "Loading..." : "Manage Subscription"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trial CTA — shown when no plan */}
        {!currentPlan && (
          <div className="mb-8 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-semibold text-accent-900 dark:text-accent-100 text-lg">
                  Start your 7-day free trial
                </p>
                <p className="text-sm text-accent-700 dark:text-accent-300 mt-1">
                  Full Professional access — no credit card required
                </p>
              </div>
              <button
                onClick={() => handleSubscribe("trial")}
                className="px-5 py-2.5 bg-accent-600 text-white rounded-lg text-sm font-semibold hover:bg-accent-700"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        )}

        {/* Billing interval toggle — applies to firm tiers and to the
            Personal plan (which also has monthly $6.99 + annual $54.99
            options). */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingInterval === "monthly"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-dark-surface text-gray-600 dark:text-gray-400"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval("annual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingInterval === "annual"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-dark-surface text-gray-600 dark:text-gray-400"
            }`}
          >
            Annual
            <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded font-semibold">
              2 months free
            </span>
          </button>
        </div>

        {/* Pricing cards — personal accounts get a single $6.99 card,
            firm accounts get the three-tier grid. */}
        <div className={accountType === "personal" ? "max-w-md mx-auto" : "grid md:grid-cols-3 gap-6"}>
          {(accountType === "personal" ? [personalPlan] : plans).map((plan) => {
            const isCurrentPlan = currentPlan?.toLowerCase() === plan.tier.toLowerCase();
            // Personal annual is a flat $54.99/year, displayed as the
            // equivalent monthly rate so the comparison is apples-to-apples
            // against the $6.99 monthly card. Firm tiers keep the
            // 2-months-free formula based on their priceMonthly.
            const personalAnnualMonthly = PERSONAL_ANNUAL_PRICE / 12;
            const displayPrice =
              plan.tier === "personal" && billingInterval === "annual"
                ? `$${personalAnnualMonthly.toFixed(2)}`
                : billingInterval === "annual" && plan.priceMonthly
                ? `$${Math.round(plan.priceMonthly * annualDiscount)}`
                : plan.price;

            return (
              <div
                key={plan.tier}
                className={`rounded-2xl border-2 p-6 flex flex-col ${
                  plan.recommended
                    ? "border-accent-500 dark:border-accent-400 bg-accent-50 dark:bg-accent-900/20"
                    : isCurrentPlan
                    ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/10"
                    : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
                }`}
              >
                {/* Badge */}
                {plan.recommended && !isCurrentPlan && (
                  <div className="text-xs font-bold text-accent-600 dark:text-accent-400 mb-2 uppercase tracking-wide">
                    ⭐ Most Popular
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-2 uppercase tracking-wide">
                    ✓ Current Plan
                  </div>
                )}

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{displayPrice}</span>
                  <span className="text-gray-500 dark:text-gray-400">/month</span>
                  {billingInterval === "annual" && plan.priceMonthly && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {plan.tier === "personal"
                        ? `Billed $${PERSONAL_ANNUAL_PRICE}/year — save ~34%`
                        : `Billed $${Math.round(plan.priceMonthly * annualDiscount * 12)}/year`}
                    </div>
                  )}
                </div>

                {/* Client & user limits */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-hover rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">👥</span>
                    <span className="font-medium text-gray-900 dark:text-white">{plan.clients}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">🧑‍💼</span>
                    <span className="font-medium text-gray-900 dark:text-white">{plan.users}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">📄</span>
                    <span className="font-medium text-gray-900 dark:text-white">Unlimited receipts</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={loading === plan.tier || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors ${
                    isCurrentPlan
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : plan.recommended
                      ? "bg-accent-600 text-white hover:bg-accent-700"
                      : plan.isEnterprise
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
                      : "border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-hover"
                  } disabled:opacity-50`}
                >
                  {loading === plan.tier
                    ? "Loading..."
                    : isCurrentPlan
                    ? "Current Plan"
                    : `Get ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ — copy switches based on account type so personal users
            don't see firm-only jargon (user seats, firm admin, etc.) */}
        <div className="mt-12 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Common Questions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            {accountType === "personal" ? (
              <>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">What does the Personal plan include?</p>
                  <p className="text-gray-600 dark:text-gray-400">Unlimited receipts, all extraction methods (photo, email, SMS), AI categorization, and tax-prep reports if you&apos;re self-employed.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">What happens when my 7-day trial ends?</p>
                  <p className="text-gray-600 dark:text-gray-400">You can subscribe for $6.99/month to keep using it. Your data is always kept safe and exportable.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Can I cancel anytime?</p>
                  <p className="text-gray-600 dark:text-gray-400">Yes — cancel from this page at any time. You&apos;ll keep access until the end of the billing period.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">I&apos;m not self-employed — is this still useful?</p>
                  <p className="text-gray-600 dark:text-gray-400">Yes! You&apos;ll still get receipt capture, spending summaries, and exports. The CRA tax-prep forms are simply hidden until you mark yourself as self-employed.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Does the firm admin count as a user seat?</p>
                  <p className="text-gray-600 dark:text-gray-400">No — the firm admin account is separate. User seats refer to accountant accounts only.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Are receipts really unlimited?</p>
                  <p className="text-gray-600 dark:text-gray-400">Yes — all paid plans include unlimited receipt uploads and processing with no monthly caps.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">What happens when my trial ends?</p>
                  <p className="text-gray-600 dark:text-gray-400">You&apos;ll need to choose a paid plan to continue. Your data is always kept safe.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Can I switch plans anytime?</p>
                  <p className="text-gray-600 dark:text-gray-400">Yes — upgrade or downgrade at any time. Changes take effect immediately.</p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}