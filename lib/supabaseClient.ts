// lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Invalidate the "who am I?" caches on sign-out (or session expiry) so
// a new account signing in on the same tab doesn't inherit stale
// role/firm/plan from the previous user. Runs once per browser tab.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
      try {
        const keys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith("receipture-cache:")) keys.push(k);
        }
        keys.forEach(k => sessionStorage.removeItem(k));
      } catch { /* ignore */ }
    }
  });
}
