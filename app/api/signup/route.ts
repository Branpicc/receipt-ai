/**
 * Self-serve firm-admin signup.
 *
 * Public endpoint — no caller authentication required, since signing up
 * means you don't have an account yet. This is the *only* path by which
 * a firm_admin role is created via self-serve; accountants and clients
 * exist only through the existing invite flow.
 *
 * Flow:
 *   1. Validate inputs (email format, password strength, firm/full names).
 *   2. Reject if a Supabase auth user with this email already exists.
 *   3. supabase.auth.admin.createUser({ email_confirm: true }) — auto-
 *      confirms so Supabase doesn't fire its own un-branded verification
 *      email; we send our own next.
 *   4. Create the firms row with created_via_self_serve = true.
 *   5. Create the firm_users row with role = firm_admin, email_verified_at
 *      left null so the dashboard banner appears until they click verify.
 *   6. Issue a single-use token in email_verifications, send our branded
 *      verification email via SendGrid.
 *
 * If any step after the auth user is created fails, we tear down what we
 * built so a partial signup doesn't leave an orphaned auth user the email
 * can never be re-used for.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendVerifyEmail } from "@/lib/email";

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
    const firmName: string = (body.firmName || "").trim();
    const fullName: string = (body.fullName || "").trim();
    const email: string = (body.email || "").trim().toLowerCase();
    const password: string = body.password || "";

    if (!firmName) return badRequest("Firm name is required.");
    if (firmName.length > 200) return badRequest("Firm name is too long.");
    if (!fullName) return badRequest("Your full name is required.");
    if (fullName.length > 200) return badRequest("Name is too long.");
    if (!email || !EMAIL_RE.test(email)) return badRequest("Enter a valid email address.");
    const pwErr = passwordError(password);
    if (pwErr) return badRequest(pwErr);

    // Reject if an auth user with this email already exists. listUsers
    // paginates; in practice we won't have so many users that the first
    // page misses a match, but we'll loop to be safe.
    const lower = email;
    let page = 1;
    while (page < 50) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      if (!data.users || data.users.length === 0) break;
      if (data.users.some(u => u.email?.toLowerCase() === lower)) {
        return NextResponse.json(
          { error: "An account with this email already exists. Try signing in instead." },
          { status: 409 }
        );
      }
      if (data.users.length < 1000) break;
      page++;
    }

    // 1. Create auth user (auto-confirm to suppress Supabase's email).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message || "Failed to create account." },
        { status: 500 }
      );
    }
    const authUserId = created.user.id;

    // 2. Create firm. Roll back auth user on failure.
    const { data: firm, error: firmErr } = await supabaseAdmin
      .from("firms")
      .insert([{ name: firmName, created_via_self_serve: true }])
      .select("id")
      .single();
    if (firmErr || !firm) {
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
      return NextResponse.json(
        { error: firmErr?.message || "Failed to create firm." },
        { status: 500 }
      );
    }

    // 3. Create firm_users row. Roll back firm + auth user on failure.
    const { error: fuErr } = await supabaseAdmin
      .from("firm_users")
      .insert([{
        firm_id: firm.id,
        auth_user_id: authUserId,
        role: "firm_admin",
        full_name: fullName,
        email_verified_at: null,
      }]);
    if (fuErr) {
      try { await supabaseAdmin.from("firms").delete().eq("id", firm.id); } catch {}
      try { await supabaseAdmin.auth.admin.deleteUser(authUserId); } catch {}
      return NextResponse.json(
        { error: fuErr.message || "Failed to link user to firm." },
        { status: 500 }
      );
    }

    // 4. Issue verification token + send branded email.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error: tokenErr } = await supabaseAdmin
      .from("email_verifications")
      .insert([{ auth_user_id: authUserId, token, expires_at: expiresAt }]);
    if (tokenErr) {
      // The user account is fine — they can use Resend from the banner.
      console.error("[signup] Failed to insert verification token:", tokenErr);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    try {
      await sendVerifyEmail(email, fullName, verifyUrl);
    } catch (emailErr) {
      const msg = (emailErr as { message?: string })?.message || String(emailErr);
      console.error("[signup] Failed to send verification email:", msg);
      // Account is created; user can resend from the banner. Don't fail
      // the request.
    }

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("[signup] Unexpected error:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
