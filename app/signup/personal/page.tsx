"use client";

// app/signup/personal/page.tsx
//
// Personal signup, 3 steps:
//   1. Email + phone — server validates email (real domain), rate-
//      limits, and SMS-codes the phone.
//   2. 6-digit code entry — server returns a verification token.
//   3. Name + password — final POST creates the auth user + firm-of-one
//      + client, using the verification token to prove the phone is
//      ours.
//
// Phone-gating is the main abuse deterrent. The marketing pitch
// "no credit card required" stays intact; the 7-day trial paywall
// (enforced on the dashboard) takes over from there.

import { useState } from "react";
import Link from "next/link";

type Step = "email_phone" | "code" | "details";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Must include a letter";
  if (!/\d/.test(pw)) return "Must include a number";
  return null;
}

export default function PersonalSignupPage() {
  const [step, setStep] = useState<Step>("email_phone");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [topError, setTopError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // ── Step 1: email + phone → send code ────────────────────────────
  async function handleSendCode(ev: React.FormEvent) {
    ev.preventDefault();
    setTopError("");
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setTopError("Enter a valid email address.");
      return;
    }
    if (!phone.trim()) {
      setTopError("Enter a phone number to verify.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup/personal/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTopError(data.error || "Could not send code.");
        return;
      }
      setStep("code");
    } catch {
      setTopError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 2: verify code → get token ──────────────────────────────
  async function handleVerifyCode(ev: React.FormEvent) {
    ev.preventDefault();
    setTopError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setTopError("Enter the 6-digit code from your text message.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup/personal/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTopError(data.error || "Wrong code.");
        return;
      }
      setVerificationToken(data.verificationToken);
      setStep("details");
    } catch {
      setTopError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 3: name + password → create account ─────────────────────
  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setTopError("");
    if (!fullName.trim()) {
      setTopError("Your name is required.");
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) { setTopError(pwErr); return; }
    if (confirm !== password) { setTopError("Passwords don't match."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/signup/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          verificationToken,
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
              Click the link to verify your email, then sign in to start your 7-day free trial.
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
            Start your 7-day free trial
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Personal plan — $6.99/mo after the trial. No credit card required to start.
          </p>
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-500">
            <Link href="/signup" className="hover:underline">← Switch to a firm account instead</Link>
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {(["email_phone", "code", "details"] as Step[]).map((s, i) => {
            const reached = ["email_phone", "code", "details"].indexOf(step) >= i;
            return (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  reached ? "bg-accent-500" : "bg-gray-200 dark:bg-dark-border"
                }`}
              />
            );
          })}
        </div>

        {topError && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{topError}</p>
          </div>
        )}

        {step === "email_phone" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mobile phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="(416) 555-0123"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                We'll text you a 6-digit code to confirm. Canadian and US numbers supported.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                Code sent to <strong>{phone}</strong>.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Didn't get one?{" "}
                <button
                  type="button"
                  onClick={() => { setStep("email_phone"); setCode(""); }}
                  className="text-accent-600 dark:text-accent-400 hover:underline"
                >
                  Edit phone &amp; resend
                </button>
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                autoFocus
                className="w-full px-4 py-3 text-center tracking-[0.6em] font-mono text-xl border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Verifying…" : "Verify code"}
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Your full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="Alex Tremblay"
              />
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
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating account…" : "Start free trial"}
            </button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By signing up, you agree to Receipture&apos;s terms of service and privacy policy.
            </p>
          </form>
        )}

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
