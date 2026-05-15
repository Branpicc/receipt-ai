/**
 * Personal-account signup.
 *
 * Architecturally identical to /api/signup (firm signup), with these
 * differences:
 *   • No firmName field — we mint a hidden firm-of-one named after the
 *     user so existing firm_id-scoped queries keep working without
 *     plumbing a second tenancy model.
 *   • firms.account_type = 'personal' (gates UI: hide team/messaging,
 *     show personal-plan billing only).
 *   • subscription_plan = 'personal' (7-day trial state still applies).
 *   • A single client row is auto-created representing the user
 *     themselves, and firm_users.client_id is set so the dashboard
 *     defaults to that client without any picker.
 *
 * Same rollback semantics: if firm/firm_users/client creation fails we
 * delete the auth user so the email isn't permanently burned.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendVerifyEmail } from "@/lib/email";
import { isDisposableEmail } from "@/lib/disposableEmailDomains";

const TRIAL_DAYS = 7;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TOKEN_TTL_HOURS = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function passwordError(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw)) return "Password must include a letter.";
  if (!/\d/.test(pw)) return "Password must include a number.";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName: string = (body.fullName || "").trim();
    const email: string = (body.email || "").trim().toLowerCase();
    const password: string = body.password || "";
    // verificationToken is the id of the phone_verifications row that
    // the /verify-code endpoint marked verified. We re-validate it
    // here so a client can't bypass the SMS gate.
    const verificationToken: string = (body.verificationToken || "").trim();

    if (!fullName) return badRequest("Your full name is required.");
    if (fullName.length > 200) return badRequest("Name is too long.");
    if (!email || !EMAIL_RE.test(email)) return badRequest("Enter a valid email address.");
    if (isDisposableEmail(email)) {
      return badRequest("Disposable email addresses are not allowed for signup.");
    }
    const pwErr = passwordError(password);
    if (pwErr) return badRequest(pwErr);
    if (!verificationToken) {
      return badRequest("Phone verification is required before creating an account.");
    }

    // Validate the verification token: must exist, be verified, not expired,
    // and not already consumed by another signup attempt.
    const { data: vRow } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, phone, verified_at, expires_at, consumed_at")
      .eq("id", verificationToken)
      .maybeSingle();
    if (!vRow) return badRequest("Invalid verification token. Restart the signup.");
    if (!vRow.verified_at) return badRequest("Phone verification not completed. Re-enter the code.");
    if (vRow.consumed_at) return badRequest("This verification has already been used. Restart the signup.");
    // Tokens are good for 30 minutes after verification — gives the
    // user time to fill in the rest of the form.
    const verifiedAt = new Date(vRow.verified_at).getTime();
    if (Date.now() - verifiedAt > 30 * 60 * 1000) {
      return badRequest("Verification expired. Restart the signup.");
    }
    const signupPhone: string = vRow.phone;

    // Enforce uniqueness in this code path too (defense in depth — the
    // DB unique index is the final word).
    const { data: phoneDupe } = await supabaseAdmin
      .from("firms")
      .select("id")
      .eq("signup_phone", signupPhone)
      .maybeSingle();
    if (phoneDupe) {
      return NextResponse.json(
        { error: "This phone number is already linked to an account. Sign in instead." },
        { status: 409 }
      );
    }

    // Reject duplicate auth users.
    let page = 1;
    while (page < 50) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      if (!data.users || data.users.length === 0) break;
      if (data.users.some(u => u.email?.toLowerCase() === email)) {
        return NextResponse.json(
          { error: "An account with this email already exists. Try signing in instead." },
          { status: 409 }
        );
      }
      if (data.users.length < 1000) break;
      page++;
    }

    // 1. Create auth user (auto-confirm so Supabase's email is suppressed).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: fullName },
    });
    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message || "Failed to create account." },
        { status: 500 }
      );
    }
    const authUserId = created.user.id;

    // 2. Create the firm-of-one. account_type='personal' is the marker
    //    every downstream gate keys on. signup_phone is the unique
    //    key we use to detect trial re-stacking (same phone twice =
    //    409 in the send-code endpoint). trial_ends_at is the hard
    //    deadline after which the dashboard paywall kicks in.
    const firmName = `${fullName} (personal)`;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: firm, error: firmErr } = await supabaseAdmin
      .from("firms")
      .insert([{
        name: firmName,
        created_via_self_serve: true,
        account_type: "personal",
        subscription_plan: "personal",
        subscription_tier: "trial",
        signup_phone: signupPhone,
        trial_ends_at: trialEndsAt,
      }])
      .select("id")
      .single();
    if (firmErr || !firm) {
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
      return NextResponse.json(
        { error: firmErr?.message || "Failed to create account." },
        { status: 500 }
      );
    }

    // 3. Auto-create the single client representing the user. Default
    //    to ON / not registered — they tune this in onboarding.
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .insert([{
        firm_id: firm.id,
        name: fullName,
        province: "ON",
        gst_hst_registered: false,
        is_active: true,
        is_self_employed: false,
      }])
      .select("id")
      .single();
    if (clientErr || !client) {
      try { await supabaseAdmin.from("firms").delete().eq("id", firm.id); } catch {}
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
      return NextResponse.json(
        { error: clientErr?.message || "Failed to create account." },
        { status: 500 }
      );
    }

    // 4. firm_users row — role is firm_admin so they have full control of
    //    their own data; client_id pins the dashboard to "themselves".
    const { error: fuErr } = await supabaseAdmin
      .from("firm_users")
      .insert([{
        firm_id: firm.id,
        auth_user_id: authUserId,
        role: "firm_admin",
        display_name: fullName,
        email_verified_at: null,
        client_id: client.id,
      }]);
    if (fuErr) {
      try { await supabaseAdmin.from("clients").delete().eq("id", client.id); } catch {}
      try { await supabaseAdmin.from("firms").delete().eq("id", firm.id); } catch {}
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
      return NextResponse.json(
        { error: fuErr.message || "Failed to set up account." },
        { status: 500 }
      );
    }

    // Mark the SMS verification token as consumed so it can't be
    // replayed for a second account.
    try {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", verificationToken);
    } catch (e) {
      // Non-blocking — the firm row's unique signup_phone is the
      // strongest guard.
      console.warn("[signup/personal] Failed to mark phone token consumed:", e);
    }

    // 5. Verification token + branded email.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error: tokenErr } = await supabaseAdmin
      .from("email_verifications")
      .insert([{ auth_user_id: authUserId, token, expires_at: expiresAt }]);
    if (tokenErr) {
      console.error("[signup/personal] Failed to insert verification token:", tokenErr);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    try {
      await sendVerifyEmail(email, fullName, verifyUrl);
    } catch (emailErr) {
      const msg = (emailErr as { message?: string })?.message || String(emailErr);
      console.error("[signup/personal] Failed to send verification email:", msg);
    }

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("[signup/personal] Unexpected error:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
