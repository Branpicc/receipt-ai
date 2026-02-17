"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, sendMagicLink } from "@/lib/auth";

export default function LoginPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-bold text-gray-900">
            ReceiptAI
          </h1>
          <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Accounting software for Canadian small businesses
          </p>
        </div>

        {magicLinkSent ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">✉️</div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Check your email
              </h3>
              <p className="text-sm text-green-700">
                We've sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-green-700 mt-2">
                Click the link in the email to sign in securely.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="mt-4 text-sm text-green-800 underline hover:text-green-900"
              >
                ← Back to login
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                onClick={() => setUseMagicLink(false)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                  !useMagicLink
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Password
              </button>
              <button
                onClick={() => setUseMagicLink(true)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                  useMagicLink
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
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
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              {!useMagicLink && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Loading..."
                  : useMagicLink
                  ? "Send magic link"
                  : "Sign in"}
              </button>
            </form>

            {!useMagicLink && (
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Forgot your password?
                </a>
              </div>
            )}

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <span className="text-gray-900">Contact your firm administrator</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
