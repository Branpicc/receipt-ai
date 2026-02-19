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
      "5 receipts per month",
      "1 user",
      "Manual categorization",
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
      "500 receipts per month",
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
        .select("subscription_plan, subscription_status")
        .eq("id", firmId)
        .single();

      // Set current plan (including 'free')
      if (firm?.subscription_plan) {
        setCurrentPlan(firm.subscription_plan);
      } else {
        setCurrentPlan('free'); // Default to free if no plan set
      }
    } catch (error) {
      console.error("Failed to load current plan:", error);
      setCurrentPlan('free'); // Default to free on error
    }
  };

  const handleSubscribe = async (planIdentifier: string, planName: string) => {
    if (planName === "Enterprise") {
      window.location.href = "mailto:sales@receiptai.com";
      return;
    }

    // Handle free plan (no Stripe needed)
    if (planName === "Free") {
      // Show confirmation dialog
      const confirmed = confirm(
        "Switch to Free plan?\n\n" +
        "• 5 receipts per month\n" +
        "• Manual entry only (no OCR)\n" +
        "• CSV export\n\n" +
        "Your current paid subscription will be canceled."
      );
      
      if (!confirmed) return;

      try {
        setLoading(planIdentifier);
        const firmId = await getMyFirmId();

        // Get current subscription to cancel it
        const { data: firm } = await supabase
          .from('firms')
          .select('stripe_subscription_id, stripe_customer_id')
          .eq('id', firmId)
          .single();

        // Cancel Stripe subscription if exists
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

        // Update firm to free plan
        const { error } = await supabase
          .from('firms')
          .update({ 
            subscription_plan: 'free',
            subscription_status: null,
            stripe_subscription_id: null,
            stripe_customer_id: firm?.stripe_customer_id || null, // Keep customer ID
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

      // Create checkout session (API will map plan name to price ID)
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: planName.toLowerCase(), firmId }),
      });

      const { sessionId, url, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      // Redirect to Stripe Checkout
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
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Plans</h1>
        <p className="text-gray-600 mb-8">
          Choose the plan that's right for your business
        </p>

        {currentPlan && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-900">
                  Current Plan: <span className="capitalize">{currentPlan}</span>
                </p>
                <p className="text-sm text-green-700">Your subscription is active</p>
              </div>
              <button
                onClick={handleManageSubscription}
                disabled={loading === "portal"}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {loading === "portal" ? "Loading..." : "Manage Subscription"}
              </button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.toLowerCase() === plan.name.toLowerCase();

            return (
              <div
                key={plan.name}
                className={`rounded-2xl border-2 p-6 ${
                  plan.recommended
                    ? "border-black bg-gray-50"
                    : isCurrentPlan
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.recommended && (
                  <div className="text-xs font-semibold text-black mb-2">
                    RECOMMENDED
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="text-xs font-semibold text-green-600 mb-2">
                    CURRENT PLAN
                  </div>
                )}

                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className="text-gray-500">/month</span>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={loading === plan.priceId || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : plan.recommended
                      ? "bg-black text-white hover:bg-gray-800"
                      : "bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-50"
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