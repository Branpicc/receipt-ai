"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useClientContext } from "@/lib/ClientContext";
import { Lightbulb, Lock } from "lucide-react";

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

  // Scope being edited:
  //   ""           = firm-wide default
  //   <clientId>   = per-client override
  const [scope, setScope] = useState<string>("");
  const { clients } = useClientContext();

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (userRole !== null) {
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

      let query = supabase.from("category_budgets").select("*").eq("firm_id", firmId);
      if (scope === "") {
        query = query.is("client_id", null);
      } else {
        query = query.eq("client_id", scope);
      }
      const { data, error } = await query;
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

      // Delete only the rows in this scope, not other scopes
      let deleteQuery = supabase
        .from("category_budgets")
        .delete()
        .eq("firm_id", firmId);
      if (scope === "") {
        deleteQuery = deleteQuery.is("client_id", null);
      } else {
        deleteQuery = deleteQuery.eq("client_id", scope);
      }
      await deleteQuery;

      const budgetsToInsert = Object.entries(editingBudgets)
        .filter(([, amount]) => amount > 0)
        .map(([category, amount]) => ({
          firm_id: firmId,
          client_id: scope === "" ? null : scope,
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
  const isFirmAdmin = userRole === "firm_admin";
  const canEdit = !isFirmAdmin;
  const showScopePicker =
    !isClient && (userRole === "owner" || userRole === "firm_admin" || userRole === "accountant");

  const scopeLabel =
    scope === ""
      ? "Firm-wide default"
      : clients.find(c => c.id === scope)?.name || "Selected client";

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading budgets...</p>
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
            {isFirmAdmin && (
              <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">(View Only)</span>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isClient
              ? "Set monthly spending budgets for your expense categories."
              : isFirmAdmin
              ? "View monthly spending budgets for each expense category and client."
              : "Set firm-wide defaults or per-client budget overrides for each category."}
          </p>
        </div>

        {showScopePicker && (
          <div className="mb-6 bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 border border-transparent dark:border-dark-border">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Editing budgets for
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
            >
              <option value="">Firm-wide default</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Per-client budgets override the firm-wide default. If a client has no per-client budget for a category, the firm-wide default applies.
            </p>
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
                {isFirmAdmin ? (
                  <>
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Only accountants and clients can edit budgets</span>
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Set to $0 to disable budget tracking for a category</span>
                  </>
                )}
              </p>
              <button
                onClick={saveBudgets}
                disabled={saving || !canEdit}
                className={`px-6 py-2 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  !canEdit ? "bg-gray-400" : ""
                }`}
              >
                {!canEdit ? "View Only" : saving ? "Saving..." : "Save Budgets"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
