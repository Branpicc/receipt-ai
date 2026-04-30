"use client";

import { useEffect, useRef, useState } from "react";
import { TAX_CATEGORIES } from "@/lib/taxCategories";

/**
 * Combobox-style category picker. Type to filter, click to select.
 * Designed for the receipt detail page where the previous UX was
 * `prompt("Enter category name:")` — typo-prone and unbounded.
 *
 * `initial` pre-fills the search box with the existing category if any.
 * Calls `onSelect` with the chosen canonical category, or `onCancel` if
 * the user dismisses without picking.
 */
export default function CategoryPicker({
  initial,
  onSelect,
  onCancel,
}: {
  initial?: string;
  onSelect: (category: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(initial ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const filtered = query.trim() === ""
    ? TAX_CATEGORIES
    : TAX_CATEGORIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg p-3 space-y-2 shadow-md">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && filtered.length > 0) onSelect(filtered[0]);
        }}
        placeholder="Type to filter…"
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
      />
      <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-dark-border">
        {filtered.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-400 px-2 py-2">
            No categories match — try a shorter search
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left text-sm px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-900 dark:text-white"
              >
                {c}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
