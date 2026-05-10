// lib/capitalAsset.ts
//
// Helpers for detecting potential capital assets (long-lived equipment,
// computers, vehicles, furniture) which CRA requires to be capitalized
// and depreciated via Capital Cost Allowance (CCA) rather than
// expensed in full in the year of purchase.
//
// We deliberately don't run the full CCA math here — depreciation
// schedules, half-year rule, recapture etc. are real accounting-software
// territory. Instead we just FLAG receipts that look capital so the
// accountant can decide.

const CAPITAL_THRESHOLD_CENTS = 500_00; // $500 working threshold

// Categories where a > $500 receipt is plausibly a capital asset rather
// than a consumable expense.
const CAPITAL_PRONE_CATEGORIES = new Set([
  "Equipment & Tools",
  "Office Supplies & Expenses",
  "Software & Subscriptions",
  "Repairs & Maintenance",
]);

export function isLikelyCapitalAsset(
  totalCents: number | null | undefined,
  category: string | null | undefined
): boolean {
  if (!totalCents || totalCents < CAPITAL_THRESHOLD_CENTS) return false;
  if (!category) return false;
  return CAPITAL_PRONE_CATEGORIES.has(category);
}

// Educated-guess CCA class suggestion based on category. Accountant
// confirms / overrides on the receipt detail page.
export function suggestCcaClass(category: string | null | undefined): string | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c.includes("software") || c.includes("subscription")) return "Class 50 (50%) — Computer software";
  if (c.includes("equipment") || c.includes("tools")) return "Class 8 (20%) — General equipment & furniture";
  if (c.includes("office")) return "Class 8 (20%) — General office equipment";
  if (c.includes("vehicle")) return "Class 10 (30%) — Motor vehicles under $30k";
  if (c.includes("repair") || c.includes("maintenance")) return "Class 8 (20%) — Improvements to equipment";
  return "Class 8 (20%) — General equipment";
}

export const CAPITAL_ASSET_THRESHOLD_DOLLARS = 500;
