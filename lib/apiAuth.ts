import { NextRequest, NextResponse } from "next/server";
import { createClient, User } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type FirmRole = "owner" | "firm_admin" | "accountant" | "client";

export type FirmMembership = {
  id: string;
  role: FirmRole;
  client_id: string | null;
};

export type AuthSuccess = {
  ok: true;
  user: User;
  firmUser: FirmMembership;
};

export async function requireFirmMember(
  request: NextRequest,
  firmId: string,
  options?: { roles?: FirmRole[] }
): Promise<AuthSuccess | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
  }

  const { data: firmUser, error: firmUserError } = await supabaseAdmin
    .from("firm_users")
    .select("id, role, client_id")
    .eq("auth_user_id", user.id)
    .eq("firm_id", firmId)
    .single();

  if (firmUserError || !firmUser) {
    return NextResponse.json({ error: "Not a member of this firm" }, { status: 403 });
  }

  const role = firmUser.role as FirmRole;
  if (options?.roles && !options.roles.includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  return {
    ok: true,
    user,
    firmUser: { id: firmUser.id, role, client_id: firmUser.client_id },
  };
}

export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function requireAuthedUser(
  request: NextRequest
): Promise<{ ok: true; user: User } | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
  }
  return { ok: true, user };
}
