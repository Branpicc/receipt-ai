"use client";

// components/ManualReceiptModal.tsx
//
// "Add receipt manually" — for transactions the user didn't get a
// proper receipt for, but knows about from their bank statement. Form
// fields: vendor, date, amount, optional category, optional note,
// optional bank-statement screenshot. POSTs to /api/receipts/manual
// which creates the receipt row + uploads the image to the same
// storage bucket as OCR-extracted receipts.

import { useEffect, useState } from "react";
import { X, Upload, Receipt as ReceiptIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId, getMyClientId } from "@/lib/getFirmId";

type Props = {
  // Optional override — if not passed we resolve from getMyClientId.
  // Used by accountant views where they may be entering on behalf of
  // a specific client.
  clientId?: string;
  onClose: () => void;
  onSaved: (receiptId: string) => void;
};

const COMMON_CATEGORIES = [
  "Meals & Entertainment",
  "Office Expenses",
  "Vehicle Expenses & Fuel",
  "Travel Expenses",
  "Software & Subscriptions",
  "Professional Fees",
  "Supplies",
  "Advertising & Promotion",
  "Utilities",
  "Insurance",
  "Rent & Lease",
  "Other",
];

export default function ManualReceiptModal({ clientId, onClose, onSaved }: Props) {
  const [vendor, setVendor] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  // Three money fields. We auto-compute total from subtotal + tax
  // unless the user has explicitly edited the total field (tracked
  // via totalManuallyEdited). That way the common case ("I have a
  // receipt that shows $42.00 subtotal + $5.46 tax") fills total
  // automatically, but the user can still override (e.g. when they
  // only know the total off the bank statement).
  const [subtotalDollars, setSubtotalDollars] = useState("");
  const [taxDollars, setTaxDollars] = useState("");
  const [totalDollars, setTotalDollars] = useState("");
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-fill total when both subtotal and tax are set and the user
  // hasn't typed in the total field themselves.
  useEffect(() => {
    if (totalManuallyEdited) return;
    const sub = parseFloat(subtotalDollars);
    const tax = parseFloat(taxDollars) || 0;
    if (Number.isFinite(sub) && sub > 0) {
      setTotalDollars((sub + tax).toFixed(2));
    } else if (!subtotalDollars && !taxDollars) {
      // Both cleared — clear total too so we don't strand a stale value.
      setTotalDollars("");
    }
  }, [subtotalDollars, taxDollars, totalManuallyEdited]);

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!vendor.trim()) { setError("Vendor is required."); return; }
    if (!receiptDate) { setError("Date is required."); return; }
    const sub = parseFloat(subtotalDollars);
    const tax = parseFloat(taxDollars);
    const total = parseFloat(totalDollars);
    if (!total || isNaN(total) || total <= 0) { setError("Total must be a positive number."); return; }
    if (subtotalDollars && (isNaN(sub) || sub <= 0)) { setError("Subtotal must be a positive number or left blank."); return; }
    if (taxDollars && (isNaN(tax) || tax < 0)) { setError("Tax must be 0 or higher."); return; }

    setSaving(true);
    try {
      const firmId = await getMyFirmId();
      const resolvedClientId = clientId || (await getMyClientId());
      if (!resolvedClientId) {
        setError("Could not resolve your client profile. Refresh and try again.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Session expired. Sign in again."); return; }

      const formData = new FormData();
      formData.append("firmId", firmId);
      formData.append("clientId", resolvedClientId);
      formData.append("vendor", vendor.trim());
      formData.append("receiptDate", receiptDate);
      formData.append("totalDollars", String(total));
      if (Number.isFinite(sub) && sub > 0) formData.append("subtotalDollars", String(sub));
      if (Number.isFinite(tax) && tax > 0) formData.append("taxDollars", String(tax));
      if (category) formData.append("category", category);
      if (note.trim()) formData.append("note", note.trim());
      if (file) formData.append("file", file);

      const res = await fetch("/api/receipts/manual", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save the receipt.");
        return;
      }
      onSaved(data.receiptId);
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-accent-500" /> Add receipt manually
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 overflow-y-auto max-h-[calc(90vh-60px)] space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              For purchases you don&apos;t have a proper receipt for. Enter what
              you know from your bank statement — optionally attach a screenshot
              as supporting evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Starbucks · Esso · Air Canada"
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Money block: subtotal + tax auto-compute total. The user
              can override the total directly (e.g. when they only
              know the charged amount off their bank statement) — once
              they touch it, the auto-fill backs off. */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subtotal ($)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={subtotalDollars}
                  onChange={(e) => setSubtotalDollars(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tax ($)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={taxDollars}
                  onChange={(e) => setTaxDollars(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total ($) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={totalDollars}
                  onChange={(e) => { setTotalDollars(e.target.value); setTotalManuallyEdited(true); }}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white font-semibold"
                />
              </div>
            </div>
          </div>
          {!totalManuallyEdited && subtotalDollars && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-2">
              Total auto-fills from subtotal + tax. Edit it to override.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category (optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            >
              <option value="">— Pick a category —</option>
              {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note / purpose (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Coffee with a client on May 14"
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bank statement screenshot (optional)
            </label>
            <label className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg cursor-pointer hover:border-accent-400 transition-colors">
              <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                {file ? file.name : "Tap to attach a screenshot from your bank app"}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Helps the accountant verify the purchase. Stays on your account, never shared.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
