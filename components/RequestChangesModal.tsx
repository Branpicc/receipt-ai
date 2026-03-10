"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type Accountant = {
  id: string;
  auth_user_id: string;
  email: string;
};

type RequestChangesModalProps = {
  receiptId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RequestChangesModal({
  receiptId,
  onClose,
  onSuccess,
}: RequestChangesModalProps) {
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccountants();
  }, []);

  async function loadAccountants() {
    try {
      const firmId = await getMyFirmId();

      const { data, error } = await supabase
        .from("firm_users")
        .select("id, auth_user_id, role")
        .eq("firm_id", firmId)
        .in("role", ["accountant", "firm_admin", "owner"]); // Include firm_admin and owner

      if (error) throw error;

      // Use auth_user_id as placeholder email
      const accountantsWithEmail = (data || []).map((acc) => ({
        ...acc,
        email: acc.auth_user_id,
      }));

      setAccountants(accountantsWithEmail as Accountant[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedAccountant) {
      setError("Please select an accountant");
      return;
    }

    if (!message.trim()) {
      setError("Please enter a message describing the changes needed");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the firm_user id for the current user
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (!firmUser) throw new Error("Firm user not found");

      // Create the approval request
      const { error: insertError } = await supabase
        .from("approval_requests")
        .insert([
          {
            firm_id: firmId,
            receipt_id: receiptId,
            requested_by: firmUser.id,
            assigned_to: selectedAccountant,
            request_type: "edit",
            message: message.trim(),
            status: "pending",
          },
        ]);

      if (insertError) throw insertError;

      // Create notification for the accountant
      await supabase.from("notifications").insert([
        {
          firm_id: firmId,
          type: "approval_request",
          title: "Changes requested",
          message: `Firm admin requested changes: ${message.substring(0, 50)}...`,
          receipt_id: receiptId,
          read: false,
        },
      ]);

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full p-6 border border-transparent dark:border-dark-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Request Changes
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading accountants...</p>
        ) : accountants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No accountants available. Add accountants to your team first.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign to Accountant
              </label>
              <select
                value={selectedAccountant}
                onChange={(e) => setSelectedAccountant(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                required
              >
                <option value="">Select an accountant...</option>
                {accountants.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What changes are needed?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Please update the category to Office Supplies and verify the vendor name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white resize-none"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 font-medium transition-colors"
              >
                {submitting ? "Sending..." : "Send Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}