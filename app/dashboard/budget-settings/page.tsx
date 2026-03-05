"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type CategoryBudget = {
  id: string;
  category: string;
  monthly_budget_cents: number;
};

// All possible categories from your system
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
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState<{ [key: string]: number }>({});
  const [editingValues, setEditingValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadBudgets();
  }, []);

  async function loadBudgets() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      const { data, error } = await supabase
        .from("category_budgets")
        .select("*")
        .eq("firm_id", firmId);

      if (error) throw error;

      setBudgets(data || []);

      // Initialize editing state
      const initialEdits: { [key: string]: number } = {};
      const initialValues: { [key: string]: string } = {};
      AVAILABLE_CATEGORIES.forEach(category => {
        const existing = data?.find(b => b.category === category);
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

      // Delete all existing budgets
      await supabase
        .from("category_budgets")
        .delete()
        .eq("firm_id", firmId);

      // Insert new budgets (only non-zero ones)
      const budgetsToInsert = Object.entries(editingBudgets)
        .filter(([_, amount]) => amount > 0)
        .map(([category, amount]) => ({
          firm_id: firmId,
          category,
          monthly_budget_cents: amount,
        }));

      if (budgetsToInsert.length > 0) {
        const { error } = await supabase
          .from("category_budgets")
          .insert(budgetsToInsert);

        if (error) throw error;
      }

      alert("✅ Budgets saved successfully!");
      await loadBudgets();
    } catch (error: any) {
      console.error("Failed to save budgets:", error);
      alert("Failed to save budgets: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  const totalBudget = Object.values(editingBudgets).reduce((sum, val) => sum + val, 0);

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Monthly Spending Budget
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Set monthly spending budgets for each expense category. You'll see warnings when you exceed them.
          </p>
        </div>

        {/* Total Budget Card */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Total Monthly Budget
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${(totalBudget / 100).toFixed(2)}
              </div>
            </div>
            <div className="text-5xl">💰</div>
          </div>
        </div>

        {/* Budget Grid */}
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
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {category}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Monthly spending limit
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-lg">$</span>
                    <input
                      type="text"
                      value={editingValues[category] || ""}
                      onFocus={(e) => e.target.select()}
onChange={(e) => {
  const value = e.target.value;
  // Allow empty string or valid number format
  if (/^\d*\.?\d{0,2}$/.test(value)) {
    setEditingValues(prev => ({
      ...prev,
      [category]: value === '' ? '' : value,  // Keep empty string as is
    }));
  }
}}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const cents = Math.round(parseFloat(value || "0") * 100);
                        setEditingBudgets(prev => ({
                          ...prev,
                          [category]: cents,
                        }));
                        // Format on blur
                        setEditingValues(prev => ({
                          ...prev,
                          [category]: (cents / 100).toFixed(2),
                        }));
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-right text-gray-900 dark:text-white bg-white dark:bg-dark-bg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="p-6 bg-gray-50 dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 Set to $0 to disable budget tracking for a category
              </p>
              <button
                onClick={saveBudgets}
                disabled={saving}
                className="px-6 py-2 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Budgets"}
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            📊 How Budget Tracking Works
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>• Budgets are tracked monthly (resets on the 1st of each month)</li>
            <li>• You'll see visual indicators on the Category Dashboard when approaching limits</li>
            <li>• Receipts over budget will show a ⚠️ warning symbol</li>
            <li>• Budget data appears in reports and export files</li>
          </ul>
        </div>
      </div>
    </div>
  );
}