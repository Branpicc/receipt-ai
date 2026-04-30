"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Mail } from "lucide-react";

/**
 * Sticky top banner that appears whenever the current user's
 * `firm_users.email_verified_at` is null. Lets them resend the
 * verification email (rate-limited server-side at 60s).
 *
 * Renders nothing if:
 *   - user not logged in,
 *   - email already verified,
 *   - we couldn't load firm_users (treat as verified to avoid false alarm).
 */
export default function EmailVerifyBanner() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("firm_users")
          .select("email_verified_at")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (data && data.email_verified_at == null) {
          setEmail(user.email || "");
          setShow(true);
        }
      } catch {
        // Silent: if we can't read firm_users, don't show a misleading banner.
      }
    })();
  }, []);

  async function resend() {
    setResending(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setFeedback({ kind: "error", msg: "Sign in again to resend." });
        return;
      }
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ kind: "error", msg: data.error || "Failed to send." });
        return;
      }
      setFeedback({ kind: "success", msg: "Verification email sent. Check your inbox." });
    } catch {
      setFeedback({ kind: "error", msg: "Network error. Try again." });
    } finally {
      setResending(false);
    }
  }

  if (!show) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
        <Mail className="w-4 h-4 text-amber-700 dark:text-amber-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>Verify your email.</strong> We sent a link to{" "}
            <span className="font-mono break-all">{email}</span>.
          </p>
          {feedback && (
            <p
              className={`text-xs mt-1 ${
                feedback.kind === "success"
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {feedback.msg}
            </p>
          )}
        </div>
        <button
          onClick={resend}
          disabled={resending}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {resending ? "Sending…" : "Resend link"}
        </button>
      </div>
    </div>
  );
}
