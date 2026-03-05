"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type CategorySummary = {
  category: string;
  count: number;
  total_cents: number;
  tax_cents: number;
};

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
  purpose_text: string | null;
};

type CategoryBudget = {
  id: string;
  category: string;
  monthly_budget_cents: number;
};

type BudgetComparison = {
  category: string;
  budget_cents: number;
  spent_cents: number;
  remaining_cents: number;
  percentage: number;
  isOverBudget: boolean;
  color: string;
};

const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // violet
  "#ef4444", // red - only used if you have 11+ categories
];

export default function CategoryDashboardPage() {
  const [summaries, setSummaries] = useState<CategorySummary[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("month");

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();
      
      let startDate: string | null = null;
      const now = new Date();
      
      if (dateRange === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateRange === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
      } else if (dateRange === "year") {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      // Load budgets
      const { data: budgetsData } = await supabase
        .from("category_budgets")
        .select("*")
        .eq("firm_id", firmId);
      
      setBudgets(budgetsData || []);

      let query = supabase
        .from("receipts")
        .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, purpose_text")
        .eq("firm_id", firmId);
      
      if (startDate) {
        query = query.gte("receipt_date", startDate);
      }

      const { data: receiptsData, error: receiptsError } = await query;
      
      if (receiptsError) throw receiptsError;
      setReceipts(receiptsData || []);

      const categoryMap = new Map<string, CategorySummary>();
      
      receiptsData?.forEach(r => {
        const category = r.approved_category || r.suggested_category || "Uncategorized";
        const total = r.total_cents || 0;
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            count: 0,
            total_cents: 0,
            tax_cents: 0,
          });
        }
        
        const summary = categoryMap.get(category)!;
        summary.count++;
        summary.total_cents += total;
      });

      const receiptIds = receiptsData?.map(r => r.id) || [];
      const { data: taxesData } = await supabase
        .from("receipt_taxes")
        .select("receipt_id, amount_cents")
        .in("receipt_id", receiptIds);

      taxesData?.forEach(tax => {
        const receipt = receiptsData?.find(r => r.id === tax.receipt_id);
        if (receipt) {
          const category = receipt.approved_category || receipt.suggested_category || "Uncategorized";
          const summary = categoryMap.get(category);
          if (summary) {
            summary.tax_cents += tax.amount_cents;
          }
        }
      });

      const summaryArray = Array.from(categoryMap.values()).sort(
        (a, b) => b.total_cents - a.total_cents
      );
      
      setSummaries(summaryArray);
    } catch (err: any) {
      console.error("Failed to load dashboard:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = summaries.reduce((sum, s) => sum + s.total_cents, 0);
  const totalTax = summaries.reduce((sum, s) => sum + s.tax_cents, 0);
  const totalCount = summaries.reduce((sum, s) => sum + s.count, 0);

  // Calculate budget comparisons (only for current month)
  const budgetComparisons: BudgetComparison[] = budgets
    .map((budget, index) => {
      const summary = summaries.find(s => s.category === budget.category);
      const spent_cents = summary?.total_cents || 0;
      const remaining_cents = budget.monthly_budget_cents - spent_cents;
      const percentage = budget.monthly_budget_cents > 0 
        ? Math.round((spent_cents / budget.monthly_budget_cents) * 100)
        : 0;
      const isOverBudget = spent_cents > budget.monthly_budget_cents;

      return {
        category: budget.category,
        budget_cents: budget.monthly_budget_cents,
        spent_cents,
        remaining_cents,
        percentage,
        isOverBudget,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    })
    .filter(bc => bc.budget_cents > 0)
    .sort((a, b) => b.percentage - a.percentage);

  // Prepare pie chart data
  const pieData = budgetComparisons.map(bc => ({
    name: bc.category,
    value: bc.spent_cents / 100,
    budget: bc.budget_cents / 100,
    percentage: bc.percentage,
    isOverBudget: bc.isOverBudget,
  }));

  const filteredReceipts = selectedCategory
    ? receipts.filter(r => 
        (r.approved_category || r.suggested_category || "Uncategorized") === selectedCategory
      )
    : [];

  const showBudgetSection = dateRange === "month" && budgetComparisons.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Category Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">View receipts grouped by expense category</p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-4 mb-6 border border-transparent dark:border-dark-border">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "month"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRange("quarter")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "quarter"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => setDateRange("year")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "year"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setDateRange("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "all"
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Budget Pie Chart Section - Only show for "This Month" */}
        {showBudgetSection && (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                💰 Monthly Budget vs Actual Spending
              </h2>
              <Link
                href="/dashboard/budget-settings"
                className="text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 underline"
              >
                Edit Budgets →
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pie Chart */}
              <div className="flex items-center justify-center">
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
<Pie
  data={budgetComparisons.flatMap(bc => [
    // Spent portion (bold category color)
    {
      name: bc.category,
      value: Math.min(bc.spent_cents, bc.budget_cents) / 100,
      color: bc.color,
      isSpent: true,
      fullData: bc,
    },
    // Remaining portion (grey with category-colored border)
    {
      name: `${bc.category} (remaining)`,
      value: Math.max(0, bc.budget_cents - bc.spent_cents) / 100,
      color: bc.color,
      isSpent: false,
      fullData: bc,
    },
  ])}
  cx="50%"
  cy="50%"
  innerRadius={60}
  outerRadius={100}
  paddingAngle={0}
  dataKey="value"
>
  {budgetComparisons.flatMap((bc, index) => [
    <Cell 
      key={`spent-${index}`}
      fill={bc.color}
      opacity={1}
      stroke={bc.isOverBudget ? '#ef4444' : 'none'}
      strokeWidth={bc.isOverBudget ? 3 : 0}
    />,
    <Cell 
      key={`remaining-${index}`}
      fill="#d1d5db" // Grey fill
      opacity={0.8}
      stroke={bc.color} // Category-colored border
      strokeWidth={2}
    />,
  ])}
</Pie>
    
    <Tooltip
      content={({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
        if (active && payload && payload.length) {
          const data = payload[0].payload;
          const bc = data.fullData;
          
          return (
            <div className="bg-white dark:bg-dark-surface p-3 rounded-lg shadow-lg border border-gray-200 dark:border-dark-border">
              <p className="font-semibold text-gray-900 dark:text-white">{bc.category}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Spent: ${(bc.spent_cents / 100).toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Budget: ${(bc.budget_cents / 100).toFixed(2)}
              </p>
              <p className={`text-sm font-semibold ${bc.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                {bc.percentage}% {bc.isOverBudget ? 'over' : 'used'}
              </p>
            </div>
          );
        }
        return null;
      }}
    />
  </PieChart>
</ResponsiveContainer>
              </div>

              {/* Budget List */}
              <div className="space-y-3">
                {budgetComparisons.map((bc) => (
                  <div
                    key={bc.category}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: bc.isOverBudget ? '#ef4444' : bc.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {bc.category}
                        </span>
                        {bc.isOverBudget && (
                          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded">
                            ⚠️ Over
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {bc.percentage}%
                      </span>
                    </div>
                    
                    <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                      <div
                        className={`absolute top-0 left-0 h-2 rounded-full transition-all ${
                          bc.isOverBudget 
                            ? 'bg-red-600 dark:bg-red-500' 
                            : 'bg-green-600 dark:bg-green-500'
                        }`}
                        style={{ width: `${Math.min(bc.percentage, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>${(bc.spent_cents / 100).toFixed(2)} spent</span>
                      <span>${(bc.budget_cents / 100).toFixed(2)} budget</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Receipts</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalCount}</div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalAmount / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Subtotal: ${((totalAmount - totalTax) / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Tax</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalTax / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-12 text-center border border-transparent dark:border-dark-border">
            <p className="text-gray-500 dark:text-gray-400">No receipts found for this period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category List */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Categories ({summaries.length})
              </h2>
              <div className="space-y-3">
                {summaries.map((summary) => {
                  const budgetComparison = budgetComparisons.find(bc => bc.category === summary.category);
                  const isOverBudget = budgetComparison?.isOverBudget || false;

                  return (
                    <button
                      key={summary.category}
                      onClick={() => setSelectedCategory(
                        selectedCategory === summary.category ? null : summary.category
                      )}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedCategory === summary.category
                          ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                          : isOverBudget
                          ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                          : "border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {summary.category}
                          </span>
                          {isOverBudget && showBudgetSection && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded font-medium">
                              ⚠️ Over Budget
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {summary.count} receipt{summary.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total: ${(summary.total_cents / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Tax: ${(summary.tax_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Receipt Details */}
            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
              {selectedCategory ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {selectedCategory} ({filteredReceipts.length})
                  </h2>
                  <div className="space-y-3">
                    {filteredReceipts.map((receipt) => (
                      <Link
                        key={receipt.id}
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-dark-hover transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {receipt.vendor || "Unknown Vendor"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${((receipt.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {receipt.receipt_date || "No date"}
                        </div>
                        {receipt.purpose_text && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                            {receipt.purpose_text}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                  ← Select a category to view receipts
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}