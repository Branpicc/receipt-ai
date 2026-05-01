/**
 * POST /api/clear-demo-data
 *
 * Wipes every is_demo=true row in the caller's firm. Bound to the
 * firm_admin role — owners and accountants don't get the cleanup
 * button in this MVP (firm_admin owns demo lifecycle).
 *
 * Cascade does most of the work via the receipts FK; the helper also
 * removes the placeholder demo accountant's auth.users row so we
 * don't leak orphaned auth users.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clearDemoData } from "@/lib/demoData";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
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

    const { data: fu, error: fuErr } = await supabaseAdmin
      .from("firm_users")
      .select("firm_id, role")
      .eq("auth_user_id", userResp.user.id)
      .maybeSingle();
    if (fuErr || !fu) {
      return NextResponse.json({ error: "User has no firm." }, { status: 403 });
    }

    if (fu.role !== "firm_admin" && fu.role !== "owner") {
      return NextResponse.json(
        { error: "Only the firm admin or owner can clear demo data." },
        { status: 403 }
      );
    }

    await clearDemoData(fu.firm_id, supabaseAdmin);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[clear-demo-data] unexpected:", err);
    const msg = (err as { message?: string })?.message || "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
