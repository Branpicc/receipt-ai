"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type Props = {
  onClose: () => void;
  onSuccess: (inviteUrl: string, email: string) => void;
  userRole: string;
};

type Accountant = {
  id: string;
  display_name: string | null;
  auth_user_id: string;
};

type Client = {
  id: string;
  name: string;
};

export default function ImprovedInviteModal({ onClose, onSuccess, userRole }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"accountant" | "client">("client");
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState("");
  const [clientOption, setClientOption] = useState<"existing" | "new" | "later">("existing");
  const [selectedClient, setSelectedClient] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [businessType, setBusinessType] = useState<"corporation" | "sole_proprietorship" | "partnership" | "other">("corporation");
  const [inviting, setInviting] = useState(false);

  const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";
  const isAccountant = userRole === "accountant";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const firmId = await getMyFirmId();

      // Load accountants
      const { data: accountantsData } = await supabase
        .from("firm_users")
        .select("id, display_name, auth_user_id")
        .eq("firm_id", firmId)
        .eq("role", "accountant");

      setAccountants(accountantsData || []);

      // If accountant, auto-select self
      if (isAccountant && accountantsData) {
        const { data: { user } } = await supabase.auth.getUser();
        const self = accountantsData.find(a => a.auth_user_id === user?.id);
        if (self) {
          setSelectedAccountant(self.id);
        }
      }

      // Load existing clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", firmId)
        .eq("is_active", true);

      setClients(clientsData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }

  async function handleInvite() {
    if (!email.trim()) {
      alert("Please enter an email address");
      return;
    }

    if (role === "client") {
      if (!isFirmAdmin && !selectedAccountant) {
        alert("Accountant assignment required");
        return;
      }

      if (clientOption === "existing" && !selectedClient) {
        alert("Please select a client company");
        return;
      }

      if (clientOption === "new" && !newClientName.trim()) {
        alert("Please enter a client company name");
        return;
      }
    }

    try {
      setInviting(true);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert("Not authenticated");
        return;
      }

      // Create new client if needed
      let clientId = selectedClient;
      if (role === "client" && clientOption === "new") {
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert({
            firm_id: firmId,
            name: newClientName.trim(),
            business_type: businessType,
            is_active: true,
          })
          .select("id")
          .single();

        if (error) throw error;
        clientId = newClient.id;
      }

      // Send invitation
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
body: JSON.stringify({
  email: email.trim(),
  role: role,
  firmId: firmId,
  clientId: role === "client" && clientOption !== "later" && clientId ? clientId : null,
  assignedAccountantId: role === "client" && selectedAccountant ? selectedAccountant : null,
}),
      });

const result = await response.json();
console.log("API Response:", response.status, result);

if (!response.ok) {
  throw new Error(result.error || "Failed to send invitation");
}
      onSuccess(result.invitation.inviteUrl, email);
    } catch (error: any) {
      console.error("Failed to invite user:", error);
      alert("Failed to send invite: " + error.message);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-transparent dark:border-dark-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Invite Team Member
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("client")}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  role === "client"
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                    : "border-gray-200 dark:border-dark-border"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">Client</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Limited access to their own receipts
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole("accountant")}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  role === "accountant"
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                    : "border-gray-200 dark:border-dark-border"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">Accountant</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Full access to manage clients
                </div>
              </button>
            </div>
          </div>

          {/* Client-specific fields */}
          {role === "client" && (
            <>
              {/* Assign Accountant (Firm Admin Only) */}
              {isFirmAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assign to Accountant
                  </label>
                  <select
                    value={selectedAccountant}
                    onChange={(e) => setSelectedAccountant(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                  >
                    <option value="">Select accountant...</option>
                    {accountants.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.display_name || "Accountant"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Company
                </label>

                <div className="space-y-3">
                  {/* Existing Client */}
                  {clients.length > 0 && (
                    <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover">
                      <input
                        type="radio"
                        name="clientOption"
                        checked={clientOption === "existing"}
                        onChange={() => setClientOption("existing")}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">Select existing client</div>
                        {clientOption === "existing" && (
                          <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
                          >
                            <option value="">Choose a client...</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                  )}

                  {/* New Client */}
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover">
                    <input
                      type="radio"
                      name="clientOption"
                      checked={clientOption === "new"}
                      onChange={() => setClientOption("new")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Create new client</div>
                      {clientOption === "new" && (
                        <div className="space-y-2 mt-2">
                          <input
                            type="text"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="Company name (e.g., Apple Inc.)"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
                          />
                          <select
                            value={businessType}
                            onChange={(e) => setBusinessType(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
                          >
                            <option value="corporation">Corporation (Inc./Ltd.)</option>
                            <option value="sole_proprietorship">Sole Proprietorship</option>
                            <option value="partnership">Partnership</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Client Will Provide */}
                  <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover">
                    <input
                      type="radio"
                      name="clientOption"
                      checked={clientOption === "later"}
                      onChange={() => setClientOption("later")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Client will provide company info</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        They'll enter company details during signup
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="flex-1 px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 font-medium"
          >
            {inviting ? "Sending..." : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}