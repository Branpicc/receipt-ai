// lib/auth.ts — client-side auth helpers used by the login page and the
// global logout button. The signup / invite flow lives at
// app/accept-invite/[token]/page.tsx + /api/accept-invite, which talks to
// the actual `invitations` table directly. Earlier helpers in this file
// referenced a nonexistent `user_invitations` table and have been removed.
import { supabase } from "./supabaseClient";

export type UserRole = "firm_admin" | "accountant" | "client";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  firmId: string;
  firmUserId: string;
  clientId?: string;
  fullName?: string;
};

/**
 * Sign in with email and password.
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Map Supabase / fetch errors to friendlier messages so users don't
      // see "Load failed" or "Failed to fetch" and assume the app is
      // broken. Most of these are transient — a retry usually works.
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("load failed") || msg.includes("failed to fetch") || msg.includes("network")) {
        throw new Error("Network hiccup — please try again. If it keeps happening, check your connection.");
      }
      throw error;
    }

    // Update last_login as a fire-and-forget side-effect. This used to
    // block the sign-in: if the update failed (transient network issue
    // or a brief RLS lag right after a fresh signup), the whole
    // signIn() threw and the user saw "Load failed" even though auth
    // had succeeded. last_login is analytics — never worth breaking
    // sign-in over.
    if (data.user) {
      supabase
        .from("firm_users")
        .update({ last_login: new Date().toISOString() })
        .eq("auth_user_id", data.user.id)
        .then(({ error: updErr }) => {
          if (updErr) console.warn("last_login update failed (non-blocking):", updErr);
        });
    }

    return data;
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  }
}

/**
 * Send magic link for passwordless login (2FA).
 */
export async function sendMagicLink(email: string) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create new users via magic link
      },
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Magic link error:", error);
    throw error;
  }
}

/**
 * Sign out.
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    console.error("Sign out error:", error);
    throw error;
  }
}

/**
 * Check if user has permission for an action.
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  const permissions: Record<UserRole, string[]> = {
    firm_admin: [
      "view_all_clients",
      "view_all_receipts",
      "view_metrics",
      "manage_users",
      "invite_users",
      "view_accountant_data",
    ],
    accountant: [
      "view_all_clients",
      "view_all_receipts",
      "manage_receipts",
      "manage_clients",
      "categorize_receipts",
      "export_data",
      "manage_categories",
    ],
    client: [
      "view_own_receipts",
      "upload_receipts",
      "edit_receipt_purpose",
      "view_own_stats",
      "set_budget",
    ],
  };

  return permissions[user.role]?.includes(permission) || false;
}
