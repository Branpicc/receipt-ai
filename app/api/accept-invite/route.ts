import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const { token, email, password, displayName } = await request.json();

    if (!token || !email || !password || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

// Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users.some(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: signupError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
    });

    if (signupError) {
      console.error("Signup error:", signupError);
      return NextResponse.json(
        { error: signupError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create client record if needed
    let clientId = invitation.client_id;
    if (invitation.role === "client" && !clientId) {
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from("clients")
        .insert({
          firm_id: invitation.firm_id,
          name: `${displayName.trim()} (Pending)`,
          is_active: true,
          assigned_accountant_id: invitation.assigned_accountant_id,
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("Client creation error:", clientError);
        return NextResponse.json(
          { error: "Failed to create client record" },
          { status: 500 }
        );
      }
      clientId = newClient.id;
    }

    // Create firm_user record
    const { error: firmUserError } = await supabaseAdmin
      .from("firm_users")
      .insert([
        {
          firm_id: invitation.firm_id,
          auth_user_id: authData.user.id,
          role: invitation.role,
          display_name: displayName.trim(),
          client_id: clientId,
        },
      ]);

    if (firmUserError) {
      console.error("Firm user creation error:", firmUserError);
      return NextResponse.json(
        { error: "Failed to join firm" },
        { status: 500 }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Failed to update invitation:", updateError);
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error: any) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}