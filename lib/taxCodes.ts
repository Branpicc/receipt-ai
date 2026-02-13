export type TaxCode = {
  code: string;
  line: string;
  name: string;
  description: string;
  deductible_percent: number;
  gst_eligible: boolean;
  categories: string[];
};

export const CRA_TAX_CODES: TaxCode[] = [
  {
    code: "9270",
    line: "Line 9270",
    name: "Advertising",
    description: "Advertising costs including online ads, print, radio, TV",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Advertising & Promotion"],
  },
  {
    code: "9819",
    line: "Line 9819", 
    name: "Business Tax, Fees, Licenses",
    description: "Business registration, licenses, permits",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Bank Charges & Interest"],
  },
  {
    code: "8523",
    line: "Line 8523",
    name: "Meals and Entertainment",
    description: "Food and entertainment for business purposes",
    deductible_percent: 50,
    gst_eligible: true,
    categories: ["Meals & Entertainment"],
  },
  {
    code: "8960",
    line: "Line 8960",
    name: "Office Expenses",
    description: "Office supplies, postage, stationery",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Office Supplies & Expenses", "Software & Subscriptions"],
  },
  {
    code: "9060",
    line: "Line 9060",
    name: "Property Taxes",
    description: "Property taxes for business premises",
    deductible_percent: 100,
    gst_eligible: false,
    categories: [],
  },
  {
    code: "9200",
    line: "Line 9200",
    name: "Rent",
    description: "Rent for business premises or equipment",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Rent & Lease"],
  },
  {
    code: "9281",
    line: "Line 9281",
    name: "Motor Vehicle Expenses",
    description: "Fuel, maintenance, insurance for business vehicles",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Vehicle Expenses & Fuel"],
  },
  {
    code: "9220",
    line: "Line 9220",
    name: "Repairs and Maintenance",
    description: "Repairs to business property or equipment",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Repairs & Maintenance", "Equipment & Tools"],
  },
  {
    code: "8690",
    line: "Line 8690",
    name: "Telephone and Utilities",
    description: "Phone, internet, electricity, water, heat",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Telephone & Internet", "Utilities"],
  },
  {
    code: "8860",
    line: "Line 8860",
    name: "Professional Fees",
    description: "Accounting, legal, consulting fees",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Professional Fees"],
  },
  {
    code: "9804",
    line: "Line 9804",
    name: "Insurance",
    description: "Business insurance premiums",
    deductible_percent: 100,
    gst_eligible: false,
    categories: ["Insurance"],
  },
  {
    code: "9275",
    line: "Line 9275",
    name: "Travel",
    description: "Airfare, hotels, meals while traveling for business",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Travel Expenses"],
  },
  {
    code: "9936",
    line: "Line 9936",
    name: "Other Expenses",
    description: "Any other allowable business expenses",
    deductible_percent: 100,
    gst_eligible: true,
    categories: ["Other Expenses"],
  },
];

export function getTaxCodeForCategory(category: string): TaxCode | null {
  return CRA_TAX_CODES.find(tc => 
    tc.categories.includes(category)
  ) || null;
}

export function getCategoriesForTaxCode(code: string): string[] {
  const taxCode = CRA_TAX_CODES.find(tc => tc.code === code);
  return taxCode?.categories || [];
}