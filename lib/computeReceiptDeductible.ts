// lib/computeReceiptDeductible.ts
//
// Single source of truth for "what is the income-tax-deductible amount of
// this receipt?" Used by the CRA tax-codes report, the per-line Excel
// export, the quarterly HST report, and the net-income summary so they
// all produce identical numbers.
//
// Inputs needed:
//   • the receipt itself (total, expense_type, business_percentage, capital
//     flag)
//   • the receipt's line items (optional — when categorized as business /
//     personal they override the receipt-level business_percentage)
//   • the client's tax profile (province, gst_hst_registered, default
//     percentages for vehicle / utilities / home office)
//   • the matched CRA tax code (for the 50% meals rule)
//
// Output:
//   • business_cents          — the business portion of the receipt total
//     (= total × effective business %)
//   • deductible_cents        — what flows into the CRA report (after
//     pre-tax stripping and the category deductibility %)
//   • recoverable_tax_cents   — ITC the registrant can claim back from CRA
//   • effective_business_pct  — informational: the % we actually used,
//     either from line items or the receipt-level setting
//
// Personal receipts and capital assets return zero — callers decide whether
// to route them to the personal / CCA reports separately.

import { preTaxDeductibleCents, recoverableTaxCents } from "./taxRates";

export type DeductibleReceipt = {
  total_cents: number | null;
  expense_type?: "business" | "personal" | null;
  business_percentage?: number | null;
  is_capital_asset?: boolean | null;
};

export type DeductibleLineItem = {
  total_cents: number | null;
  expense_type?: "business" | "personal" | null;
};

export type DeductibleClient = {
  province?: string | null;
  gst_hst_registered?: boolean | null;
};

export type DeductibleTaxCode = {
  code: string;
  deductible_percent: number;
};

export type DeductibleResult = {
  business_cents: number;
  deductible_cents: number;
  recoverable_tax_cents: number;
  effective_business_pct: number;
  reason_skipped?: "personal" | "capital_asset";
};

/**
 * Returns the effective business percentage for a receipt:
 *   1. If any line items are categorized (expense_type set), the % is
 *      computed from them (sum of business items ÷ sum of categorized items).
 *   2. Otherwise the receipt-level business_percentage is used (default 100).
 */
export function getEffectiveBusinessPercentage(
  receipt: DeductibleReceipt,
  lineItems: DeductibleLineItem[] = []
): number {
  const categorized = lineItems.filter(
    li => li.expense_type === "business" || li.expense_type === "personal"
  );
  if (categorized.length > 0) {
    const totalCategorized = categorized.reduce((s, li) => s + (li.total_cents || 0), 0);
    if (totalCategorized > 0) {
      const businessTotal = categorized
        .filter(li => li.expense_type === "business")
        .reduce((s, li) => s + (li.total_cents || 0), 0);
      return Math.round((businessTotal / totalCategorized) * 100);
    }
  }
  const pct = receipt.business_percentage ?? 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Compute the deductible / ITC amounts for a single receipt.
 */
export function computeReceiptDeductible(
  receipt: DeductibleReceipt,
  lineItems: DeductibleLineItem[] = [],
  client: DeductibleClient,
  taxCode?: DeductibleTaxCode | null
): DeductibleResult {
  const total = receipt.total_cents || 0;
  const province = client.province || "ON";
  const registered = !!client.gst_hst_registered;

  // Personal receipts never flow into the CRA report.
  if (receipt.expense_type === "personal") {
    return {
      business_cents: 0,
      deductible_cents: 0,
      recoverable_tax_cents: 0,
      effective_business_pct: 0,
      reason_skipped: "personal",
    };
  }

  // Capital assets are handled by the CCA section, not the regular CRA
  // report. Caller can route them appropriately.
  if (receipt.is_capital_asset) {
    return {
      business_cents: 0,
      deductible_cents: 0,
      recoverable_tax_cents: 0,
      effective_business_pct: 0,
      reason_skipped: "capital_asset",
    };
  }

  const pct = getEffectiveBusinessPercentage(receipt, lineItems);
  const businessCents = Math.round(total * (pct / 100));

  if (businessCents <= 0) {
    return {
      business_cents: 0,
      deductible_cents: 0,
      recoverable_tax_cents: 0,
      effective_business_pct: pct,
    };
  }

  // Strip recoverable tax to get the pre-tax deductible amount.
  const preTax = preTaxDeductibleCents(businessCents, province, registered);
  let recoverable = recoverableTaxCents(businessCents, province, registered);

  // Apply category-level deductibility (50% for meals, 100% for most others).
  const categoryPct = taxCode?.deductible_percent ?? 100;
  const deductible = Math.round(preTax * (categoryPct / 100));

  // Meals & entertainment ITC special rule: only 50% of the GST/HST on
  // meals is recoverable as ITC, mirroring the 50% income-tax deduction.
  if (taxCode?.code === "8523" && registered) {
    recoverable = Math.round(recoverable * 0.5);
  }

  return {
    business_cents: businessCents,
    deductible_cents: deductible,
    recoverable_tax_cents: recoverable,
    effective_business_pct: pct,
  };
}
