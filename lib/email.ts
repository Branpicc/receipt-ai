/**
 * SendGrid email helpers for Receipture transactional mail.
 *
 * Sending domain `em4931.receipture.ca` is authenticated, so any
 * `*@receipture.ca` from-address inherits trust automatically.
 *
 * - From:     noreply@receipture.ca
 * - Reply-To: hello@receipture.ca
 *
 * Failures are surfaced (don't swallow them silently like the invite flow
 * does) — the API routes calling these helpers decide what to do on error.
 * Signup will return 500; resend will tell the user; verification email is
 * the critical path.
 */

const FROM_EMAIL = "noreply@receipture.ca";
const FROM_NAME = "Receipture";
const REPLY_TO = "hello@receipture.ca";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

async function send({ to, subject, html }: SendArgs) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }
  const sgMail = await import("@sendgrid/mail");
  sgMail.default.setApiKey(apiKey);
  await sgMail.default.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: REPLY_TO,
    subject,
    html,
  });
}

function shell(bodyHtml: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; color: #0f172a;">
  <div style="text-align: left; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">Receipture</h1>
  </div>
  ${bodyHtml}
  <p style="color: #94a3b8; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    Receipture · Receipt management for Canadian accounting firms · receipture.ca
  </p>
</div>
  `.trim();
}

export async function sendVerifyEmail(toEmail: string, fullName: string, verifyUrl: string) {
  const greeting = fullName?.trim() ? `Hi ${escapeHtml(fullName.split(" ")[0])},` : "Hi,";
  await send({
    to: toEmail,
    subject: "Verify your email for Receipture",
    html: shell(`
      <p style="font-size: 16px; margin: 0 0 16px;">${greeting}</p>
      <p style="font-size: 16px; margin: 0 0 24px;">
        Welcome to Receipture. Click the button below to verify your email and finish setting up your firm's account.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Verify email
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">
        Or paste this link into your browser:
      </p>
      <p style="font-size: 13px; color: #475569; margin: 0 0 24px; word-break: break-all;">
        <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
      </p>
      <p style="font-size: 13px; color: #94a3b8; margin: 0;">
        This link expires in 24 hours. If you didn't sign up for Receipture, you can ignore this email.
      </p>
    `),
  });
}

export async function sendWelcomeEmail(toEmail: string, fullName: string, firmName: string, dashboardUrl: string) {
  const greeting = fullName?.trim() ? `Hi ${escapeHtml(fullName.split(" ")[0])},` : "Hi,";
  await send({
    to: toEmail,
    subject: `Welcome to Receipture, ${escapeHtml(fullName.split(" ")[0] || firmName)}!`,
    html: shell(`
      <p style="font-size: 16px; margin: 0 0 16px;">${greeting}</p>
      <p style="font-size: 16px; margin: 0 0 24px;">
        Your email's verified — <strong>${escapeHtml(firmName)}</strong> is live on Receipture.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Open the dashboard
        </a>
      </p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 12px;">
        We'll walk you through the basics on your first sign-in. While you're there:
      </p>
      <ul style="font-size: 14px; color: #475569; margin: 0 0 24px; padding-left: 20px;">
        <li style="margin-bottom: 6px;">Add your first client</li>
        <li style="margin-bottom: 6px;">Invite your accountants</li>
        <li style="margin-bottom: 6px;">Upload a test receipt to see the OCR + categorization in action</li>
      </ul>
      <p style="font-size: 13px; color: #94a3b8; margin: 0;">
        Questions? Just reply to this email — we read every one.
      </p>
    `),
  });
}

// ── Owner notification on signup ────────────────────────────────────────────
//
// Sends a heads-up to the Receipture owner inbox every time a new
// firm or personal account is created. Includes the contact info
// needed to reach out personally — name, email, phone (personal
// only), and key metadata (trial end, plan).
//
// Recipient is the OWNER_NOTIFY_EMAIL env var, with a fallback to
// brandanpicc@receipture.ca so it works even if env isn't set yet.
// Best-effort: callers should never let a send failure here block
// account creation. Wrap the call in try/catch on the signup route.

const OWNER_NOTIFY_EMAIL =
  process.env.OWNER_NOTIFY_EMAIL || "brandanpicc@receipture.ca";

type SignupNotificationArgs = {
  accountType: "firm" | "personal";
  fullName: string;
  email: string;
  // For firm signups — the firm name they entered.
  firmName?: string | null;
  // For personal signups — E.164 phone the user verified.
  phone?: string | null;
  // For personal signups — trial deadline (ISO timestamp). When the
  // paywall kicks in.
  trialEndsAt?: string | null;
  // Optional IP address from the request, useful for spotting
  // suspicious clusters (multiple signups from the same IP within
  // minutes). Pulled from x-forwarded-for at the caller site.
  ip?: string | null;
};

export async function sendSignupNotification(args: SignupNotificationArgs) {
  const {
    accountType,
    fullName,
    email,
    firmName,
    phone,
    trialEndsAt,
    ip,
  } = args;

  const isPersonal = accountType === "personal";
  const typeLabel = isPersonal ? "Personal" : "Firm";
  const headline = isPersonal
    ? `New personal signup: ${fullName}`
    : `New firm signup: ${firmName || fullName}`;

  const rows: { label: string; value: string }[] = [
    { label: "Account type", value: typeLabel },
    { label: "Name", value: fullName },
    { label: "Email", value: email },
  ];
  if (firmName) rows.push({ label: "Firm name", value: firmName });
  if (phone) rows.push({ label: "Phone", value: phone });
  rows.push({ label: "Signed up at", value: new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" }) + " ET" });
  if (trialEndsAt) {
    rows.push({
      label: "Trial ends",
      value: new Date(trialEndsAt).toLocaleString("en-CA", { timeZone: "America/Toronto" }) + " ET",
    });
  }
  if (ip) rows.push({ label: "IP", value: ip });

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding: 8px 12px; color: #64748b; font-size: 13px; vertical-align: top; white-space: nowrap;">${escapeHtml(r.label)}</td>
      <td style="padding: 8px 12px; color: #0f172a; font-size: 14px; vertical-align: top;">${escapeHtml(r.value)}</td>
    </tr>
  `).join("");

  await send({
    to: OWNER_NOTIFY_EMAIL,
    subject: headline,
    html: shell(`
      <p style="font-size: 16px; margin: 0 0 8px;"><strong>${escapeHtml(headline)}</strong></p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        Reach out within a day or two if you want to onboard them personally — replying directly to their email below works.
      </p>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <p style="margin: 24px 0 0;">
        <a href="mailto:${escapeHtml(email)}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Email ${escapeHtml(fullName.split(" ")[0] || "them")} →
        </a>
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
        Automated notification from Receipture. To stop receiving these, change OWNER_NOTIFY_EMAIL in your Vercel env or comment out the call in the signup routes.
      </p>
    `),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
