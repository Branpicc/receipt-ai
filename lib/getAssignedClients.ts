import { supabase } from "./supabaseClient";
import { getUserRole } from "./getUserRole";

/**
 * Return the list of client IDs the current user is allowed to see for a
 * given firm.
 *
 *   - accountant : only the clients explicitly assigned to them
 *   - any other role : null  (caller should treat null as "no restriction")
 *
 * `null` is the sentinel for "show everything" so callers can write:
 *
 *   const ids = await getAssignedClientIds(firmId);
 *   if (ids !== null) query = query.in("client_id", ids);
 *
 * If the lookup itself fails or returns no clients for an accountant,
 * an empty array is returned — caller should short-circuit to "no rows".
 */
export async function getAssignedClientIds(firmId: string): Promise<string[] | null> {
  const role = await getUserRole();
  if (role !== "accountant") return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: firmUser } = await supabase
    .from("firm_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("firm_id", firmId)
    .single();

  if (!firmUser?.id) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("firm_id", firmId)
    .eq("assigned_accountant_id", firmUser.id);

  return (clients || []).map(c => c.id);
}
