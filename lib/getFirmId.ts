// lib/getFirmId.ts
//
// Helpers that resolve "who is this user?" for the current tab session.
// Each helper caches its result in sessionStorage (per-tab, cleared when
// the tab closes) so repeat calls on the same page navigation don't
// fan out into extra round-trips to Supabase. On mobile data, before
// the cache, every page change triggered 3–4 sequential auth/firm
// lookups which added 1–3 seconds of latency by themselves.
//
// Cache invalidation: caches are auto-cleared on sign-out (the auth
// listener in supabaseClient.ts) and via the CACHE_VERSION bump if the
// schema changes. They're also cleared if any value is null/undefined.

import { supabase } from "./supabaseClient";

const CACHE_VERSION = "v1";

function cacheKey(name: string): string {
  return `receipture-cache:${CACHE_VERSION}:${name}`;
}

function readCache<T>(name: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

function writeCache(name: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(name), JSON.stringify(value));
  } catch { /* quota full or disabled; just skip */ }
}

export function clearWhoAmICache() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`receipture-cache:`)) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

export async function getMyFirmId(): Promise<string> {
  const cached = readCache<string>("firmId");
  if (cached) return cached;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated - no session");

  const { data: firmUser, error } = await supabase
    .from("firm_users")
    .select("firm_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (error) throw new Error(`Database error: ${error.message}`);
  if (!firmUser) throw new Error("No firm found for user");

  writeCache("firmId", firmUser.firm_id);
  return firmUser.firm_id;
}

export async function getMyClientId(): Promise<string | null> {
  const cached = readCache<string | null>("clientId");
  if (cached !== null) return cached;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: firmUser } = await supabase
    .from("firm_users")
    .select("client_id")
    .eq("auth_user_id", session.user.id)
    .single();

  const v = firmUser?.client_id || null;
  if (v) writeCache("clientId", v);
  return v;
}
