"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserRole } from "@/lib/getUserRole";
import { getMyFirmId } from "@/lib/getFirmId";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  async function checkOnboardingStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const role = await getUserRole();
      setUserRole(role);

      const firmId = await getMyFirmId();

      // Check if user has completed onboarding
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("onboarding_completed, onboarding_skipped")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      // Show onboarding if not completed and not skipped
      if (firmUser && !firmUser.onboarding_completed && !firmUser.onboarding_skipped) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      await supabase
        .from("firm_users")
        .update({
          onboarding_completed: true,
          onboarding_step: 0,
        })
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId);

      setShowOnboarding(false);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    }
  }

  async function skipOnboarding() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      await supabase
        .from("firm_users")
        .update({
          onboarding_skipped: true,
          onboarding_step: 0,
        })
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId);

      setShowOnboarding(false);
    } catch (error) {
      console.error("Failed to skip onboarding:", error);
    }
  }

  async function restartOnboarding() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      await supabase
        .from("firm_users")
        .update({
          onboarding_completed: false,
          onboarding_skipped: false,
          onboarding_step: 0,
        })
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId);

      setShowOnboarding(true);
    } catch (error) {
      console.error("Failed to restart onboarding:", error);
    }
  }

  return {
    showOnboarding,
    userRole,
    loading,
    completeOnboarding,
    skipOnboarding,
    restartOnboarding,
  };
}