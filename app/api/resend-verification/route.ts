/**
 * Resend the email verification link to the current authenticated user.
 *
 * Rate-limited: looks up the most recent verification row for this user
 * and rejects if it's < 60s old. The DB column on email_verifications
 * (created_at) is the source of truth — clients can't tamper with it.
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
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Read the user's session from the Authorization header — same pattern
    // as the rest of the app's API routes.
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userResp.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const user = userResp.user;

    // Already verified? Nothing to do.
    const { data: fu } = await supabaseAdmin
      .from("firm_users")
      .select("display_name, email_verified_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (fu?.email_verified_at) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    // Cooldown check.
    const { data: latest } = await supabaseAdmin
      .from("email_verifications")
      .select("created_at")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.created_at) {
      const since = Date.now() - new Date(latest.created_at).getTime();
      if (since < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
        return NextResponse.json(
          { error: `Please wait ${wait}s before requesting another link.` },
          { status: 429 }
        );
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error: insertErr } = await supabaseAdmin
      .from("email_verifications")
      .insert([{ auth_user_id: user.id, token, expires_at: expiresAt }]);
    if (insertErr) {
      console.error("[resend-verification] insert failed:", insertErr);
      return NextResponse.json({ error: "Failed to issue token." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    try {
      await sendVerifyEmail(user.email!, fu?.display_name || "", verifyUrl);
    } catch (emailErr) {
      const msg = (emailErr as { message?: string })?.message || String(emailErr);
      console.error("[resend-verification] send failed:", msg);
      return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[resend-verification] unexpected:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
