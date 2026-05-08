import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Receipture",
  description:
    "Terms governing the use of Receipture, a receipt-management platform for Canadian accounting firms.",
};

const LAST_UPDATED = "May 8, 2026";

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <Section title="1. Acceptance">
            <p>
              These Terms of Service (&quot;Terms&quot;) form a binding agreement
              between you and Receipture Inc. (&quot;Receipture&quot;, &quot;we&quot;, &quot;us&quot;).
              By creating an account or using the service, you confirm that you
              have read these Terms and agree to them. If you do not agree, do
              not use the service.
            </p>
          </Section>

          <Section title="2. The service">
            <p>
              Receipture is a software-as-a-service platform that helps
              accounting firms collect, extract, organize and report on their
              clients&apos; receipts and expense records. Specific features
              available to your account depend on the subscription plan your
              firm has chosen.
            </p>
          </Section>

          <Section title="3. Accounts and roles">
            <p>
              Receipture accounts have one of three roles: <em>firm
              administrator</em>, <em>accountant</em>, or <em>client</em>. The
              firm administrator is responsible for the firm&apos;s subscription
              and for inviting other users. You are responsible for keeping
              your sign-in credentials confidential and for all activity that
              occurs under your account.
            </p>
            <p>
              You must provide accurate information when creating an account
              and keep it up to date. You must be at least 18 years old to use
              Receipture.
            </p>
          </Section>

          <Section title="4. Subscriptions, billing and trials">
            <p>
              Receipture is offered on subscription plans (Starter,
              Professional, Enterprise) with monthly and annual billing. Each
              plan includes a 7-day free trial — no charge is made until the
              trial ends. Pricing is shown on our pricing page in CAD;
              applicable Canadian taxes (GST, HST, PST or QST) are calculated
              and added at checkout based on your billing address.
            </p>
            <p>
              Subscriptions renew automatically at the end of each billing
              period unless you cancel before renewal. You can cancel at any
              time from the Billing tab; cancellation takes effect at the end
              of the current period and your firm retains access until then.
              Receipture does not provide refunds for partial months, but you
              can downgrade or cancel at any time.
            </p>
            <p>
              Failed payments may result in restricted access until the
              outstanding balance is paid. If a payment remains unresolved for
              more than 30 days, we may suspend or terminate the account.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>By using Receipture, you agree NOT to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Upload content that is illegal, fraudulent, infringes others&apos;
                rights, or violates Canadian law.
              </li>
              <li>
                Use the service to send spam, phishing messages, or other
                unsolicited communications.
              </li>
              <li>
                Reverse-engineer, scrape, or attempt to circumvent any of the
                service&apos;s technical or rate limits.
              </li>
              <li>
                Use the service to process personal information of individuals
                who have not consented to it being submitted on their behalf.
              </li>
              <li>
                Resell, sublicense, or otherwise commercialize access to the
                service without our prior written consent.
              </li>
            </ul>
          </Section>

          <Section title="6. Your content">
            <p>
              You retain all rights in the receipts, documents, and other
              content you submit through Receipture (&quot;Customer Content&quot;).
              You grant Receipture a limited, non-exclusive licence to host,
              process, transmit, and display Customer Content for the purpose
              of providing the service to you. We do not use Customer Content
              for advertising, do not sell it, and do not use it to train
              third-party AI models.
            </p>
            <p>
              You are responsible for the accuracy and lawfulness of the
              Customer Content you upload, and for ensuring you have the
              authority to upload it on behalf of your firm and your firm&apos;s
              clients.
            </p>
          </Section>

          <Section title="7. AI-extracted data">
            <p>
              Receipture uses third-party artificial-intelligence services
              (including Anthropic&apos;s Claude and Google Cloud Vision) to
              extract structured data from receipts. AI extraction is
              probabilistic and may occasionally produce inaccurate results.
              You are responsible for reviewing extracted values before
              relying on them for tax filings, financial reports, or any
              other regulated purpose.
            </p>
          </Section>

          <Section title="8. Service availability">
            <p>
              We aim for high availability, but we do not guarantee that the
              service will be uninterrupted, error-free, or available at all
              times. We may temporarily suspend the service for maintenance,
              security, or operational reasons. Enterprise customers may have
              additional service-level commitments set out in a separate
              agreement.
            </p>
          </Section>

          <Section title="9. Intellectual property">
            <p>
              The Receipture name, logo, software, and all related materials
              are owned by Receipture Inc. or its licensors and are protected
              by Canadian and international intellectual-property laws.
              Nothing in these Terms grants you ownership of any part of the
              service.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              You may terminate your account at any time by cancelling your
              subscription and contacting us to delete the account. We may
              suspend or terminate your access if you violate these Terms,
              fail to pay, or pose a security or legal risk to the service.
              On termination, we will retain Customer Content only as
              required by law or our retention policy in the Privacy Policy,
              and will then delete it.
            </p>
          </Section>

          <Section title="11. Disclaimers">
            <p>
              The service is provided &quot;as is&quot; and &quot;as available&quot;. To the
              maximum extent permitted by Canadian law, Receipture disclaims
              all warranties, express or implied, including merchantability,
              fitness for a particular purpose, and non-infringement.
              Receipture is a tool that supports your accounting work; it is
              not a substitute for professional accounting, legal, or tax
              advice.
            </p>
          </Section>

          <Section title="12. Limitation of liability">
            <p>
              To the maximum extent permitted by Canadian law, Receipture&apos;s
              total liability for any claim arising out of or relating to
              these Terms or the service is limited to the amount your firm
              paid Receipture in the 12 months preceding the claim. In no
              event is Receipture liable for indirect, incidental, special,
              or consequential damages, including lost profits, lost data, or
              business interruption.
            </p>
          </Section>

          <Section title="13. Governing law">
            <p>
              These Terms are governed by the laws of the Province of Ontario
              and the federal laws of Canada applicable in Ontario. Any
              dispute arising out of or relating to these Terms or the
              service must be brought exclusively in the courts of Ontario,
              and you consent to the personal jurisdiction of those courts.
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms from time to time. Material changes
              will be communicated by email to firm administrators at least
              14 days before they take effect. Continued use of the service
              after changes take effect means you accept the updated Terms.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              Questions about these Terms? Email{" "}
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
