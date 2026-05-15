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

const CACHE_KEY = "receipture-cache:v1:accountType";

function readCache(): AccountType | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(CACHE_KEY);
    if (v === "firm" || v === "personal") return v;
    return null;
  } catch { return null; }
}

function writeCache(v: AccountType) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(CACHE_KEY, v); } catch { /* ignore */ }
}

// Cached per-tab session. Repeat calls (which happen on every page
// navigation because layout + several pages each ask for accountType)
// return instantly from sessionStorage. Cleared via clearWhoAmICache
// from getFirmId.ts on sign-out.
export async function getMyAccountType(): Promise<AccountType> {
  const cached = readCache();
  if (cached) return cached;

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

    const t: AccountType = firm?.account_type === "personal" ? "personal" : "firm";
    writeCache(t);
    return t;
  } catch (err) {
    console.error("[getMyAccountType] failed:", err);
    return "firm";
  }
}
