// lib/taxRates.ts
//
// Per-province sales tax rates used by the CRA tax-codes report to compute
// the recoverable GST/HST portion (Input Tax Credits) and the deductible
// pre-tax expense amount.
//
// Rules CRA actually uses:
//   • GST/HST is recoverable as an ITC ONLY for GST/HST-registered firms.
//   • PST (BC, SK, MB) is NOT recoverable — it's a sunk cost embedded in the
//     expense and stays in the deductible amount.
//   • QST (Quebec) IS recoverable as an Input Tax Refund (ITR) for
//     QST-registrants, the same way HST is for HST-registrants.
//
// Rates as of 2026. Verify annually — CRA / provincial finance ministries
// occasionally adjust these (PEI HST jumped to 15% in 2016; BC PST dropped
// to 7% in 2013, etc).

export type ProvinceCode =
  | "ON" | "BC" | "AB" | "QC" | "MB" | "SK" | "NS" | "NB" | "NL" | "PE"
  | "NT" | "NU" | "YT";

export type ProvinceTax = {
  /** Combined recoverable rate (GST + HST + QST) as a decimal. */
  recoverableRate: number;
  /** Provincial sales tax rate that is NOT recoverable as an ITC. */
  nonRecoverableRate: number;
  /** Total combined rate, for reference. */
  totalRate: number;
  /** Human-readable label for UI. */
  label: string;
};

export const PROVINCE_TAX_RATES: Record<ProvinceCode, ProvinceTax> = {
  // HST provinces — single combined rate, fully recoverable as ITC.
  ON: { recoverableRate: 0.13,    nonRecoverableRate: 0,       totalRate: 0.13,    label: "HST 13%" },
  NB: { recoverableRate: 0.15,    nonRecoverableRate: 0,       totalRate: 0.15,    label: "HST 15%" },
  NL: { recoverableRate: 0.15,    nonRecoverableRate: 0,       totalRate: 0.15,    label: "HST 15%" },
  NS: { recoverableRate: 0.14,    nonRecoverableRate: 0,       totalRate: 0.14,    label: "HST 14%" },
  PE: { recoverableRate: 0.15,    nonRecoverableRate: 0,       totalRate: 0.15,    label: "HST 15%" },

  // GST-only provinces and territories.
  AB: { recoverableRate: 0.05,    nonRecoverableRate: 0,       totalRate: 0.05,    label: "GST 5%" },
  NT: { recoverableRate: 0.05,    nonRecoverableRate: 0,       totalRate: 0.05,    label: "GST 5%" },
  NU: { recoverableRate: 0.05,    nonRecoverableRate: 0,       totalRate: 0.05,    label: "GST 5%" },
  YT: { recoverableRate: 0.05,    nonRecoverableRate: 0,       totalRate: 0.05,    label: "GST 5%" },

  // GST + non-recoverable PST.
  BC: { recoverableRate: 0.05,    nonRecoverableRate: 0.07,    totalRate: 0.12,    label: "5% GST + 7% PST" },
  MB: { recoverableRate: 0.05,    nonRecoverableRate: 0.07,    totalRate: 0.12,    label: "5% GST + 7% PST" },
  SK: { recoverableRate: 0.05,    nonRecoverableRate: 0.06,    totalRate: 0.11,    label: "5% GST + 6% PST" },

  // Quebec — GST + recoverable QST (for QST-registrants).
  QC: { recoverableRate: 0.14975, nonRecoverableRate: 0,       totalRate: 0.14975, label: "5% GST + 9.975% QST" },
};

export function getProvinceTax(province: string | null | undefined): ProvinceTax {
  if (!province) return PROVINCE_TAX_RATES.ON; // Default if unknown.
  const normalized = province.toUpperCase() as ProvinceCode;
  return PROVINCE_TAX_RATES[normalized] || PROVINCE_TAX_RATES.ON;
}

/**
 * Strip the recoverable tax portion from a tax-included total to get the
 * pre-tax deductible amount. PST / non-recoverable tax stays in the
 * deductible amount because it's a real cost the business absorbed.
 *
 * Used by the CRA report for GST/HST-registered clients. For non-registrants,
 * the full tax-included amount is deductible (no ITC math).
 */
export function preTaxDeductibleCents(
  totalCents: number,
  province: ProvinceCode | string | null | undefined,
  gstHstRegistered: boolean
): number {
  if (!gstHstRegistered) return totalCents;
  const tax = getProvinceTax(province);
  // Recoverable rate is applied to the pre-tax amount, so:
  //   total = pre_tax × (1 + recoverable + nonRecoverable)
  //   deductible = pre_tax + (pre_tax × nonRecoverable)
  //              = total × (1 + nonRecoverable) / (1 + total_rate)
  return Math.round(
    (totalCents * (1 + tax.nonRecoverableRate)) / (1 + tax.totalRate)
  );
}

/**
 * Compute the recoverable ITC amount (the portion the registrant can claim
 * back from CRA). Returns 0 for non-registrants.
 */
export function recoverableTaxCents(
  totalCents: number,
  province: ProvinceCode | string | null | undefined,
  gstHstRegistered: boolean
): number {
  if (!gstHstRegistered) return 0;
  const tax = getProvinceTax(province);
  // total = pre_tax × (1 + total_rate)
  // recoverable = pre_tax × recoverable_rate
  return Math.round(
    (totalCents * tax.recoverableRate) / (1 + tax.totalRate)
  );
}
