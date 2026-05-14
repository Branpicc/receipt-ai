"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import {
  CRA_TAX_CODES,
  getTaxCodeForCategory,
  getFormsForIncomeType,
  getCodesForForm,
  getFormLabel,
  type TaxCode,
  type TaxForm,
} from "../../../lib/taxCodes";
import Link from "next/link";
import { useClientContext } from "@/lib/ClientContext";
import ClientFilterDropdown from "@/components/ClientFilterDropdown";
import { computeReceiptDeductible, type DeductibleLineItem } from "@/lib/computeReceiptDeductible";
import { getProvinceTax } from "@/lib/taxRates";
import { getMyAccountType, type AccountType } from "@/lib/getMyAccountType";
import {
  Receipt as ReceiptIcon,
  FolderOpen,
  DollarSign,
  Settings as SettingsIcon,
  Download,
} from "lucide-react";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  approved_category: string | null;
  suggested_category: string | null;
};

type TaxCodeSummary = {
  taxCode: TaxCode;
  receipts: Receipt[];
  total_cents: number;
  tax_cents: number;
  deductible_cents: number;
};

export default function TaxCodesPage() {
  const { selectedClient } = useClientContext();
  const selectedClientId = selectedClient?.id || null;
  const [summaries, setSummaries] = useState<TaxCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"all" | "month" | "quarter" | "year">("year");
  const [selectedBreakdown, setSelectedBreakdown] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<TaxForm>("T2125");
  const [availableForms, setAvailableForms] = useState<TaxForm[]>(["T2125"]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [incomeType, setIncomeType] = useState<string | null>(null);
  // Client tax profile — drives the deductible math (registration status,
  // province → tax rates). Falls back to ON / unregistered when no client
  // is selected so the report still renders informatively.
  const [clientProfile, setClientProfile] = useState<{
    province: string;
    gst_hst_registered: boolean;
  }>({ province: "ON", gst_hst_registered: false });
  // Personal-account gates: CRA tax codes are inherently business-only,
  // so non-self-employed personal users get a friendly explainer instead
  // of an empty report. We load both pieces and gate the render below.
  const [accountType, setAccountType] = useState<AccountType>("firm");
  const [isSelfEmployed, setIsSelfEmployed] = useState<boolean>(true);

  useEffect(() => {
    getMyAccountType().then(setAccountType).catch(() => setAccountType("firm"));
  }, []);

  useEffect(() => {
    loadClientInfo();
  }, [selectedClientId]);

  useEffect(() => {
    loadTaxCodes();
  }, [dateRange, selectedClientId, activeForm]);

  async function loadClientInfo() {
    try {
      const clientId = selectedClientId;

      if (!clientId) {
        setAvailableForms(["T2125"]);
        setActiveForm("T2125");
        setClientName(null);
        setIncomeType(null);
        setClientProfile({ province: "ON", gst_hst_registered: false });
        return;
      }

      const { data: client } = await supabase
        .from("clients")
        .select("name, income_type, province, gst_hst_registered, is_self_employed")
        .eq("id", clientId)
        .single();

      if (client) {
        setClientName(client.name);
        setIncomeType(client.income_type);
        const forms = getFormsForIncomeType(client.income_type);
        setAvailableForms(forms);
        setActiveForm(forms[0]);
        setClientProfile({
          province: client.province || "ON",
          gst_hst_registered: !!client.gst_hst_registered,
        });
        // Default to true when the column is null so existing firm clients
        // keep seeing the full tax-codes report. Personal users get
        // is_self_employed set explicitly during onboarding.
        setIsSelfEmployed(client.is_self_employed !== false);
      }
    } catch (err) {
      console.error("Failed to load client info:", err);
    }
  }

  async function loadTaxCodes() {
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

      // Pull receipts AND the new tax-prep fields (expense_type,
      // business_percentage, is_capital_asset). Personal receipts and
      // capital assets are filtered downstream — they belong on the
      // /dashboard/personal and Capital Assets reports respectively.
      let query = supabase
        .from("receipts")
        .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, expense_type, business_percentage, is_capital_asset")
        .eq("firm_id", firmId)
        .not("approved_category", "is", null);

      if (selectedClientId) {
        query = query.eq("client_id", selectedClientId);
      }

      if (startDate) {
        query = query.gte("receipt_date", startDate);
      }

      const { data: receiptsData, error: receiptsError } = await query;
      if (receiptsError) throw receiptsError;

      const receiptIds = receiptsData?.map(r => r.id) || [];

      // Pull line items for all receipts in one query — we use them to
      // compute the actual business % when items have been individually
      // categorized as business or personal (e.g. a Staples receipt with
      // 6 personal + 2 business items gives a real % rather than a
      // receipt-level guess).
      const { data: lineItemsData } = receiptIds.length > 0
        ? await supabase
            .from("receipt_items")
            .select("receipt_id, total_cents, expense_type")
            .in("receipt_id", receiptIds)
        : { data: [] as any[] };

      const itemsByReceipt = new Map<string, DeductibleLineItem[]>();
      (lineItemsData || []).forEach((li: any) => {
        const arr = itemsByReceipt.get(li.receipt_id) || [];
        arr.push({ total_cents: li.total_cents, expense_type: li.expense_type });
        itemsByReceipt.set(li.receipt_id, arr);
      });

      // Get codes for the active form only
      const formCodes = getCodesForForm(activeForm);
      const taxCodeMap = new Map<string, TaxCodeSummary>();

      formCodes.forEach(tc => {
        taxCodeMap.set(tc.code, {
          taxCode: tc,
          receipts: [],
          total_cents: 0,
          tax_cents: 0,
          deductible_cents: 0,
        });
      });

      receiptsData?.forEach(receipt => {
        const category = receipt.approved_category || receipt.suggested_category;
        if (!category) return;

        // Skip personal and capital-asset receipts up front — they belong
        // to other reports.
        if (receipt.expense_type === "personal" || receipt.is_capital_asset) return;

        const matchedCode = getTaxCodeForCategory(category, activeForm);
        const targetCode =
          matchedCode ||
          formCodes.find(tc => tc.name.toLowerCase().includes("other")) ||
          null;
        if (!targetCode) return;

        const summary = taxCodeMap.get(targetCode.code);
        if (!summary) return;

        const lineItems = itemsByReceipt.get(receipt.id) || [];
        const result = computeReceiptDeductible(
          receipt,
          lineItems,
          clientProfile,
          targetCode
        );

        // Skip if the computed business portion is zero (e.g. all line
        // items marked personal).
        if (result.business_cents <= 0) return;

        summary.receipts.push(receipt);
        summary.total_cents += result.business_cents;
        summary.tax_cents += result.recoverable_tax_cents;
        summary.deductible_cents += result.deductible_cents;
      });

      const summaryArray = Array.from(taxCodeMap.values())
        .filter(s => s.receipts.length > 0)
        .sort((a, b) => b.deductible_cents - a.deductible_cents);

      setSummaries(summaryArray);
    } catch (err: any) {
      console.error("Failed to load tax codes:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalDeductible = summaries.reduce((sum, s) => sum + s.deductible_cents, 0);
  const totalAmount = summaries.reduce((sum, s) => sum + s.total_cents, 0);
  const totalTax = summaries.reduce((sum, s) => sum + s.tax_cents, 0);

// Per-line .xlsx export — calls the server route which generates a real
// styled spreadsheet (header block, totals, flagged-row highlights, all
// the tax-prep columns the accountant wants). We do it server-side so
// the exceljs library stays out of the client bundle.
async function exportLineXlsx(summary: TaxCodeSummary) {
  const firmId = await getMyFirmId();
  // The export route is firm-scoped via requireFirmMember, which needs
  // the user's access token in the Authorization header — same pattern
  // as the Stripe checkout call.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Your session expired. Please sign in again.");
    return;
  }
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

  const res = await fetch("/api/exports/tax-line-xlsx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      firmId,
      clientId: selectedClientId,
      form: activeForm,
      code: summary.taxCode.code,
      startDate,
    }),
  });
  if (!res.ok) {
    alert("Export failed: " + (await res.text()));
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Line${summary.taxCode.line.replace("Line ", "")}-${summary.taxCode.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSummary() {
    const formName = activeForm;
    const headers = ["Date", "Description", "Account", "Debit", "Tax Amount", "Memo", "Name"];
    const rows: string[][] = [];

    summaries.forEach(s => {
      s.receipts.forEach(r => {
        rows.push([
          r.receipt_date || "",
          s.taxCode.name,
          s.taxCode.name,
          ((r.total_cents || 0) / 100).toFixed(2),
          "",
          r.vendor || "",
          r.vendor || "",
        ]);
      });
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formName}-QuickBooks-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Personal + non-self-employed → CRA tax codes don't apply. Render a
  // friendly explainer pointing them at the reports that do.
  if (accountType === "personal" && !isSelfEmployed) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border p-8">
            <ReceiptIcon className="w-10 h-10 mb-3 text-gray-500 dark:text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              CRA tax codes are for self-employed users
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You&apos;ve marked this account as personal use only, so business
              tax-prep forms (T2125, capital cost allowance, home office) don&apos;t
              apply. Try one of these instead:
            </p>
            <div className="space-y-2">
              <Link href="/dashboard/category-dashboard" className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> Categories &amp; Deductibles
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">See your spending grouped by category</div>
              </Link>
              <Link href="/dashboard/reports/net-income" className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Monthly Net Income
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Revenue minus deductibles by month</div>
              </Link>
              <Link href="/dashboard/settings" className="block p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-500 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" /> I am self-employed — switch on
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Update your profile to unlock CRA tax-prep</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CRA Tax Codes</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Expenses grouped by Canada Revenue Agency tax form lines
              {clientName && (
                <span className="ml-2 text-accent-600 dark:text-accent-400 font-medium">
                  — {clientName}
                </span>
              )}
            </p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Client selector — simple dropdown matching the receipts page,
            backed by the shared ClientContext so selection persists
            across the dashboard, receipts list, category dashboard,
            and tax codes. */}
        <ClientFilterDropdown />

        {/* Income type note */}
        {incomeType && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              📋 Client income type: <strong className="capitalize">{incomeType.replace(/_/g, " ")}</strong> — showing applicable tax forms below
            </p>
          </div>
        )}

        {/* Tax-prep banner — explains the assumptions used to compute the
            deductible numbers so the accountant / client can verify them
            at a glance instead of guessing why the number changed. */}
        {selectedClientId && (
          <div className="mb-6 p-3 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg text-xs text-gray-700 dark:text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
            <span>📍 Province: <strong>{clientProfile.province}</strong> ({getProvinceTax(clientProfile.province).label})</span>
            <span>🧾 GST/HST registered: <strong>{clientProfile.gst_hst_registered ? "Yes (ITCs claimed)" : "No (full amount deductible)"}</strong></span>
            <span>Personal receipts and capital assets excluded.</span>
          </div>
        )}

        {/* "No client selected" warning — only for firm/accountant
            accounts. Personal users have their client auto-selected by
            ClientContext, so this warning briefly flashing during the
            async load was confusing firm chrome. */}
        {!selectedClientId && accountType !== "personal" && (
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              ⚠️ No client selected — select a client from the dashboard to see their applicable tax forms. Showing T2125 by default.
            </p>
          </div>
        )}

        {/* Form Tabs */}
        {availableForms.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {availableForms.map(form => (
              <button
                key={form}
                onClick={() => setActiveForm(form)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeForm === form
                    ? "bg-accent-500 text-white"
                    : "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover"
                }`}
              >
                {form}
              </button>
            ))}
          </div>
        )}

        {/* Active form label */}
        <div className="mb-6 p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
                {getFormLabel(activeForm)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {activeForm === "T2125" && "Statement of Business or Professional Activities"}
                {activeForm === "T776" && "Statement of Real Estate Rentals"}
                {activeForm === "T2200" && "Declaration of Conditions of Employment — signed by employer required"}
                {activeForm === "T1" && "Personal Income Tax Return"}
              </p>
            </div>
            <button
              onClick={exportSummary}
              disabled={summaries.length === 0}
              className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export {activeForm} CSV
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["month", "quarter", "year", "all"] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? "bg-accent-500 text-white"
                  : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
              }`}
            >
              {range === "month" ? "This Month" : range === "quarter" ? "This Quarter" : range === "year" ? "This Year" : "All Time"}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Expenses</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalAmount / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Deductible</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              ${(totalDeductible / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">GST/HST Paid</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${(totalTax / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Input Tax Credits</div>
          </div>
        </div>

        {/* Tax Code Lines */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading tax codes...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-12 text-center border border-transparent dark:border-dark-border">
            <p className="text-gray-500 dark:text-gray-400">No categorized receipts found for this period</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <div
                key={summary.taxCode.code}
                className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {summary.taxCode.line}
                      </span>
                      <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {summary.taxCode.name}
                      </span>
                      {summary.taxCode.deductible_percent < 100 && (
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded">
                          {summary.taxCode.deductible_percent}% deductible
                        </span>
                      )}
                      {summary.taxCode.gst_eligible && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded">
                          GST/HST eligible
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {summary.taxCode.description}
                    </p>
                    {summary.taxCode.categories.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Categories: {summary.taxCode.categories.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${(summary.total_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                      Deductible: ${(summary.deductible_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {summary.receipts.length} receipt{summary.receipts.length !== 1 ? "s" : ""}
                    </div>
                    <button
                      onClick={() => exportLineXlsx(summary)}
                      className="mt-2 text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors inline-flex items-center gap-1"
                      title={`Download all receipts on ${summary.taxCode.line} as a spreadsheet`}
                    >
                      <Download className="w-3 h-3" /> Excel
                    </button>
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                    View receipts ({summary.receipts.length})
                  </summary>
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-dark-border">
                    {summary.receipts.map(receipt => (
                      <Link
                        key={receipt.id}
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="block p-3 rounded-lg bg-gray-50 dark:bg-dark-hover hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {receipt.vendor || "Unknown"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${((receipt.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {receipt.receipt_date || "No date"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}