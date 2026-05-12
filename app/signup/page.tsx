"use client";

// app/signup/page.tsx
//
// Account-type chooser. The user picks "Firm" (multi-user accounting
// firm flow) or "Personal" (single-user $6.99/mo flow) before we drop
// them into the matching signup form. Keeping these as separate routes
// means each form can have its own copy and field set without a giant
// conditional component.

import Link from "next/link";

export default function SignupChooserPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Receipture</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
            How will you use Receipture?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Pick the account type that fits — you can&apos;t switch later, so choose carefully.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Firm */}
          <Link
            href="/signup/firm"
            className="group block rounded-2xl border-2 border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-6 hover:border-accent-500 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Firm account
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              For accounting firms handling multiple clients. Invite accountants,
              manage clients, run firm-wide reports.
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-4">
              <li>• Multiple clients &amp; accountant seats</li>
              <li>• Approvals, flags, client messaging</li>
              <li>• Firm-wide analytics &amp; tax reports</li>
            </ul>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Starter / Pro / Enterprise
              </span>
              <span className="text-xs font-medium text-accent-600 dark:text-accent-400 group-hover:translate-x-1 transition-transform">
                Continue →
              </span>
            </div>
          </Link>

          {/* Personal */}
          <Link
            href="/signup/personal"
            className="group block rounded-2xl border-2 border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-6 hover:border-accent-500 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-3">👤</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Personal account
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              For individuals and self-employed Canadians tracking their own
              finances and tax deductibles.
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-4">
              <li>• Capture receipts via photo, email, SMS</li>
              <li>• Self-employed CRA forms (optional)</li>
              <li>• Monthly net income &amp; tax-prep exports</li>
            </ul>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                $6.99/mo · 7-day free trial
              </span>
              <span className="text-xs font-medium text-accent-600 dark:text-accent-400 group-hover:translate-x-1 transition-transform">
                Continue →
              </span>
            </div>
          </Link>
        </div>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-600 dark:text-accent-400 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
