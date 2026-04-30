"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type State =
  | { kind: "loading" }
  | { kind: "success"; alreadyVerified: boolean }
  | { kind: "error"; message: string };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) setState({ kind: "error", message: "Missing verification token." });
        return;
      }
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", message: data.error || "Verification failed." });
          return;
        }
        setState({ kind: "success", alreadyVerified: !!data.alreadyVerified });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Network error. Please try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4">
      <div className="max-w-md w-full">
        <h1 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Receipture
        </h1>

        {state.kind === "loading" && (
          <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Verifying your email…</p>
          </div>
        )}

        {state.kind === "success" && (
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              {state.alreadyVerified ? "Already verified" : "Email verified"}
            </h2>
            <p className="text-sm text-green-800 dark:text-green-200 mb-6">
              {state.alreadyVerified
                ? "Your email was already confirmed. You can sign in any time."
                : "Your email is confirmed. Sign in to start using Receipture."}
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
              Verification failed
            </h2>
            <p className="text-sm text-red-800 dark:text-red-200 mb-6">{state.message}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
