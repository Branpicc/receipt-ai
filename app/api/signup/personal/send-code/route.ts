/**
 * POST /api/signup/personal/send-code
 *
 * First step of personal-account signup. Validates the email + phone
 * combination and texts a 6-digit verification code to the phone via
 * Twilio. We DO NOT create any account here — the auth user, firm,
 * and client rows only get created after the code is verified.
 *
 * Anti-abuse:
 *   • disposable email domains are rejected outright (see lib/
 *     disposableEmailDomains.ts)
 *   • one verified phone number per signup (firms.signup_phone has a
 *     unique index). We pre-check here so the user gets a clear error
 *     before they waste an SMS.
 *   • rate limit: max 5 codes sent per phone per hour.
 *
 * Code TTL: 10 minutes. Stored in phone_verifications with the code,
 * attempt counter, and expiry.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { twilioClient, TWILIO_FROM, formatPhone } from "@/lib/twilio";
import { isDisposableEmail } from "@/lib/disposableEmailDomains";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MIN = 10;
const MAX_CODES_PER_HOUR = 5;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email: string = (body.email || "").trim().toLowerCase();
    const phoneRaw: string = (body.phone || "").trim();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Sorry — disposable / temporary email addresses aren't allowed for signup. Please use a real address." },
        { status: 400 }
      );
    }

    if (!phoneRaw) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }
    const phone = formatPhone(phoneRaw);
    // Sanity-check the E.164 result. formatPhone won't reject malformed
    // input, so verify here.
    if (!/^\+\d{10,15}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number (Canada or US)." }, { status: 400 });
    }

    // Has this phone already been used for a personal trial?
    const { data: existingFirm } = await supabaseAdmin
      .from("firms")
      .select("id")
      .eq("signup_phone", phone)
      .maybeSingle();
    if (existingFirm) {
      return NextResponse.json(
        { error: "This phone number is already linked to an existing Receipture account. Sign in instead, or use a different number." },
        { status: 409 }
      );
    }

    // Has this email already been used?
    let page = 1;
    while (page < 50) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      if (!data.users || data.users.length === 0) break;
      if (data.users.some(u => u.email?.toLowerCase() === email)) {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in instead." },
          { status: 409 }
        );
      }
      if (data.users.length < 1000) break;
      page++;
    }

    // Rate-limit: max 5 codes sent per phone per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("phone_verifications")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneHourAgo);
    if ((recentCount || 0) >= MAX_CODES_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many verification codes sent recently. Please wait an hour or contact support." },
        { status: 429 }
      );
    }

    // Generate + store the code. expires_at is 10 minutes out.
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();
    const { error: insertErr } = await supabaseAdmin
      .from("phone_verifications")
      .insert({ phone, code, expires_at: expiresAt });
    if (insertErr) {
      console.error("[send-code] Failed to store code:", insertErr);
      return NextResponse.json({ error: "Could not store verification code. Try again." }, { status: 500 });
    }

    // Send the SMS. We don't block the response on this — the user
    // sees "code sent, enter it below" while Twilio dispatches.
    try {
      await twilioClient.messages.create({
        from: TWILIO_FROM,
        to: phone,
        body: `Your Receipture verification code is ${code}. It expires in ${CODE_TTL_MIN} minutes. Do not share this code.`,
      });
    } catch (smsErr) {
      console.error("[send-code] Twilio send failed:", smsErr);
      return NextResponse.json({ error: "Could not send SMS. Check the phone number and try again." }, { status: 502 });
    }

    return NextResponse.json({ success: true, phone });
  } catch (err) {
    console.error("[send-code] Unexpected error:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
