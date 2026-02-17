// lib/auth.ts - Authentication utilities
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
 * Get the current authenticated user with their role and firm info
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Get Supabase auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    // Get firm_user record with role
    const { data: firmUser, error: firmUserError } = await supabase
      .from("firm_users")
      .select("id, firm_id, role, client_id, full_name")
      .eq("auth_user_id", user.id)
      .single();

    if (firmUserError || !firmUser) {
      console.error("Failed to get firm user:", firmUserError);
      return null;
    }

    return {
      id: user.id,
      email: user.email!,
      role: firmUser.role as UserRole,
      firmId: firmUser.firm_id,
      firmUserId: firmUser.id,
      clientId: firmUser.client_id || undefined,
      fullName: firmUser.full_name || undefined,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Sign up a new user (called during invitation acceptance)
 */
export async function signUp(email: string, password: string, invitationToken: string) {
  try {
    // Validate invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("user_invitations")
      .select("*")
      .eq("token", invitationToken)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          invitation_token: invitationToken,
        },
      },
    });

    if (signUpError) throw signUpError;

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Create firm_user record
    const { error: firmUserError } = await supabase
      .from("firm_users")
      .insert({
        auth_user_id: authData.user.id,
        firm_id: invitation.firm_id,
        email: invitation.email,
        role: invitation.role,
        client_id: invitation.client_id,
        invited_at: invitation.created_at,
        accepted_at: new Date().toISOString(),
      });

    if (firmUserError) throw firmUserError;

    // Mark invitation as accepted
    await supabase
      .from("user_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return { user: authData.user, session: authData.session };
  } catch (error: any) {
    console.error("Sign up error:", error);
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Update last_login
    if (data.user) {
      await supabase
        .from("firm_users")
        .update({ last_login: new Date().toISOString() })
        .eq("auth_user_id", data.user.id);
    }

    return data;
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  }
}

/**
 * Send magic link for passwordless login (2FA)
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
 * Sign out
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
 * Check if user has permission for an action
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

/**
 * Create an invitation for a new user
 */
export async function createInvitation(
  firmId: string,
  email: string,
  role: UserRole,
  invitedBy: string,
  clientId?: string
) {
  try {
    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

    const { data, error } = await supabase
      .from("user_invitations")
      .insert({
        firm_id: firmId,
        email,
        role,
        client_id: clientId,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { invitation: data, token };
  } catch (error: any) {
    console.error("Create invitation error:", error);
    throw error;
  }
}

/**
 * Validate an invitation token
 */
export async function validateInvitation(token: string) {
  try {
    const { data, error } = await supabase
      .from("user_invitations")
      .select(`
        *,
        firms(name),
        clients(business_name)
      `)
      .eq("token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return { valid: false, invitation: null };
    }

    return { valid: true, invitation: data };
  } catch (error) {
    console.error("Validate invitation error:", error);
    return { valid: false, invitation: null };
  }
}
