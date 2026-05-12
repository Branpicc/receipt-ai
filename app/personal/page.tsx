"use client";

// app/personal/page.tsx
//
// Marketing page for the Personal account ($6.99/mo or $54.99/yr). The
// firm landing at /page.tsx leads with firm-only language ("for
// accounting firms", multi-user dashboards, firm-wide analytics) which
// is the wrong pitch for individuals — so we point them here from the
// signup chooser and from a "For individuals?" link in the firm nav.

import Link from "next/link";
import { useState } from "react";
import {
  Receipt,
  Camera,
  Mail,
  MessageSquare,
  FileSpreadsheet,
  Calculator,
  Sparkles,
  CheckCircle2,
  Menu,
} from "lucide-react";

export default function PersonalLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const monthlyPrice = "$6.99";
  const annualPrice = "$4.58"; // $54.99/yr ÷ 12, shown as monthly equivalent
  const annualBilledNote = "Billed $54.99/year — save ~34%";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-lg">Receipture</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Features</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</a>
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">For firms</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">
              Sign in
            </Link>
            <Link
              href="/signup/personal"
              className="text-sm font-semibold px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
            >
              Start free trial
            </Link>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <Menu className="w-6 h-6 text-gray-900" />
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            <a href="#features" className="block text-gray-700" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#pricing" className="block text-gray-700" onClick={() => setMenuOpen(false)}>Pricing</a>
            <Link href="/" className="block text-gray-700" onClick={() => setMenuOpen(false)}>For firms</Link>
            <Link href="/login" className="block text-gray-700" onClick={() => setMenuOpen(false)}>Sign in</Link>
            <Link
              href="/signup/personal"
              className="block bg-blue-600 text-white text-center py-2 rounded-xl font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              Start free trial
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            For individuals &amp; self-employed Canadians
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Tax-prep, sorted.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Snap, email, or text your receipts. Receipture extracts everything,
            sorts it for the CRA, and hands you a tax-ready report when April
            rolls around.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup/personal"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-base shadow-lg shadow-blue-600/20"
            >
              Start your 7-day free trial
            </Link>
            <span className="text-sm text-gray-500">No credit card required</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            Built for one person, not a firm.
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Every feature is scoped to you. No clients to manage, no team to
            invite — just your receipts, your categories, your tax forms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Camera}
              title="Snap and forget"
              body="Photograph a receipt, forward an email, or text it in. AI extracts vendor, date, items, tax, and category."
            />
            <FeatureCard
              icon={Calculator}
              title="CRA-ready math"
              body="T2125, capital cost allowance, home office (Line 9945), quarterly HST — calculated correctly for your province."
            />
            <FeatureCard
              icon={FileSpreadsheet}
              title="Real .xlsx exports"
              body="One styled workbook with every receipt, every CRA line, and a Personal sheet. Hand it to your tax preparer."
            />
            <FeatureCard
              icon={Mail}
              title="Inbox-native capture"
              body="Forward your online order confirmations to your personal Receipture address. Done."
            />
            <FeatureCard
              icon={MessageSquare}
              title="SMS purpose collection"
              body="Optional: get a quick text asking what each receipt was for, so the purpose field is filled before you forget."
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Monthly net income"
              body="Revenue minus deductibles, charted by month. Always know what you actually made."
            />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple pricing.</h2>
          <p className="text-gray-600 mb-8">One plan. Seven days free. Cancel anytime.</p>

          <div className="inline-flex bg-white rounded-xl p-1 mb-10 border border-gray-200">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingInterval === "monthly"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingInterval === "annual"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Annual
              <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-semibold">
                Save 34%
              </span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-lg max-w-md mx-auto p-8">
            <div className="text-sm font-medium text-blue-600 mb-2">Personal plan</div>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-5xl font-bold">
                {billingInterval === "monthly" ? monthlyPrice : annualPrice}
              </span>
              <span className="text-gray-500">/month</span>
            </div>
            {billingInterval === "annual" && (
              <p className="text-sm text-green-600 mb-4">{annualBilledNote}</p>
            )}
            {billingInterval === "monthly" && (
              <p className="text-sm text-gray-500 mb-4">Billed monthly</p>
            )}
            <ul className="space-y-3 text-left mb-8 mt-6">
              {[
                "Unlimited receipts (photo, email, SMS)",
                "AI categorization &amp; OCR",
                "Self-employed CRA tax-prep forms",
                "Capital Cost Allowance &amp; home office",
                "Monthly net income summary",
                "Real .xlsx + CSV exports",
                "Email support",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span dangerouslySetInnerHTML={{ __html: f }} />
                </li>
              ))}
            </ul>
            <Link
              href="/signup/personal"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-center"
            >
              Start free trial
            </Link>
            <p className="text-xs text-gray-500 mt-3">No credit card required to start.</p>
          </div>
        </div>
      </section>

      {/* FIRM CALLOUT */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gray-600 mb-4">
            Running an accounting firm with multiple clients?
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 border-2 border-gray-900 text-gray-900 rounded-xl font-semibold hover:bg-gray-900 hover:text-white transition-colors"
          >
            See Receipture for firms →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Receipture. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}
