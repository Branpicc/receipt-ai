"use client";

import { useState } from "react";
import Link from "next/link";

type FieldErrors = Partial<Record<"firmName" | "fullName" | "email" | "password" | "confirm", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Must include a letter";
  if (!/\d/.test(pw)) return "Must include a number";
  return null;
}

export default function SignupPage() {
  const [firmName, setFirmName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validateAll(): FieldErrors {
    const e: FieldErrors = {};
    if (!firmName.trim()) e.firmName = "Firm name is required";
    if (!fullName.trim()) e.fullName = "Your name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email";
    const pwErr = validatePassword(password);
    if (pwErr) e.password = pwErr;
    if (confirm !== password) e.confirm = "Passwords don't match";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setTopError("");
    const errs = validateAll();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmName: firmName.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTopError(data.error || "Failed to create account.");
        return;
      }
      setDone(true);
    } catch {
      setTopError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4">
        <div className="max-w-md w-full">
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              Check your email
            </h2>
            <p className="text-sm text-green-800 dark:text-green-200 mb-1">
              We sent a verification link to
            </p>
            <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-4 break-all">
              {email}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mb-6">
              Click the link to verify your email, then sign in to start using Receipture.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const passwordHint = password ? validatePassword(password) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-bold text-gray-900 dark:text-white">
            Receipture
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
            Start your free trial
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Set up your firm. No credit card required.
          </p>
        </div>

        {topError && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{topError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Firm name
            </label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              autoComplete="organization"
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Smith & Associates"
            />
            {fieldErrors.firmName && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.firmName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Jane Smith"
            />
            {fieldErrors.fullName && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="you@firm.ca"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="••••••••"
            />
            <p
              className={`mt-1 text-xs ${
                passwordHint
                  ? "text-amber-600 dark:text-amber-400"
                  : password
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {passwordHint || (password ? "Looks good" : "At least 8 characters, with a letter and a number")}
            </p>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="••••••••"
            />
            {fieldErrors.confirm && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.confirm}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            By signing up, you agree to Receipture&apos;s terms of service and privacy policy.
          </p>
        </form>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-600 dark:text-accent-400 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
