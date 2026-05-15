/**
 * POST /api/signup/personal/verify-code
 *
 * Step 2 of the personal-account signup. Confirms the 6-digit SMS code
 * the user just received. On success we return a short-lived
 * verification token that the client passes back to /api/signup/personal
 * to actually create the account.
 *
 * Why a token instead of just trusting the next API call? It keeps the
 * "phone verified" state server-side. The signup endpoint validates the
 * token (still un-expired + not already consumed) before creating the
 * firm row with firms.signup_phone set, so a client can't lie about
 * having verified.
 *
 * Wrong-code lockout: 5 attempts per code. After that the code is
 * burned and the user must request a new one.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatPhone } from "@/lib/twilio";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phoneRaw: string = (body.phone || "").trim();
    const code: string = (body.code || "").trim();

    if (!phoneRaw || !code) {
      return NextResponse.json({ error: "Phone and code are required." }, { status: 400 });
    }
    const phone = formatPhone(phoneRaw);

    // Find the most recent un-verified, un-expired code for this phone.
    const nowIso = new Date().toISOString();
    const { data: rows } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, code, attempts, expires_at, verified_at")
      .eq("phone", phone)
      .is("verified_at", null)
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json(
        { error: "No active code for this phone. Request a new one." },
        { status: 400 }
      );
    }

    // Lockout — after MAX_ATTEMPTS wrong tries the row is unusable.
    if (row.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Request a new code." },
        { status: 429 }
      );
    }

    if (row.code !== code) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return NextResponse.json(
        { error: `Wrong code. ${MAX_ATTEMPTS - row.attempts - 1} attempts left.` },
        { status: 400 }
      );
    }

    // Mark verified. The `id` of this row IS the verification token —
    // /api/signup/personal will look it up and consume it.
    await supabaseAdmin
      .from("phone_verifications")
      .update({ verified_at: nowIso })
      .eq("id", row.id);

    return NextResponse.json({ success: true, verificationToken: row.id });
  } catch (err) {
    console.error("[verify-code] Unexpected error:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
