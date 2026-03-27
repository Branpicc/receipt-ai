"use client";

import { useState, useEffect } from "react";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";

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

const plans: Plan[] = [
  {
    name: "Starter",
    tier: "starter",
    price: "$49",
    priceMonthly: 49,
    description: "Perfect for small firms getting started",
    clients: "Up to 5 clients",
    users: "1 accountant seat",
    features: [
      "Unlimited receipts",
      "AI categorization & OCR",
      "Tax code mapping (GST/HST/PST)",
      "Project folders",
      "Email receipt forwarding",
      "CSV export",
      "Email support",
    ],
  },
  {
    name: "Professional",
    tier: "professional",
    price: "$199",
    priceMonthly: 199,
    description: "For growing firms with more clients",
    clients: "Up to 20 clients",
    users: "3 accountant seats",
    recommended: true,
    features: [
      "Everything in Starter",
      "Priority support",
      "Advanced reports",
      "API access",
      "Budget tracking & alerts",
      "Monthly client reports",
      "Multi-user collaboration",
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
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "Onboarding & training",
    ],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<{ clients: number; clientLimit: number; accountants: number; userLimit: number } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    loadCurrentPlan();
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

      const plan = firm?.subscription_tier || firm?.subscription_plan || null;
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
    if (tier === "enterprise") {
      window.location.href = "mailto:sales@receiptai.com?subject=Enterprise Plan Inquiry";
      return;
    }

    if (currentPlan?.toLowerCase() === tier.toLowerCase()) {
      alert("You already have this plan.");
      return;
    }

    try {
      setLoading(tier);
      const firmId = await getMyFirmId();

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const isTrialing = currentPlan === "trial";
  const isActive = subscriptionStatus === "active" || isTrialing;
  const annualDiscount = 0.833; // 2 months free = ~16.7% off

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
                  {isTrialing && <span className="ml-2 text-sm font-normal text-green-700 dark:text-green-300">— 14-day trial</span>}
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
              {currentPlan !== "trial" && isActive && (
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
                  Start your 14-day free trial
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

        {/* Billing interval toggle */}
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

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.toLowerCase() === plan.tier.toLowerCase();
            const displayPrice = billingInterval === "annual" && plan.priceMonthly
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
                      Billed ${Math.round(plan.priceMonthly * annualDiscount * 12)}/year
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
                    : plan.isEnterprise
                    ? "Contact Sales"
                    : `Get ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-12 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Common Questions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
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
              <p className="text-gray-600 dark:text-gray-400">You'll need to choose a paid plan to continue. Your data is always kept safe.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Can I switch plans anytime?</p>
              <p className="text-gray-600 dark:text-gray-400">Yes — upgrade or downgrade at any time. Changes take effect immediately.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}