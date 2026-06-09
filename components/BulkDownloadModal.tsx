"use client";

// components/BulkDownloadModal.tsx
//
// Modal for bulk-downloading receipt images as a ZIP. Two modes:
//
//   • "preset/range" — pick a preset (This week / Last month / etc.) or
//     enter a custom date range. The server returns every receipt with
//     an image inside that window.
//
//   • "selected" — when the parent already has a Set<string> of
//     receipt IDs (from the per-row checkboxes on the receipts page),
//     it passes them in and the modal skips the date pickers entirely.
//
// The server caps at 500 receipts per request — if the user picks "All
// time" on a heavy account we surface a friendly error from the route.

import { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type Preset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_fiscal_year"
  | "all_time"
  | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "this_fiscal_year", label: "This fiscal year" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom range" },
];

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Resolve the preset into { startDate, endDate } strings the server
// understands. Fiscal year defaults to calendar (Jan 1 – Dec 31). The
// custom case returns the user's input as-is.
function resolveRange(p: Preset, customFrom: string, customTo: string): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  switch (p) {
    case "this_week": {
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0,0,0,0);
      return { startDate: isoDate(start), endDate: isoDate(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const endLast = new Date(now); endLast.setDate(now.getDate() - day - 1); endLast.setHours(0,0,0,0);
      const startLast = new Date(endLast); startLast.setDate(endLast.getDate() - 6);
      return { startDate: isoDate(startLast), endDate: isoDate(endLast) };
    }
    case "this_month":
      return { startDate: isoDate(new Date(y, m, 1)), endDate: isoDate(now) };
    case "last_month": {
      const lastEnd = new Date(y, m, 0);
      const lastStart = new Date(y, m - 1, 1);
      return { startDate: isoDate(lastStart), endDate: isoDate(lastEnd) };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { startDate: isoDate(new Date(y, q * 3, 1)), endDate: isoDate(now) };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3);
      const lastQStart = new Date(y, q * 3 - 3, 1);
      const lastQEnd = new Date(y, q * 3, 0);
      return { startDate: isoDate(lastQStart), endDate: isoDate(lastQEnd) };
    }
    case "this_fiscal_year":
      // Calendar year default. If the user has a fiscal-year-ending
      // month set on their client record we honor it on the per-client
      // monthly report, but here we keep things predictable for ZIPs.
      return { startDate: isoDate(new Date(y, 0, 1)), endDate: isoDate(now) };
    case "all_time":
      return { startDate: null, endDate: null };
    case "custom":
      return { startDate: customFrom || null, endDate: customTo || null };
  }
}

type Props = {
  onClose: () => void;
  // Optional pinned client scope; when null the server returns receipts
  // across every client the requesting user has access to.
  clientId?: string | null;
  // When provided, the modal goes into "selected" mode and skips the
  // date pickers. Parent (e.g. the receipts list) passes the current
  // checkbox selection.
  selectedReceiptIds?: string[];
};

export default function BulkDownloadModal({ onClose, clientId, selectedReceiptIds }: Props) {
  const selectionMode = Array.isArray(selectedReceiptIds) && selectedReceiptIds.length > 0;
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // ESC to close, browser-standard for modals.
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    setError("");
    setDownloading(true);
    try {
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Your session expired. Sign in again."); return; }

      const payload: any = { firmId, clientId: clientId || null };
      if (selectionMode) {
        payload.receiptIds = selectedReceiptIds;
      } else {
        const range = resolveRange(preset, customFrom, customTo);
        if (preset === "custom" && !range.startDate && !range.endDate) {
          setError("Pick a custom date range or choose a preset.");
          return;
        }
        payload.startDate = range.startDate;
        payload.endDate = range.endDate;
      }

      const res = await fetch("/api/receipts/download-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // 404 specifically means "nothing in range" — surface a nicer message.
        if (res.status === 404) {
          setError("No receipts with images in that window.");
        } else {
          const text = await res.text();
          let msg = text;
          try { msg = JSON.parse(text).error || text; } catch {}
          setError(msg || `Download failed (HTTP ${res.status})`);
        }
        return;
      }
      const included = res.headers.get("X-Receipts-Included");
      const failed = res.headers.get("X-Receipts-Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dlName = (res.headers.get("Content-Disposition") || "")
        .match(/filename="?([^";]+)"?/)?.[1] || "Receipts.zip";
      const a = document.createElement("a");
      a.href = url; a.download = dlName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      // Soft success notice if any files failed mid-batch — most users
      // will see "0 failed", which is the silent-success case.
      if (failed && Number(failed) > 0) {
        alert(`Downloaded ${included} receipts. ${failed} failed (likely missing images) — see browser console.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {selectionMode ? `Download ${selectedReceiptIds!.length} receipts` : "Download receipt images"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {selectionMode ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-200">
              We&apos;ll bundle the {selectedReceiptIds!.length} receipt
              {selectedReceiptIds!.length === 1 ? "" : "s"} you selected into
              a single .zip file. Files are named
              <code className="px-1 mx-1 bg-blue-100 dark:bg-blue-900/40 rounded text-[11px]">
                YYYY-MM-DD_Vendor_$Total.jpg
              </code>
              so they sort by date.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date range
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as Preset)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  {PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {preset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maximum 500 receipts per download. PDFs and HEIC files are
                included alongside JPGs and PNGs. Files are named so they
                sort by receipt date.
              </p>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Building ZIP…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download .zip
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
