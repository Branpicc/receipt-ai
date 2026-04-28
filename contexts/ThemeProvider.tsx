"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "receipture-theme";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readLocalTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function applyTheme(newTheme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (newTheme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
  } else {
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Hydrate from localStorage synchronously on first render so the client and
  // the inline <head> script agree, and there's no flash on subsequent navs.
  const [theme, setThemeState] = useState<Theme>(() => readLocalTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Reconcile with server-stored preference once we have a session. If it
  // differs, write it back to localStorage so future loads are correct.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("user_preferences")
          .select("theme")
          .eq("user_id", user.id)
          .single();
        const remote = data?.theme as Theme | undefined;
        if (cancelled) return;
        if (remote && remote !== theme) {
          window.localStorage.setItem(STORAGE_KEY, remote);
          setThemeState(remote);
        }
      } catch {
        // No session, no preference row — leave local state as-is
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(newTheme: Theme) {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, newTheme);
    }
    // Fire-and-forget Supabase upsert; UI doesn't wait
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from("user_preferences")
          .upsert({ user_id: user.id, theme: newTheme }, { onConflict: "user_id" });
      } catch {
        // Best-effort — local persistence already happened
      }
    })();
  }

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    persist(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: persist }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
