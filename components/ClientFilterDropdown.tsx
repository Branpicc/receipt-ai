"use client";

import { useClientContext } from "@/lib/ClientContext";

/**
 * Page-level client filter using the global ClientContext.
 *
 * Renders nothing if `clients` is empty (e.g., for the `client` role,
 * which has no clients list of its own). For accountants the list is
 * already scoped to their assigned clients by ClientContext, so they
 * can only see/filter their own.
 */
export default function ClientFilterDropdown() {
  const { selectedClient, setSelectedClient, clients } = useClientContext();

  if (clients.length === 0) return null;

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 mb-6 border border-transparent dark:border-dark-border">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Client
      </label>
      <select
        value={selectedClient?.id || ""}
        onChange={(e) => {
          const c = clients.find(cl => cl.id === e.target.value);
          setSelectedClient(c || null);
        }}
        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
      >
        <option value="">All clients</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
