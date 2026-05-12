// lib/getMyAccountType.ts
//
// Resolves the current firm's account_type ('firm' | 'personal'). Used
// by the sidebar (to hide team/messaging items), the billing page (to
// surface the correct plan options), and copy gates throughout the app
// (to swap "your firm/accountant" phrasing for personal users).
//
// Returns "firm" by default if the column is missing or null so that
// existing firm accounts keep behaving as they did before account_type
// was introduced.

import { supabase } from "./supabaseClient";

export type AccountType = "firm" | "personal";

export async function getMyAccountType(): Promise<AccountType> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "firm";

    const { data: firmUser } = await supabase
      .from("firm_users")
      .select("firm_id")
      .eq("auth_user_id", user.id)
      .single();
    if (!firmUser?.firm_id) return "firm";

    const { data: firm } = await supabase
      .from("firms")
      .select("account_type")
      .eq("id", firmUser.firm_id)
      .single();

    return firm?.account_type === "personal" ? "personal" : "firm";
  } catch (err) {
    console.error("[getMyAccountType] failed:", err);
    return "firm";
  }
}
