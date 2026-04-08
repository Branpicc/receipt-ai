"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, sendMagicLink } from "@/lib/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
<h1 className="text-center text-4xl font-bold text-gray-900 dark:text-white">
            Receipture
          </h1>
                    <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
<p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Receipt management for Canadian accounting firms
          </p>
                  </div>

        {magicLinkSent ? (
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">✉️</div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                Check your email
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                We've sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                Click the link in the email to sign in securely.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="mt-4 text-sm text-green-800 dark:text-green-200 underline hover:text-green-900 dark:hover:text-green-100"
              >
                ← Back to login
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {error && (
              <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-dark-border rounded-2xl">
              <button
                onClick={() => setUseMagicLink(false)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                  !useMagicLink
                    ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Password
              </button>
              <button
                onClick={() => setUseMagicLink(true)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                  useMagicLink
                    ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Magic Link (2FA)
              </button>
            </div>

            <form
              onSubmit={useMagicLink ? handleMagicLinkRequest : handlePasswordLogin}
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-400 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              {!useMagicLink && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 dark:focus:ring-accent-400 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Loading..." : useMagicLink ? "Send magic link" : "Sign in"}
              </button>
            </form>

            {!useMagicLink && (
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
                >
                  Forgot your password?
                </a>
              </div>
            )}

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <span className="text-gray-900 dark:text-white">Contact your firm administrator</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}