"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import OnboardingModal from "./OnboardingModal";
import { firmAdminSteps, accountantSteps, getClientSteps } from "./onboardingSteps";
import { useOnboarding } from "@/lib/useOnboarding";

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { showOnboarding, userRole, loading, completeOnboarding, skipOnboarding } = useOnboarding();
  const [clientName, setClientName] = useState("");
  const [clientAlias, setClientAlias] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (userRole === "client") {
      loadClientInfo();
    }
  }, [userRole]);

  async function loadClientInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      // Get client info
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (firmUser?.client_id) {
        setClientId(firmUser.client_id);

        const { data: client } = await supabase
          .from("clients")
          .select("name, email_alias")
          .eq("id", firmUser.client_id)
          .single();

        if (client) {
          setClientName(client.name);
          setClientAlias(client.email_alias);
        }
      }
    } catch (error) {
      console.error("Failed to load client info:", error);
    }
  }

  async function handleClientEmailSave(alias: string) {
    if (!clientId) return;

    const { error } = await supabase
      .from("clients")
      .update({
        email_alias: alias || null,
        onboarding_completed: true,
      })
      .eq("id", clientId);

    if (error) {
      if (error.code === "23505") {
        throw new Error("This email alias is already taken. Please choose another.");
      }
      throw error;
    }

    // Update the local state so step 3 shows the new alias
    setClientAlias(alias);
  }

  if (loading) {
    return <>{children}</>;
  }

  if (!showOnboarding) {
    return <>{children}</>;
  }

  // Determine which steps to show based on role
  let steps: any[] = [];
  if (userRole === "firm_admin" || userRole === "owner") {
    steps = firmAdminSteps;
  } else if (userRole === "accountant") {
    steps = accountantSteps;
  } else if (userRole === "client") {
    // Regenerate steps with current alias (reactive)
    steps = getClientSteps(clientName, clientAlias, handleClientEmailSave);
  }

  return (
    <>
      {children}
      <OnboardingModal
        steps={steps}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
        role={userRole || ""}
      />
    </>
  );
}