/**
 * Consume an email verification token.
 *
 * Public endpoint — token is the proof. We look it up, ensure it hasn't
 * expired or been consumed, then set firm_users.email_verified_at and
 * mark the token consumed. Idempotent on the user side: hitting verify
 * twice returns success the second time as long as the token is fresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const { data: row, error: lookupErr } = await supabaseAdmin
      .from("email_verifications")
      .select("id, auth_user_id, expires_at, consumed_at")
      .eq("token", token)
      .maybeSingle();
    if (lookupErr) {
      console.error("[verify-email] lookup failed:", lookupErr);
      return NextResponse.json({ error: "Verification failed." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { error: "This link isn't valid. It may have already been used or expired." },
        { status: 400 }
      );
    }
    if (row.consumed_at) {
      // Already verified — idempotent success.
      return NextResponse.json({ success: true, alreadyVerified: true });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This link has expired. Sign in and request a new one from the dashboard banner." },
        { status: 400 }
      );
    }

    // Mark verified + token consumed.
    const now = new Date().toISOString();
    const { error: fuErr } = await supabaseAdmin
      .from("firm_users")
      .update({ email_verified_at: now })
      .eq("auth_user_id", row.auth_user_id);
    if (fuErr) {
      console.error("[verify-email] firm_users update failed:", fuErr);
      return NextResponse.json({ error: "Verification failed." }, { status: 500 });
    }
    const { error: tokErr } = await supabaseAdmin
      .from("email_verifications")
      .update({ consumed_at: now })
      .eq("id", row.id);
    if (tokErr) {
      // Non-blocking — verification succeeded; the row just stays
      // unconsumed. The lookup above will catch a replay.
      console.error("[verify-email] token consume failed:", tokErr);
    }

    // Fire-and-forget welcome email. Failures here don't matter.
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.auth_user_id);
      const { data: fu } = await supabaseAdmin
        .from("firm_users")
        .select("full_name, firm_id")
        .eq("auth_user_id", row.auth_user_id)
        .single();
      const firmId = fu?.firm_id;
      const { data: firm } = firmId
        ? await supabaseAdmin.from("firms").select("name").eq("id", firmId).single()
        : { data: null };
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      if (authUser.user?.email && fu?.full_name && firm?.name) {
        await sendWelcomeEmail(authUser.user.email, fu.full_name, firm.name, `${baseUrl}/dashboard`);
      }
    } catch (welcomeErr) {
      console.error("[verify-email] welcome email failed:", welcomeErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[verify-email] unexpected:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
