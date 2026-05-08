/**
 * POST /api/seed-demo-data
 *
 * Authenticated endpoint that idempotently seeds the firm with demo
 * data (3 clients, 1 placeholder accountant if caller is firm_admin,
 * 15 receipts, [Demo] folder).
 *
 * Called from the FirstLoginTour when the user opts into the tour.
 * Skipping the tour means this never runs — no junk in the firm.
 *
 * Re-calling is safe: the seeder bails out early if it sees any
 * existing demo client for the firm.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { seedDemoData } from "@/lib/demoData";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  // Defence in depth: this endpoint creates demo data and is only ever
  // intended for staging / dev environments. Disable in prod unless the
  // operator explicitly opts in by setting DEMO_SEEDS_ENABLED=true.
  if (process.env.DEMO_SEEDS_ENABLED !== "true") {
    return NextResponse.json({ error: "Demo seeds are disabled" }, { status: 404 });
  }

  try {
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

    // Caller's firm_user record — gives us firm_id, role, and the
    // firm_users.id we'll assign demo clients to (when caller is an
    // accountant; firm_admins delegate to the placeholder demo
    // accountant).
    const { data: fu, error: fuErr } = await supabaseAdmin
      .from("firm_users")
      .select("id, firm_id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (fuErr || !fu) {
      return NextResponse.json({ error: "User has no firm." }, { status: 403 });
    }

    if (fu.role !== "firm_admin" && fu.role !== "accountant") {
      // Owners and clients don't need demo seeding (owner = founder; clients
      // get the existing onboarding instead).
      return NextResponse.json({ error: "Demo seeding not available for this role." }, { status: 403 });
    }

    const result = await seedDemoData(fu.firm_id, fu.role, fu.id, supabaseAdmin);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[seed-demo-data] unexpected:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
