"use client";

// components/SidebarReportsPicker.tsx
//
// Modal picker for choosing which tax reports the user wants pinned to
// their sidebar. Used in two contexts:
//   • First-time visit to /dashboard/reports (no prefs saved yet)
//   • Manual "Customize sidebar" button on the reports hub
//
// Saves to user_preferences.sidebar_reports.

import { useEffect, useState } from "react";
import {
  ALL_REPORT_KEYS,
  REPORT_META,
  DEFAULT_PINNED,
  saveSidebarReportsPrefs,
  type SidebarReportKey,
} from "@/lib/sidebarReportsPrefs";

export default function SidebarReportsPicker({
  initial,
  isFirstTime,
  onClose,
  onSaved,
}: {
  initial: SidebarReportKey[] | null;
  isFirstTime: boolean;
  onClose: () => void;
  onSaved: (keys: SidebarReportKey[]) => void;
}) {
  const [selected, setSelected] = useState<Set<SidebarReportKey>>(
    new Set(initial ?? DEFAULT_PINNED)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Lock body scroll while the modal is open.
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function toggle(key: SidebarReportKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      const keys = ALL_REPORT_KEYS.filter(k => selected.has(k));
      await saveSidebarReportsPrefs(keys);
      onSaved(keys);
    } catch (err: any) {
      setError(err.message || "Couldn't save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {isFirstTime ? "Pick your tax reports 🧾" : "Customize sidebar"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            {isFirstTime
              ? "Choose which reports you want pinned to your sidebar. You can change this anytime from the Reports page."
              : "Choose which reports show up in your sidebar."}
          </p>

          <div className="space-y-2">
            {ALL_REPORT_KEYS.map(k => {
              const m = REPORT_META[k];
              const isOn = selected.has(k);
              return (
                <label
                  key={k}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isOn
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                      : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg hover:border-accent-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(k)}
                    className="mt-1 accent-accent-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

          <div className="flex items-center justify-end gap-2 mt-6">
            {!isFirstTime && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving…" : isFirstTime ? "Save & continue" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
