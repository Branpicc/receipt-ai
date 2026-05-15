import { supabase } from "./supabaseClient";

export type UserRole = "owner" | "firm_admin" | "accountant" | "client";

const ROLE_CACHE_KEY = "receipture-cache:v1:userRole";

function readRoleCache(): UserRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (v === "owner" || v === "firm_admin" || v === "accountant" || v === "client") return v;
    return null;
  } catch { return null; }
}

function writeRoleCache(v: UserRole) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(ROLE_CACHE_KEY, v); } catch { /* ignore */ }
}

// Cached per-tab so repeat page navigations don't re-fetch this single
// row. The cache is cleared by clearWhoAmICache (called on sign-out).
export async function getUserRole(): Promise<UserRole | null> {
  const cached = readRoleCache();
  if (cached) return cached;

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

    // Return null when role is unknown — the previous default of "client"
    // caused a real bug where firm admins were briefly classified as
    // clients during page load and got redirected to /dashboard/client
    // (the client-only view). Callers should treat null as "still loading
    // / unknown" and not fall through to a destructive default.
    const role = (data?.role as UserRole) || null;
    if (role) writeRoleCache(role);
    return role;
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