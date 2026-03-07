import { supabase } from "./supabaseClient";

export type UserRole = "owner" | "firm_admin" | "accountant" | "client";

export async function getUserRole(): Promise<UserRole | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("firm_users")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (error) {
      console.error("Failed to get user role:", error);
      return null;
    }

    return data?.role as UserRole || "client";
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

export async function isOwner(): Promise<boolean> {
  const role = await getUserRole();
  return role === "owner";
}

export async function isFirmAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === "firm_admin" || role === "owner"; // Owner has all firm_admin permissions
}

export async function isAccountant(): Promise<boolean> {
  const role = await getUserRole();
  return role === "accountant" || role === "owner"; // Owner can do everything accountants can
}

export async function isClient(): Promise<boolean> {
  const role = await getUserRole();
  return role === "client";
}

// Check if user has write permissions (can edit/approve)
export async function canEdit(): Promise<boolean> {
  const role = await getUserRole();
  return role === "owner" || role === "accountant";
}

// Check if user has admin/oversight permissions
export async function hasAdminAccess(): Promise<boolean> {
  const role = await getUserRole();
  return role === "owner" || role === "firm_admin";
}