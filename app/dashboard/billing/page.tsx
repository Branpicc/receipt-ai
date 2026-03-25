"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { getMyFirmId } from "@/lib/getFirmId";
import { supabase } from "@/lib/supabaseClient";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Plan = {
  name: string;
  price: string;
  priceId: string;
  features: string[];
  recommended?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    priceId: "free",
    features: [
      "10 receipts per month",
      "1 user",
      "AI-powered OCR",
      "Auto-categorization",
      "CSV export",
      "Basic receipt storage",
    ],
  },
  {
    name: "Starter",
    price: "$29",
    priceId: "starter",
    features: [
      "100 receipts per month",
      "1 user",
      "AI-powered OCR",
      "Auto-categorization",
      "CSV export",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: "$79",
    priceId: "professional",
    recommended: true,
    features: [
      "Unlimited receipts",
      "3 users",
      "AI categorization",
      "QuickBooks export",
      "API access",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    priceId: "enterprise",
    features: [
      "Unlimited receipts",
      "Unlimited users",
      "White-label option",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentPlan();
    
    // Check if returning from successful checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Wait a moment for webhook to process, then reload
      setTimeout(() => {
        loadCurrentPlan();
      }, 2000);
    }
  }, []);

  const loadCurrentPlan = async () => {
    try {
      const firmId = await getMyFirmId();
      const { data: firm } = await supabase
        .from("firms")
        .select("subscription_tier, subscription_plan, subscription_status")
        .eq("id", firmId)
        .single();

      // Priority: subscription_tier over subscription_plan
      const plan = firm?.subscription_tier || firm?.subscription_plan || 'free';
      setCurrentPlan(plan);
    } catch (error) {
      console.error("Failed to load current plan:", error);
      setCurrentPlan('free');
    }
  };

  const handleSubscribe = async (planIdentifier: string, planName: string) => {
    if (planName === "Enterprise") {
      window.location.href = "mailto:sales@receiptai.com";
      return;
    }

    // Handle free plan (no Stripe needed)
    if (planName === "Free") {
      const confirmed = confirm(
        "Switch to Free plan?\n\n" +
        "• 10 receipts per month\n" +
        "• AI-powered OCR\n" +
        "• CSV export\n\n" +
        "Your current paid subscription will be canceled."
      );
      
      if (!confirmed) return;

      try {
        setLoading(planIdentifier);
        const firmId = await getMyFirmId();

        const { data: firm } = await supabase
          .from('firms')
          .select('stripe_subscription_id, stripe_customer_id')
          .eq('id', firmId)
          .single();

        if (firm?.stripe_subscription_id) {
          const response = await fetch("/api/stripe/cancel-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: firm.stripe_subscription_id }),
          });

          if (!response.ok) {
            throw new Error("Failed to cancel subscription");
          }
        }

        const { error } = await supabase
          .from('firms')
          .update({ 
            subscription_tier: 'free',
            subscription_plan: 'free',
            subscription_status: null,
            stripe_subscription_id: null,
            stripe_customer_id: firm?.stripe_customer_id || null,
          })
          .eq('id', firmId);

        if (error) throw error;

        alert("✅ Switched to Free plan! Your paid subscription has been canceled.");
        loadCurrentPlan();
      } catch (error: any) {
        console.error("Free plan switch error:", error);
        alert("Failed to switch to Free plan: " + error.message);
      } finally {
        setLoading(null);
      }
      return;
    }

    // Prevent subscribing to the same plan
    if (currentPlan?.toLowerCase() === planName.toLowerCase()) {
      alert("You already have this plan! To change plans, please select a different tier.");
      return;
    }

    try {
      setLoading(planIdentifier);
      const firmId = await getMyFirmId();

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: planName.toLowerCase(), firmId }),
      });

      const { sessionId, url, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout: " + error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading("portal");
      const firmId = await getMyFirmId();

      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId }),
      });

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("Failed to open customer portal");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Billing & Plans</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Choose the plan that's right for your business
        </p>

        {currentPlan && (
          <div className="mb-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Current Plan: <span className="capitalize">{currentPlan}</span>
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">Your subscription is active</p>
              </div>
              {currentPlan !== 'free' && (
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.toLowerCase() === plan.name.toLowerCase();

            return (
              <div
                key={plan.name}
                className={`rounded-2xl border-2 p-6 ${
                  plan.recommended
                    ? "border-accent-500 dark:border-accent-400 bg-accent-50 dark:bg-accent-900/20"
                    : isCurrentPlan
                    ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
                }`}
              >
                {plan.recommended && (
                  <div className="text-xs font-semibold text-accent-600 dark:text-accent-400 mb-2">
                    RECOMMENDED
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                    CURRENT PLAN
                  </div>
                )}

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className="text-gray-500 dark:text-gray-400">/month</span>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={loading === plan.priceId || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : plan.recommended
                      ? "bg-accent-600 text-white hover:bg-accent-700"
                      : "bg-white dark:bg-dark-surface border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-dark-hover"
                  } disabled:opacity-50`}
                >
                  {loading === plan.priceId
                    ? "Loading..."
                    : isCurrentPlan
                    ? "Current Plan"
                    : plan.price === "Custom"
                    ? "Contact Sales"
                    : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}