export type TaxForm = "T2125" | "T776" | "T2200" | "T3" | "T1";

export type TaxCode = {
  code: string;
  line: string;
  name: string;
  description: string;
  deductible_percent: number;
  gst_eligible: boolean;
  categories: string[];
  form: TaxForm;
};

// ── T2125 — Self-Employed / Sole Proprietor ───────────────────────────────────
export const T2125_CODES: TaxCode[] = [
  {
    code: "9270",
    line: "Line 9270",
    name: "Advertising",
    description: "Advertising costs including online ads, print, radio, TV",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Advertising & Promotion"],
    form: "T2125",
  },
  {
    code: "9819",
    line: "Line 9819",
    name: "Business Tax, Fees, Licenses",
    description: "Business registration, licenses, permits",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Bank Charges & Interest"],
    form: "T2125",
  },
  {
    code: "8523",
    line: "Line 8523",
    name: "Meals and Entertainment",
    description: "Food and entertainment for business purposes",
    deductible_percent: 50,
    gst_eligible: true,
    categories: ["Meals & Entertainment"],
    form: "T2125",
  },
  {
    code: "8960",
    line: "Line 8960",
    name: "Office Expenses",
    description: "Office supplies, postage, stationery",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Office Supplies & Expenses", "Software & Subscriptions"],
    form: "T2125",
  },
  {
    code: "9060",
    line: "Line 9060",
    name: "Property Taxes",
    description: "Property taxes for business premises",
    deductible_percent: 100,
    gst_eligible: false,
    categories: [],
    form: "T2125",
  },
  {
    code: "9200",
    line: "Line 9200",
    name: "Rent",
    description: "Rent for business premises or equipment",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Rent & Lease"],
    form: "T2125",
  },
  {
    code: "9281",
    line: "Line 9281",
    name: "Motor Vehicle Expenses",
    description: "Fuel, maintenance, insurance for business vehicles",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Vehicle Expenses & Fuel"],
    form: "T2125",
  },
  {
    code: "9220",
    line: "Line 9220",
    name: "Repairs and Maintenance",
    description: "Repairs to business property or equipment",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Repairs & Maintenance", "Equipment & Tools"],
    form: "T2125",
  },
  {
    code: "8690",
    line: "Line 8690",
    name: "Telephone and Utilities",
    description: "Phone, internet, electricity, water, heat",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Telephone & Internet", "Utilities"],
    form: "T2125",
  },
  {
    code: "8860",
    line: "Line 8860",
    name: "Professional Fees",
    description: "Accounting, legal, consulting fees",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Professional Fees"],
    form: "T2125",
  },
  {
    code: "9804",
    line: "Line 9804",
    name: "Insurance",
    description: "Business insurance premiums",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Insurance"],
    form: "T2125",
  },
  {
    code: "9275",
    line: "Line 9275",
    name: "Travel",
    description: "Airfare, hotels, meals while traveling for business",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Travel Expenses"],
    form: "T2125",
  },
  {
    code: "9936",
    line: "Line 9936",
    name: "Other Expenses",
    description: "Any other allowable business expenses",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Other Expenses"],
    form: "T2125",
  },
];

// ── T776 — Rental Property Income ────────────────────────────────────────────
export const T776_CODES: TaxCode[] = [
  {
    code: "T776-8521",
    line: "Line 8521",
    name: "Advertising",
    description: "Advertising rental property — listings, signs, online ads",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Advertising & Promotion"],
    form: "T776",
  },
  {
    code: "T776-8690",
    line: "Line 8690",
    name: "Telephone & Utilities",
    description: "Utilities paid for rental property — electricity, heat, water",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Telephone & Internet", "Utilities"],
    form: "T776",
  },
  {
    code: "T776-8710",
    line: "Line 8710",
    name: "Insurance",
    description: "Insurance premiums for rental property",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Insurance"],
    form: "T776",
  },
  {
    code: "T776-8711",
    line: "Line 8711",
    name: "Interest & Bank Charges",
    description: "Mortgage interest and bank charges on rental property",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Bank Charges & Interest"],
    form: "T776",
  },
  {
    code: "T776-8712",
    line: "Line 8712",
    name: "Office Expenses",
    description: "Office expenses related to managing rental property",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Office Supplies & Expenses"],
    form: "T776",
  },
  {
    code: "T776-8713",
    line: "Line 8713",
    name: "Legal, Accounting & Professional Fees",
    description: "Professional fees for rental property management",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Professional Fees"],
    form: "T776",
  },
  {
    code: "T776-8714",
    line: "Line 8714",
    name: "Management & Administration Fees",
    description: "Property management fees",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Professional Fees"],
    form: "T776",
  },
  {
    code: "T776-8716",
    line: "Line 8716",
    name: "Repairs & Maintenance",
    description: "Repairs and maintenance of rental property",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Repairs & Maintenance", "Equipment & Tools"],
    form: "T776",
  },
  {
    code: "T776-8600",
    line: "Line 8600",
    name: "Property Taxes",
    description: "Municipal property taxes on rental property",
    deductible_percent: 100,
    gst_eligible: false,
    categories: [],
    form: "T776",
  },
  {
    code: "T776-9270",
    line: "Line 9270",
    name: "Travel Expenses",
    description: "Travel to collect rent or supervise repairs",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Travel Expenses", "Vehicle Expenses & Fuel"],
    form: "T776",
  },
  {
    code: "T776-9936",
    line: "Line 9936",
    name: "Other Rental Expenses",
    description: "Any other allowable rental property expenses",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Other Expenses"],
    form: "T776",
  },
];

// ── T2200 — Employment Expenses ───────────────────────────────────────────────
export const T2200_CODES: TaxCode[] = [
  {
    code: "T2200-229",
    line: "Line 229",
    name: "Other Employment Expenses",
    description: "Employment expenses certified by employer on T2200",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Office Supplies & Expenses"],
    form: "T2200",
  },
  {
    code: "T2200-9281",
    line: "Line 9281",
    name: "Motor Vehicle Expenses",
    description: "Vehicle expenses for employment duties — requires T2200 from employer",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Vehicle Expenses & Fuel"],
    form: "T2200",
  },
  {
    code: "T2200-8690",
    line: "Line 8690",
    name: "Home Office — Telephone & Utilities",
    description: "Home office expenses — phone and utilities portion used for work",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Telephone & Internet", "Utilities"],
    form: "T2200",
  },
  {
    code: "T2200-8960",
    line: "Line 8960",
    name: "Home Office Supplies",
    description: "Supplies used in home office for employment",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Office Supplies & Expenses", "Software & Subscriptions"],
    form: "T2200",
  },
  {
    code: "T2200-9275",
    line: "Line 9275",
    name: "Travel Expenses",
    description: "Travel expenses for employment duties — requires T2200",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Travel Expenses"],
    form: "T2200",
  },
  {
    code: "T2200-8860",
    line: "Line 8860",
    name: "Legal Fees",
    description: "Legal fees to collect salary or wages",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Professional Fees"],
    form: "T2200",
  },
  {
    code: "T2200-meals",
    line: "Line 229",
    name: "Meals (Long Haul Transport)",
    description: "Meal expenses for long-haul transport employees only",
    deductible_percent: 80,
    gst_eligible: true,
    categories: ["Meals & Entertainment"],
    form: "T2200",
  },
];

// ── Combined export for backward compatibility ────────────────────────────────
export const CRA_TAX_CODES: TaxCode[] = [
  ...T2125_CODES,
  ...T776_CODES,
  ...T2200_CODES,
];

// ── Income type to applicable forms mapping ───────────────────────────────────
export const INCOME_TYPE_FORMS: Record<string, TaxForm[]> = {
  self_employed: ["T2125"],
  incorporated: ["T2125"],
  partnership: ["T2125"],
  rental_property: ["T776"],
  employed: ["T2200"],
  retired: ["T1"],
  investment: ["T1"],
  student: ["T1"],
  other: ["T2125"],
};

export function getFormsForIncomeType(incomeType: string | null): TaxForm[] {
  if (!incomeType) return ["T2125"];
  return INCOME_TYPE_FORMS[incomeType] || ["T2125"];
}

export function getCodesForForm(form: TaxForm): TaxCode[] {
  return CRA_TAX_CODES.filter(tc => tc.form === form);
}

export function getTaxCodeForCategory(category: string, form?: TaxForm): TaxCode | null {
  const codes = form ? CRA_TAX_CODES.filter(tc => tc.form === form) : CRA_TAX_CODES;
  return codes.find(tc => tc.categories.includes(category)) || null;
}

export function getCategoriesForTaxCode(code: string): string[] {
  const taxCode = CRA_TAX_CODES.find(tc => tc.code === code);
  return taxCode?.categories || [];
}

export function getFormLabel(form: TaxForm): string {
  switch (form) {
    case "T2125": return "T2125 — Business & Professional Income";
    case "T776": return "T776 — Rental Income";
    case "T2200": return "T2200 — Employment Expenses";
    case "T3": return "T3 — Trust Income";
    case "T1": return "T1 — Personal Income";
    default: return form;
  }
}