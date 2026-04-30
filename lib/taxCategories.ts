/**
 * Canonical CRA-aligned expense categories.
 * Single source of truth — used by budget-settings, the category picker
 * on the receipt detail page, and anywhere else a category list is needed.
 */
export const TAX_CATEGORIES = [
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
] as const;

export type TaxCategory = typeof TAX_CATEGORIES[number];
