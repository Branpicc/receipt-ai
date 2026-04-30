"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useClientContext } from "@/lib/ClientContext";
import { Lightbulb } from "lucide-react";

type CategoryBudget = {
  id: string;
  category: string;
  monthly_budget_cents: number;
  client_id: string | null;
};

const AVAILABLE_CATEGORIES = [
  "Advertising & Promotion",
  "Bank Charges & Interest",
  "Meals & Entertainment",
  "Office Supplies & Expenses",
  "Software & Subscriptions",
  "Rent & Lease",
  "Vehicle Expenses & Fuel",
  "Repairs & Maintenance",
  "Equipment & Tools",
  "Telephone & Internet",
  "Utilities",
  "Professional Fees",
  "Insurance",
  "Travel Expenses",
  "Other Expenses",
];

export default function BudgetSettingsPage() {
  const [, setBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState<{ [key: string]: number }>({});
  const [editingValues, setEditingValues] = useState<{ [key: string]: string }>({});
  const [userRole, setUserRole] = useState<string | null>(null);

  // The currently-edited client. Empty string only while we're still figuring
  // out who to default to.
  const [scope, setScope] = useState<string>("");
  const { clients } = useClientContext();

  useEffect(() => {
    bootstrap();
  }, []);

  // For non-client roles, default to the first client once the list arrives.
  useEffect(() => {
    if (userRole && userRole !== "client" && scope === "" && clients.length > 0) {
      setScope(clients[0].id);
    }
  }, [clients, userRole, scope]);

  useEffect(() => {
    if (userRole !== null && scope !== "") {
      loadBudgets();
    }
  }, [scope, userRole]);

  async function bootstrap() {
    const role = await getUserRole();
    setUserRole(role);
    if (role === "client") {
      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("firm_users")
          .select("client_id")
          .eq("auth_user_id", user.id)
          .eq("firm_id", firmId)
          .single();
        if (data?.client_id) setScope(data.client_id);
      }
    }
  }

  async function loadBudgets() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      const { data, error } = await supabase
        .from("category_budgets")
        .select("*")
        .eq("firm_id", firmId)
        .eq("client_id", scope);
      if (error) throw error;

      setBudgets(data || []);

      const initialEdits: { [key: string]: number } = {};
      const initialValues: { [key: string]: string } = {};
      AVAILABLE_CATEGORIES.forEach(category => {
        const existing = data?.find((b: CategoryBudget) => b.category === category);
        const cents = existing?.monthly_budget_cents || 0;
        initialEdits[category] = cents;
        initialValues[category] = (cents / 100).toFixed(2);
      });
      setEditingBudgets(initialEdits);
      setEditingValues(initialValues);
    } catch (error) {
      console.error("Failed to load budgets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveBudgets() {
    try {
      setSaving(true);
      const firmId = await getMyFirmId();

      // Replace only this client's budgets; never touch other clients' rows
      await supabase
        .from("category_budgets")
        .delete()
        .eq("firm_id", firmId)
        .eq("client_id", scope);

      const budgetsToInsert = Object.entries(editingBudgets)
        .filter(([, amount]) => amount > 0)
        .map(([category, amount]) => ({
          firm_id: firmId,
          client_id: scope,
          category,
          monthly_budget_cents: amount,
        }));

      if (budgetsToInsert.length > 0) {
        const { error } = await supabase.from("category_budgets").insert(budgetsToInsert);
        if (error) throw error;
      }

      alert("Budgets saved successfully!");
      await loadBudgets();
    } catch (error: any) {
      console.error("Failed to save budgets:", error);
      alert("Failed to save budgets: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  const totalBudget = Object.values(editingBudgets).reduce((sum, val) => sum + val, 0);
  const isClient = userRole === "client";
  const canEdit = userRole !== null;
  const showScopePicker = !isClient;

  const scopeLabel = clients.find(c => c.id === scope)?.name || "";

  if (userRole === "firm_admin") {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Monthly Spending Budget
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            Budgets are managed by accountants and the clients themselves.
            You don&apos;t have access to set them here.
          </p>
        </div>
      </div>
    );
  }

  if (loading || (showScopePicker && scope === "" && clients.length > 0)) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading budgets...</p>
        </div>
      </div>
    );
  }

  if (showScopePicker && clients.length === 0) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Monthly Spending Budget
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            No clients yet. Add a client first, then set their budgets here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Monthly Spending Budget
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isClient
              ? "Set monthly spending budgets for your expense categories."
              : "Set monthly spending budgets per client. Pick a client below to view or edit theirs."}
          </p>
        </div>

        {showScopePicker && (
          <div className="mb-6 bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 border border-transparent dark:border-dark-border">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Client
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total Monthly Budget — {scopeLabel}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalBudget / 100).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Category Budgets
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {AVAILABLE_CATEGORIES.map(category => (
              <div key={category} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                      {category}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Monthly limit</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editingValues[category] || ""}
                      onFocus={(e) => canEdit && e.target.select()}
                      onChange={(e) => {
                        if (!canEdit) return;
                        const value = e.target.value;
                        if (/^\d*\.?\d{0,2}$/.test(value)) {
                          setEditingValues(prev => ({
                            ...prev,
                            [category]: value === "" ? "" : value,
                          }));
                        }
                      }}
                      onBlur={(e) => {
                        if (!canEdit) return;
                        const value = e.target.value;
                        const cents = Math.round(parseFloat(value || "0") * 100);
                        setEditingBudgets(prev => ({ ...prev, [category]: cents }));
                        setEditingValues(prev => ({
                          ...prev,
                          [category]: (cents / 100).toFixed(2),
                        }));
                      }}
                      disabled={!canEdit}
                      className={`w-24 md:w-32 px-2 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-right text-gray-900 dark:text-white bg-white dark:bg-dark-bg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-colors ${
                        !canEdit ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50 dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Set to $0 to disable budget tracking for a category</span>
              </p>
              <button
                onClick={saveBudgets}
                disabled={saving || !canEdit}
                className="px-6 py-2 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Budgets"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
