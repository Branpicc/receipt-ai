"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createInvitation, getCurrentUser } from "@/lib/auth";

type UserRole = "firm_admin" | "accountant" | "client";

export default function InviteUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("accountant");
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, business_name")
      .order("business_name");

    setClients(data || []);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error("Not authenticated");
      }

      if (role === "client" && !clientId) {
        throw new Error("Please select a client");
      }

      const { invitation, token } = await createInvitation(
        currentUser.firmId,
        email,
        role,
        currentUser.firmUserId,
        role === "client" ? clientId : undefined
      );

      const link = `${window.location.origin}/accept-invitation?token=${token}`;
      setInviteLink(link);
      setSuccess(true);

      // Reset form
      setEmail("");
      setRole("accountant");
      setClientId("");
    } catch (err: any) {
      setError(err.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Invitation link copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Invite new user</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm text-green-800 font-medium">
                  Invitation sent successfully!
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invitation link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Share this link with the user. It expires in 7 days.
              </p>
            </div>

            <button
              onClick={() => {
                setSuccess(false);
                setInviteLink("");
              }}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Invite another user
            </button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="accountant">Accountant</option>
                <option value="firm_admin">Firm Admin</option>
                <option value="client">Client</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {role === "firm_admin" && "Can view metrics and manage users"}
                {role === "accountant" && "Full access to receipts and clients"}
                {role === "client" && "Limited access to their own receipts"}
              </p>
            </div>

            {role === "client" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client account
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.business_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
