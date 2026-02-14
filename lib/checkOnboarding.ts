import { supabase } from "@/lib/supabaseClient";

export type OnboardingStatus = {
  isComplete: boolean;
  hasFirm: boolean;
  hasClient: boolean;
  hasReceipt: boolean;
  currentStep: number;
};

export async function checkOnboardingStatus(
  userId: string
): Promise<OnboardingStatus> {
  // Check if user has a firm
  const { data: firmUser } = await supabase
    .from("firm_users")
    .select("firm_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!firmUser?.firm_id) {
    return {
      isComplete: false,
      hasFirm: false,
      hasClient: false,
      hasReceipt: false,
      currentStep: 1,
    };
  }

  // Check if firm has clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("firm_id", firmUser.firm_id)
    .limit(1);

  const hasClient = (clients?.length || 0) > 0;

  if (!hasClient) {
    return {
      isComplete: false,
      hasFirm: true,
      hasClient: false,
      hasReceipt: false,
      currentStep: 2,
    };
  }

  // Check if firm has receipts
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id")
    .eq("firm_id", firmUser.firm_id)
    .limit(1);

  const hasReceipt = (receipts?.length || 0) > 0;

  return {
    isComplete: hasReceipt,
    hasFirm: true,
    hasClient: true,
    hasReceipt,
    currentStep: hasReceipt ? 4 : 3,
  };
}