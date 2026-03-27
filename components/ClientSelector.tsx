"use client";

import { useState } from "react";
import { useClientContext, ClientOption } from "@/lib/ClientContext";

const MAX_VISIBLE = 7;

function ClientCard({
  client,
  isSelected,
  onClick,
}: {
  client: ClientOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasWork = client.flagged > 0 || client.uncategorized > 0;
  const totalTasks = client.flagged + client.uncategorized;

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 p-4 rounded-xl border-2 text-left transition-all min-w-[160px] max-w-[200px] ${
        isSelected
          ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
          : hasWork
          ? "border-orange-300 dark:border-orange-700 bg-white dark:bg-dark-surface hover:border-accent-400 dark:hover:border-accent-400"
          : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-accent-400 dark:hover:border-accent-400"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isSelected ? "bg-accent-500 text-white" : "bg-gray-200 dark:bg-dark-hover text-gray-700 dark:text-gray-300"
        }`}>
          {client.name.charAt(0).toUpperCase()}
        </div>
        {totalTasks > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full font-bold leading-none">
            {totalTasks}
          </span>
        )}
      </div>
      <div className={`text-sm font-semibold mb-2 truncate ${
        isSelected ? "text-accent-700 dark:text-accent-300" : "text-gray-900 dark:text-white"
      }`}>
        {client.name}
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 rounded">
          {client.total_receipts} receipts
        </span>
        {client.flagged > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
            🚩 {client.flagged}
          </span>
        )}
        {client.uncategorized > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
            ❓ {client.uncategorized}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ClientSelector() {
  const { selectedClient, setSelectedClient, clients, loadingClients, isFiltered } = useClientContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (loadingClients) {
    return (
      <div className="mb-6 p-4 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading clients...</p>
      </div>
    );
  }

  if (clients.length === 0) return null;

  const totalPendingTasks = clients.reduce((sum, c) => sum + c.flagged + c.uncategorized, 0);
  const visibleClients = clients.slice(0, MAX_VISIBLE);
  const overflowClients = clients.slice(MAX_VISIBLE);
  const hasOverflow = overflowClients.length > 0;

  function handleSelect(client: ClientOption) {
    setSelectedClient(selectedClient?.id === client.id ? null : client);
    setDropdownOpen(false);
  }

  return (
    <div className="mb-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Client View
          </h2>
          {isFiltered && (
            <span className="px-2 py-0.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 text-xs rounded-full font-medium">
              Filtered: {selectedClient?.name}
            </span>
          )}
          {!isFiltered && totalPendingTasks > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium">
              {totalPendingTasks} tasks need attention
            </span>
          )}
        </div>
        {isFiltered && (
          <button
            onClick={() => setSelectedClient(null)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors"
          >
            ✕ Clear filter — show all clients
          </button>
        )}
      </div>

      {/* Client cards */}
      <div className="flex gap-3 items-start flex-wrap">
        {visibleClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            isSelected={selectedClient?.id === client.id}
            onClick={() => handleSelect(client)}
          />
        ))}

        {/* Overflow dropdown */}
        {hasOverflow && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`p-4 rounded-xl border-2 text-left transition-all min-w-[160px] ${
                overflowClients.some(c => c.id === selectedClient?.id)
                  ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                  : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-accent-400 dark:hover:border-accent-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  +{overflowClients.length} more
                </span>
                {overflowClients.some(c => c.id === selectedClient?.id) && (
                  <span className="text-xs px-1.5 py-0.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded">
                    Selected
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {dropdownOpen ? "▲ Hide" : "▼ Show all"}
              </span>
              {overflowClients.reduce((sum, c) => sum + c.flagged + c.uncategorized, 0) > 0 && (
                <div className="mt-1">
                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                    ⚠️ {overflowClients.reduce((sum, c) => sum + c.flagged + c.uncategorized, 0)} tasks
                  </span>
                </div>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2 max-h-80 overflow-y-auto">
                  {overflowClients.map((client) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <button
                        key={client.id}
                        onClick={() => handleSelect(client)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-accent-50 dark:bg-accent-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-dark-hover"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSelected ? "bg-accent-500 text-white" : "bg-gray-200 dark:bg-dark-hover text-gray-700 dark:text-gray-300"
                          }`}>
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${isSelected ? "text-accent-700 dark:text-accent-300" : "text-gray-900 dark:text-white"}`}>
                              {client.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {client.total_receipts} receipts
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {client.flagged > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              🚩{client.flagged}
                            </span>
                          )}
                          {client.uncategorized > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                              ❓{client.uncategorized}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}