import { supabase } from "@/lib/supabaseClient";

export async function getMyFirmId(): Promise<string> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("firm_users")
    .select("firm_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.firm_id) throw new Error("No firm membership found");

  return data.firm_id as string;
}
