"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { Trash2 } from "lucide-react";

type Props = {
  receiptId: string;
  clientId: string;
  vendor: string | null;
  date: string | null;
  totalCents: number | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RequestDeletionModal({
  receiptId,
  clientId,
  vendor,
  date,
  totalCents,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const MIN_REASON = 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setError(`Please give at least ${MIN_REASON} characters of context so the accountant can review.`);
      return;
    }
    try {
      setSubmitting(true);
      setError("");

      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("deletion_requests")
        .insert([{
          receipt_id: receiptId,
          firm_id: firmId,
          client_id: clientId,
          requested_by: user.id,
          reason: reason.trim(),
          receipt_vendor: vendor,
          receipt_date: date,
          receipt_total_cents: totalCents,
        }]);
      if (insertError) throw insertError;

      onSuccess();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ||
        (typeof err === "string" ? err : "Failed to submit request");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const totalText = totalCents != null ? `$${(totalCents / 100).toFixed(2)}` : "—";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full p-6 border border-transparent dark:border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Request deletion
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-sm">
          <div className="font-medium text-gray-900 dark:text-white">{vendor || "Unknown vendor"}</div>
          <div className="text-gray-500 dark:text-gray-400">
            {date || "—"} • {totalText}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          An accountant has to approve deletions for audit consistency. Tell them why this receipt should be removed —
          duplicates, wrong upload, personal expense, etc.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Duplicate of the Tim Hortons receipt I uploaded earlier today…"
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white resize-none"
              required
              autoFocus
            />
            <div className="text-xs text-gray-400 mt-1">
              {reason.trim().length}/{MIN_REASON} min
            </div>
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
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium transition-colors"
            >
              {submitting ? "Sending…" : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
