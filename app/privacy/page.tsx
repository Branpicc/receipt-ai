import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Receipture",
  description:
    "How Receipture collects, uses, stores and protects your personal information under Canadian privacy law (PIPEDA).",
};

// Last reviewed date is shown in the page so users know when this was
// most recently updated. Update this whenever the policy changes.
const LAST_UPDATED = "May 8, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/"
          className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
        >
          ← Back to Receipture
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-6 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <Section title="1. Who we are">
            <p>
              Receipture is a receipt-management platform operated by Receipture
              Inc. (&quot;Receipture&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), based in Ontario,
              Canada. This policy explains how we handle personal information in
              compliance with Canada&apos;s Personal Information Protection and
              Electronic Documents Act (PIPEDA) and Ontario&apos;s privacy framework.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Account info:</strong> name, email address, password
                hash, role (firm admin, accountant, or client), and the firm you
                belong to.
              </li>
              <li>
                <strong>Contact info:</strong> phone number (for clients who
                opt in to SMS receipt prompts).
              </li>
              <li>
                <strong>Receipt data:</strong> images of receipts you upload,
                emails you forward to your account&apos;s ingestion address, and
                the structured data we extract from them (vendor, date, total,
                tax, line items, payment method, last-four card digits).
              </li>
              <li>
                <strong>Billing info:</strong> handled by Stripe; Receipture
                stores only the customer ID and subscription state, never card
                numbers or full payment details.
              </li>
              <li>
                <strong>Usage info:</strong> standard server logs (IP address,
                user agent, timestamps) used for security and debugging.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <p>We use this information to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Provide the receipt-capture, OCR, and reporting service.</li>
              <li>
                Send transactional messages (account verification, billing
                receipts, SMS prompts asking for the purpose of a receipt).
              </li>
              <li>
                Process payments and manage subscriptions through Stripe.
              </li>
              <li>
                Detect abuse, prevent fraud, and enforce our Terms of Service.
              </li>
              <li>Improve the product (aggregated, non-identifying analytics).</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal information. We do
              not use the contents of your receipts for marketing or to train
              third-party AI models.
            </p>
          </Section>

          <Section title="4. Service providers we share data with">
            <p>
              We share narrowly-scoped data with the following third-party
              providers, each governed by their own privacy policies:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Supabase</strong> — database and authentication hosting.
              </li>
              <li>
                <strong>Vercel</strong> — application hosting and edge delivery.
              </li>
              <li>
                <strong>Stripe</strong> — payment processing and subscription
                billing.
              </li>
              <li>
                <strong>Twilio</strong> — outbound SMS to clients who have opted
                in to text-message receipt prompts.
              </li>
              <li>
                <strong>SendGrid</strong> — outbound transactional email and
                inbound parsing of forwarded receipts.
              </li>
              <li>
                <strong>Anthropic (Claude API)</strong> — receipt content
                extraction. Receipt images and OCR text are sent to Claude for
                structured extraction; Anthropic states it does not retain
                customer API data for training.
              </li>
              <li>
                <strong>Google Cloud Vision</strong> — optical character
                recognition on receipt images.
              </li>
            </ul>
            <p>
              We do not transfer personal information to other parties for
              their own marketing or advertising purposes.
            </p>
          </Section>

          <Section title="5. Where your data is stored">
            <p>
              Your data is stored on infrastructure operated by the providers
              listed above, primarily in North American data regions. Some
              providers may process data in the United States, where laws
              differ from Canada&apos;s. By using Receipture you consent to this
              cross-border processing for the purpose of providing the service.
            </p>
          </Section>

          <Section title="6. How long we keep your data">
            <p>
              We retain account and receipt data for as long as your firm has
              an active account, plus a reasonable period afterward to satisfy
              legal, tax, and accounting record-retention requirements (in
              Canada, generally six years after the relevant tax year). You may
              request deletion at any time, subject to those retention
              obligations.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>Under PIPEDA, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Access the personal information we hold about you.</li>
              <li>Correct information that is inaccurate or incomplete.</li>
              <li>Withdraw consent for non-essential processing.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>
                File a complaint with the Office of the Privacy Commissioner
                of Canada if you believe your rights have been violated.
              </li>
            </ul>
            <p>
              To exercise any of these rights, email us at{" "}
              <a
                href="mailto:hello@receipture.ca"
                className="text-accent-600 dark:text-accent-400 hover:underline"
              >
                hello@receipture.ca
              </a>
              .
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use industry-standard measures to protect your data: TLS for
              data in transit, encryption at rest on managed databases,
              role-based access controls, and Supabase Row-Level Security to
              isolate data between firms. No system is perfectly secure; if we
              ever experience a breach affecting your information, we will
              notify you and the appropriate regulators in accordance with
              Canadian breach-notification rules.
            </p>
          </Section>

          <Section title="9. Cookies and tracking">
            <p>
              Receipture uses cookies and local storage strictly for sign-in
              sessions and theme preferences. We do not use third-party
              advertising cookies or cross-site tracking. We may adopt
              privacy-respecting product analytics (such as PostHog) in the
              future; if so, this policy will be updated.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              Receipture is a business tool and is not directed to children
              under 18. We do not knowingly collect personal information from
              children.
            </p>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes
              will be communicated by email to firm administrators at least 14
              days before they take effect. The &quot;Last updated&quot; date at the
              top of this page reflects the most recent revision.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions or concerns about this policy or your personal
              information? Email{" "}
              <a
                href="mailto:hello@receipture.ca"
                className="text-accent-600 dark:text-accent-400 hover:underline"
              >
                hello@receipture.ca
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
