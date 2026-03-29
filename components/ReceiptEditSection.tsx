"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ReceiptEditProps = {
  receipt: {
    id: string;
    firm_id: string;
    vendor: string | null;
    receipt_date: string | null;
    total_cents: number | null;
  };
  taxes: {
    id: string;
    tax_type: string;
    rate: number | null;
    amount_cents: number | null;
  }[];
  onSaved: () => void;
};

const EDIT_REASONS = [
  "Vendor name wasn't right",
  "Total amount was wrong",
  "Tax didn't parse correctly",
  "Subtotal was incorrect",
  "Receipt date was wrong",
  "Other",
];

export default function ReceiptEditSection({ receipt, taxes, onSaved }: ReceiptEditProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [pendingChanges, setPendingChanges] = useState<any>(null);

  // Editable fields
  const [vendor, setVendor] = useState(receipt.vendor || "");
  const [receiptDate, setReceiptDate] = useState(receipt.receipt_date || "");
  const [totalDollars, setTotalDollars] = useState(
    receipt.total_cents ? (receipt.total_cents / 100).toFixed(2) : ""
  );
  const [taxAmount, setTaxAmount] = useState(
    taxes[0]?.amount_cents ? (taxes[0].amount_cents / 100).toFixed(2) : ""
  );
  const [taxType, setTaxType] = useState(taxes[0]?.tax_type || "HST");

  function getChanges() {
    const changes: Record<string, { before: any; after: any }> = {};

    if (vendor !== (receipt.vendor || "")) {
      changes.vendor = { before: receipt.vendor || "", after: vendor };
    }
    if (receiptDate !== (receipt.receipt_date || "")) {
      changes.receipt_date = { before: receipt.receipt_date || "", after: receiptDate };
    }
    const newTotalCents = Math.round(parseFloat(totalDollars || "0") * 100);
    if (newTotalCents !== (receipt.total_cents || 0)) {
      changes.total = {
        before: `$${((receipt.total_cents || 0) / 100).toFixed(2)}`,
        after: `$${(newTotalCents / 100).toFixed(2)}`,
      };
    }
    const newTaxCents = Math.round(parseFloat(taxAmount || "0") * 100);
    const oldTaxCents = taxes[0]?.amount_cents || 0;
    if (newTaxCents !== oldTaxCents) {
      changes.tax = {
        before: `$${(oldTaxCents / 100).toFixed(2)} (${taxes[0]?.tax_type || "HST"})`,
        after: `$${(newTaxCents / 100).toFixed(2)} (${taxType})`,
      };
    }

    return changes;
  }

  function handleSaveClick() {
    const changes = getChanges();
    if (Object.keys(changes).length === 0) {
      alert("No changes detected.");
      return;
    }
    setPendingChanges(changes);
    setShowReasonModal(true);
  }

  async function confirmSave() {
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (!reason.trim()) {
      alert("Please provide a reason for the changes.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      const newTotalCents = Math.round(parseFloat(totalDollars || "0") * 100);
      const newTaxCents = Math.round(parseFloat(taxAmount || "0") * 100);

      // Update receipt
      const { error: updateError } = await supabase
        .from("receipts")
        .update({
          vendor: vendor || null,
          receipt_date: receiptDate || null,
          total_cents: newTotalCents,
        })
        .eq("id", receipt.id);

      if (updateError) throw updateError;

      // Update tax
      if (taxes.length > 0) {
        await supabase
          .from("receipt_taxes")
          .update({ amount_cents: newTaxCents, tax_type: taxType })
          .eq("receipt_id", receipt.id);
      } else if (newTaxCents > 0) {
        await supabase
          .from("receipt_taxes")
          .insert({
            receipt_id: receipt.id,
            firm_id: receipt.firm_id,
            tax_type: taxType,
            rate: taxType === "HST" ? 0.13 : 0.05,
            amount_cents: newTaxCents,
          });
      }

      // Save edit record
      await supabase.from("receipt_edits").insert({
        receipt_id: receipt.id,
        firm_id: receipt.firm_id,
        edited_by: firmUser?.id,
        edit_reason: reason,
        changes: pendingChanges,
      });

      // Build notification message with before/after
      const changeLines = Object.entries(pendingChanges).map(
        ([field, val]: [string, any]) =>
          `• ${field}: "${val.before}" → "${val.after}"`
      );

      // Notify all firm users
      const { data: firmUsers } = await supabase
        .from("firm_users")
        .select("auth_user_id")
        .eq("firm_id", receipt.firm_id)
        .neq("auth_user_id", user.id);

      if (firmUsers && firmUsers.length > 0) {
        await supabase.from("notifications").insert(
          firmUsers.map((fu) => ({
            firm_id: receipt.firm_id,
            user_id: fu.auth_user_id,
            type: "receipt_uploaded",
            title: "Receipt details edited",
            message: `Changes made to ${vendor || "receipt"} — Reason: "${reason}"\n${changeLines.join("\n")}`,
            receipt_id: receipt.id,
            read: false,
          }))
        );
      }

      setShowReasonModal(false);
      setExpanded(false);
      setPendingChanges(null);
      setSelectedReason("");
      setCustomReason("");
      alert("✅ Changes saved successfully!");
      onSaved();
    } catch (err: any) {
      alert("Failed to save changes: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
      >
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ✏️ Didn't capture right? Edit details
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Fix vendor name, date, total, or tax if the scan missed something
          </p>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-sm">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-gray-200 dark:border-dark-border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Vendor Name
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Staples"
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Receipt Date
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>

            {/* Total */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Total Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={totalDollars}
                onChange={(e) => setTotalDollars(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>

            {/* Tax */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tax Amount ($)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  <option value="HST">HST</option>
                  <option value="GST">GST</option>
                  <option value="PST">PST</option>
                  <option value="QST">QST</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reason Modal */}
      {showReasonModal && pendingChanges && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Why are you making these changes?
            </h2>

            {/* Show before/after */}
            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 mb-4 space-y-1">
              {Object.entries(pendingChanges).map(([field, val]: [string, any]) => (
                <div key={field} className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-medium capitalize">{field.replace("_", " ")}:</span>{" "}
                  <span className="text-red-500 line-through">{val.before}</span>{" "}
                  <span className="text-green-600">→ {val.after}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-4">
              {EDIT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    selectedReason === reason
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300"
                      : "border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            {selectedReason === "Other" && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason for changes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white mb-4"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedReason("");
                  setCustomReason("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover"
              >
                Back
              </button>
              <button
                onClick={confirmSave}
                disabled={saving || !selectedReason || (selectedReason === "Other" && !customReason.trim())}
                className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Confirm Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}