// lib/getFirmId.ts
import { supabase } from "./supabaseClient";

export async function getMyFirmId(): Promise<string> {
  console.log("🔍 Step 1: Getting session...");
  
  // First verify we have a session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  console.log("📊 Session result:", { 
    hasSession: !!session, 
    userId: session?.user?.id,
    sessionError 
  });

  if (!session) {
    console.error("❌ No session found");
    throw new Error("Not authenticated - no session");
  }

  const user = session.user;

  if (!user) {
    console.error("❌ No user in session");
    throw new Error("Not authenticated - no user");
  }

  console.log("🔍 Step 2: Querying firm_users for auth_user_id:", user.id);

  const { data: firmUser, error } = await supabase
    .from("firm_users")
    .select("firm_id, id, role")
    .eq("auth_user_id", user.id)
    .single();

  console.log("📊 Query result:", { 
    firmUser, 
    error,
    errorDetails: error ? JSON.stringify(error) : null
  });

  if (error) {
    console.error("❌ Query error:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!firmUser) {
    console.error("❌ No firm_user record found for user:", user.id);
    throw new Error("No firm found for user");
  }

  console.log("✅ Found firm:", firmUser.firm_id);
  return firmUser.firm_id;
}

export async function getMyClientId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return null;
  }

  const { data: firmUser } = await supabase
    .from("firm_users")
    .select("client_id")
    .eq("auth_user_id", session.user.id)
    .single();

  return firmUser?.client_id || null;
}
