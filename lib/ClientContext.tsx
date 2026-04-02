"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

export type ClientOption = {
  id: string;
  name: string;
  email_alias: string | null;
  assigned_accountant_id: string | null;
  // Badge counts
  total_receipts: number;
  uncategorized: number;
  flagged: number;
  pending_review: number;
};

type ClientContextType = {
  selectedClient: ClientOption | null;
  setSelectedClient: (client: ClientOption | null) => void;
  clients: ClientOption[];
  loadingClients: boolean;
  refreshClients: () => Promise<void>;
  isFiltered: boolean;
};

const ClientContext = createContext<ClientContextType>({
  selectedClient: null,
  setSelectedClient: () => {},
  clients: [],
  loadingClients: false,
  refreshClients: async () => {},
  isFiltered: false,
});

export function ClientProvider({ children, userRole }: { children: ReactNode; userRole: string | null }) {
  const [selectedClient, setSelectedClientState] = useState<ClientOption | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const isAccountantOrAdmin = userRole === "accountant" || userRole === "firm_admin" || userRole === "owner";

  useEffect(() => {
    if (isAccountantOrAdmin) {
      loadClients();
    }
  }, [userRole]);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const firmId = await getMyFirmId();

const { data: { user } } = await supabase.auth.getUser();
const { data: firmUser } = await supabase
  .from("firm_users")
  .select("id, role")
  .eq("auth_user_id", user?.id)
  .single();

let clientQuery = supabase
  .from("clients")
  .select("id, name, email_alias, assigned_accountant_id")
  .eq("firm_id", firmId)
  .eq("is_active", true)
  .order("name", { ascending: true });

// Accountants only see their assigned clients
if (firmUser?.role === "accountant") {
  clientQuery = clientQuery.eq("assigned_accountant_id", firmUser.id);
}

const { data: clientsData, error } = await clientQuery;

      if (error) throw error;

      // Load badge counts for each client in parallel
      const withCounts = await Promise.all(
        (clientsData || []).map(async (client) => {
          // Total receipts
          const { count: total } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .eq("client_id", client.id);

          // Uncategorized
          const { count: uncategorized } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .eq("client_id", client.id)
            .is("approved_category", null);

          // Flagged
          const { data: flags } = await supabase
            .from("receipt_flags")
            .select("receipt_id")
            .eq("firm_id", firmId)
            .is("resolved_at", null);

          // Get receipt IDs for this client to cross-reference flags
          const { data: clientReceipts } = await supabase
            .from("receipts")
            .select("id")
            .eq("firm_id", firmId)
            .eq("client_id", client.id);

          const clientReceiptIds = new Set(clientReceipts?.map(r => r.id) || []);
          const flaggedCount = flags?.filter(f => clientReceiptIds.has(f.receipt_id)).length || 0;

          // Pending review
          const { count: pending } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .eq("client_id", client.id)
            .is("approved_category", null)
            .not("suggested_category", "is", null);

          return {
            ...client,
            total_receipts: total || 0,
            uncategorized: uncategorized || 0,
            flagged: flaggedCount,
            pending_review: pending || 0,
          };
        })
      );

      // Sort by most activity first (flagged + uncategorized + total_receipts)
      const sorted = withCounts.sort((a, b) => {
        const aScore = (a.flagged * 3) + (a.uncategorized * 2) + a.total_receipts;
        const bScore = (b.flagged * 3) + (b.uncategorized * 2) + b.total_receipts;
        return bScore - aScore;
      });

      setClients(sorted);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoadingClients(false);
    }
  }

  function setSelectedClient(client: ClientOption | null) {
    setSelectedClientState(client);
  }

  return (
    <ClientContext.Provider
      value={{
        selectedClient,
        setSelectedClient,
        clients,
        loadingClients,
        refreshClients: loadClients,
        isFiltered: selectedClient !== null,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  return useContext(ClientContext);
}