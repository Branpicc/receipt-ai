/**
 * Server-component email verification.
 *
 * The verification work runs on the server before any HTML is sent. By the
 * time the user's browser paints the page, the token is already consumed
 * and email_verified_at is set. No client-side fetch, no double-mount,
 * no hydration race, no "click another button to verify" friction.
 *
 * If an email-scanner pre-fetches the link, the server consumes the token
 * on that pre-fetch. When the human clicks for real, the server sees a
 * consumed token and returns the "Already verified" branch — still a
 * checkmark, still a sign-in CTA.
 */

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

type Outcome =
  | { kind: "success"; alreadyVerified: boolean }
  | { kind: "error"; message: string }
  | { kind: "missing" };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verify(token: string | undefined): Promise<Outcome> {
  if (!token) return { kind: "missing" };

  const { data: row, error: lookupErr } = await supabaseAdmin
    .from("email_verifications")
    .select("id, auth_user_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (lookupErr) {
    console.error("[verify-email] lookup failed:", lookupErr);
    return { kind: "error", message: "Verification failed. Please try again." };
  }
  if (!row) {
    return {
      kind: "error",
      message: "This link isn't valid. It may have already been used or expired.",
    };
  }
  if (row.consumed_at) {
    return { kind: "success", alreadyVerified: true };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return {
      kind: "error",
      message: "This link has expired. Sign in and request a new one from the dashboard banner.",
    };
  }

  const now = new Date().toISOString();
  const { error: fuErr } = await supabaseAdmin
    .from("firm_users")
    .update({ email_verified_at: now })
    .eq("auth_user_id", row.auth_user_id);
  if (fuErr) {
    console.error("[verify-email] firm_users update failed:", fuErr);
    return { kind: "error", message: "Verification failed. Please try again." };
  }

  const { error: tokErr } = await supabaseAdmin
    .from("email_verifications")
    .update({ consumed_at: now })
    .eq("id", row.id);
  if (tokErr) {
    // Non-blocking: verification succeeded; the token row just stays
    // unconsumed. Replays still resolve to success.
    console.error("[verify-email] token consume failed:", tokErr);
  }

  // Fire-and-forget welcome email. Doesn't gate the response.
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.auth_user_id);
    const { data: fu } = await supabaseAdmin
      .from("firm_users")
      .select("display_name, firm_id")
      .eq("auth_user_id", row.auth_user_id)
      .single();
    const firmId = fu?.firm_id;
    const { data: firm } = firmId
      ? await supabaseAdmin.from("firms").select("name").eq("id", firmId).single()
      : { data: null };
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    if (authUser.user?.email && fu?.display_name && firm?.name) {
      await sendWelcomeEmail(authUser.user.email, fu.display_name, firm.name, `${baseUrl}/dashboard`);
    }
  } catch (welcomeErr) {
    console.error("[verify-email] welcome email failed:", welcomeErr);
  }

  return { kind: "success", alreadyVerified: false };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const outcome = await verify(params.token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4">
      <div className="max-w-md w-full">
        <h1 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Receipture
        </h1>

        {outcome.kind === "success" && (
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 dark:bg-green-600 text-white flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              {outcome.alreadyVerified ? "Already verified" : "Email verified"}
            </h2>
            <p className="text-sm text-green-800 dark:text-green-200 mb-6">
              {outcome.alreadyVerified
                ? "Your email was already confirmed. Sign in to continue."
                : "Your email is confirmed. Sign in to start using Receipture."}
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition-colors w-full"
            >
              Sign in
            </Link>
          </div>
        )}

        {outcome.kind === "error" && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
              Verification failed
            </h2>
            <p className="text-sm text-red-800 dark:text-red-200 mb-6">{outcome.message}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        )}

        {outcome.kind === "missing" && (
          <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Open your verification email
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This page is reached by clicking the verification link in the email we sent you. Open
              your inbox and click the &quot;Verify email&quot; button there.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-gray-600 dark:text-gray-400 hover:underline"
            >
              Already verified? Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
