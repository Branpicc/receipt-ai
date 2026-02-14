"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/checkOnboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const onboardingStatus = await checkOnboardingStatus(user.id);
      setStatus(onboardingStatus);

      // Redirect if already complete
      if (onboardingStatus.isComplete) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to check onboarding:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Redirect to appropriate step
  if (!status.hasFirm) {
    router.push("/onboarding/firm");
  } else if (!status.hasClient) {
    router.push("/onboarding/client");
  } else if (!status.hasReceipt) {
    router.push("/onboarding/first-receipt");
  }

  return null;
}