import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, firmId, clientId, assignedAccountantId } = body;

    if (!email || !role || !firmId) {
      return NextResponse.json(
        { error: "Email, role, and firmId are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["accountant", "client", "firm_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be accountant, client, or firm_admin" },
        { status: 400 }
      );
    }

    // Get current user from auth header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Get firm_user id for invited_by
    const { data: firmUser, error: firmUserError } = await supabaseAdmin
      .from("firm_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("firm_id", firmId)
      .single();

    if (firmUserError || !firmUser) {
      return NextResponse.json(
        { error: "User not found in firm" },
        { status: 403 }
      );
    }

    // Check if this email already has an account in this firm
    const { data: existingFirmUsers } = await supabaseAdmin
      .from("firm_users")
      .select("id, auth_user_id")
      .eq("firm_id", firmId);

    if (existingFirmUsers) {
      // Get all auth users for this firm
      const authUserIds = existingFirmUsers.map(u => u.auth_user_id);
      
      // Check if any of these users have the invited email
      // Note: This requires querying auth.users which needs service role
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      
      const emailAlreadyExists = authUsers.users.some(
        authUser => authUser.email?.toLowerCase() === email.toLowerCase() && 
                    authUserIds.includes(authUser.id)
      );

      if (emailAlreadyExists) {
        return NextResponse.json(
          { error: "A user with this email already exists in this firm" },
          { status: 400 }
        );
      }
    }

    // Check for pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id, status")
      .eq("firm_id", firmId)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invitation already exists for this email" },
        { status: 400 }
      );
    }

    // Generate unique token
    const inviteToken = crypto.randomBytes(32).toString("hex");

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert([
        {
          firm_id: firmId,
          email: email.toLowerCase(),
          role: role,
          token: inviteToken,
          invited_by: firmUser.id,
          expires_at: expiresAt.toISOString(),
          status: "pending",
          client_id: role === "client" ? clientId : null,
          assigned_accountant_id: role === "client" ? assignedAccountantId : null,
        },
      ])
      .select()
      .single();

    if (inviteError) {
      console.error("Failed to create invitation:", inviteError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Get firm name for email
    const { data: firm } = await supabaseAdmin
      .from("firms")
      .select("name")
      .eq("id", firmId)
      .single();

    const firmName = firm?.name || "the firm";

    // Build invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/accept-invite/${inviteToken}`;

// TODO: Re-enable email sending when SendGrid production account is ready
// SendGrid free tier has strict rate limits causing failures
console.log('📧 Email sending temporarily disabled');
console.log('✅ Invitation created successfully');
console.log('📎 Share this link with the user:', inviteUrl);

return NextResponse.json({
  success: true,
  invitation: {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    inviteUrl: inviteUrl,
  },
});
  } catch (error: any) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}