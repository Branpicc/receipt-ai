// Canadian tax categories for CRA compliance
export const TAX_CATEGORIES = {
  OFFICE_SUPPLIES: {
    name: "Office Supplies & Expenses",
    deductible: 100,
    gst_hst_eligible: true,
  },
  MEALS: {
    name: "Meals & Entertainment",
    deductible: 50,
    gst_hst_eligible: true,
    note: "50% deductible per CRA",
  },
  VEHICLE: {
    name: "Vehicle Expenses & Fuel",
    deductible: 100,
    gst_hst_eligible: true,
  },
  TRAVEL: {
    name: "Travel Expenses",
    deductible: 100,
    gst_hst_eligible: true,
  },
  ADVERTISING: {
    name: "Advertising & Promotion",
    deductible: 100,
    gst_hst_eligible: true,
  },
  PROFESSIONAL_FEES: {
    name: "Professional Fees",
    deductible: 100,
    gst_hst_eligible: true,
  },
  TELECOM: {
    name: "Telephone & Internet",
    deductible: 100,
    gst_hst_eligible: true,
  },
  INSURANCE: {
    name: "Insurance",
    deductible: 100,
    gst_hst_eligible: false,
  },
  RENT: {
    name: "Rent & Lease",
    deductible: 100,
    gst_hst_eligible: true,
  },
  REPAIRS: {
    name: "Repairs & Maintenance",
    deductible: 100,
    gst_hst_eligible: true,
  },
  UTILITIES: {
    name: "Utilities",
    deductible: 100,
    gst_hst_eligible: true,
  },
  BANK_CHARGES: {
    name: "Bank Charges & Interest",
    deductible: 100,
    gst_hst_eligible: false,
  },
  SOFTWARE: {
    name: "Software & Subscriptions",
    deductible: 100,
    gst_hst_eligible: true,
  },
  EQUIPMENT: {
    name: "Equipment & Tools",
    deductible: 100,
    gst_hst_eligible: true,
    note: "May be capital asset - verify with accountant",
  },
  OTHER: {
    name: "Other Expenses",
    deductible: 100,
    gst_hst_eligible: true,
  },
} as const;

// Vendor patterns (high confidence matches)
const VENDOR_PATTERNS = {
  OFFICE_SUPPLIES: [
    "staples",
    "office depot",
    "grand & toy",
    "bureau en gros",
  ],
  MEALS: [
    "tim hortons",
    "starbucks",
    "mcdonalds",
    "subway",
    "restaurant",
    "cafe",
    "coffee",
    "pizz",
    "burger",
    "food",
  ],
  VEHICLE: [
    "shell",
    "esso",
    "petro-canada",
    "chevron",
    "husky",
    "canadian tire gas",
    "costco gas",
  ],
  TELECOM: [
    "rogers",
    "bell",
    "telus",
    "fido",
    "koodo",
    "virgin mobile",
    "freedom mobile",
  ],
  SOFTWARE: [
    "microsoft",
    "adobe",
    "dropbox",
    "zoom",
    "slack",
    "shopify",
    "quickbooks",
    "google workspace",
  ],
};

// Purpose keywords (medium confidence)
const PURPOSE_KEYWORDS = {
  OFFICE_SUPPLIES: [
    "paper",
    "pens",
    "printer",
    "ink",
    "toner",
    "office",
    "supplies",
    "stationery",
  ],
  MEALS: [
    "lunch",
    "dinner",
    "breakfast",
    "coffee",
    "meal",
    "client meeting",
    "business meal",
  ],
  VEHICLE: [
    "gas",
    "fuel",
    "gasoline",
    "diesel",
    "vehicle",
    "car",
    "mileage",
  ],
  TRAVEL: [
    "hotel",
    "flight",
    "airbnb",
    "accommodation",
    "travel",
    "conference",
  ],
  ADVERTISING: [
    "ad",
    "marketing",
    "promotion",
    "advertising",
    "facebook ads",
    "google ads",
  ],
  PROFESSIONAL_FEES: [
    "accountant",
    "lawyer",
    "consultant",
    "legal",
    "accounting",
  ],
  REPAIRS: [
    "repair",
    "maintenance",
    "fix",
  ],
  SOFTWARE: [
    "software",
    "subscription",
    "saas",
    "app",
    "service",
  ],
};

export type CategorizationResult = {
  suggested_category: string | null;
  category_confidence: number;
  category_reasoning: string;
  needs_review: boolean;
};

export function categorizeReceipt(
  vendor: string | null,
  purpose: string | null
): CategorizationResult {
  const vendorLower = (vendor || "").toLowerCase().trim();
  const purposeLower = (purpose || "").toLowerCase().trim();

  // If no vendor and no purpose, can't categorize
  if (!vendorLower && !purposeLower) {
    return {
      suggested_category: null,
      category_confidence: 0,
      category_reasoning: "No vendor or purpose information provided",
      needs_review: true,
    };
  }

  let bestCategory: string | null = null;
  let confidence = 0;
  let reasons: string[] = [];

  // Check vendor patterns (high confidence)
  for (const [category, patterns] of Object.entries(VENDOR_PATTERNS)) {
    for (const pattern of patterns) {
      if (vendorLower.includes(pattern)) {
        confidence += 60;
        reasons.push(`Vendor matches ${category.toLowerCase()} (${pattern})`);
        bestCategory = category;
        break;
      }
    }
    if (bestCategory) break;
  }

  // Check purpose keywords (adds confidence)
  if (purposeLower) {
    for (const [category, keywords] of Object.entries(PURPOSE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (purposeLower.includes(keyword)) {
          if (bestCategory === category) {
            confidence += 25; // Vendor + purpose match = very high confidence
            reasons.push(`Purpose confirms ${category.toLowerCase()} (${keyword})`);
          } else if (!bestCategory) {
            confidence += 40; // Purpose-only match
            reasons.push(`Purpose suggests ${category.toLowerCase()} (${keyword})`);
            bestCategory = category;
          }
          break;
        }
      }
      if (bestCategory && confidence >= 80) break;
    }
  }

  // Conservative threshold: only suggest if 80%+ confident
  if (confidence < 80) {
    return {
      suggested_category: null,
      category_confidence: confidence,
      category_reasoning: reasons.length > 0 
        ? `Low confidence: ${reasons.join("; ")}` 
        : "Unable to determine category with sufficient confidence",
      needs_review: true,
    };
  }

  // Map internal category key to display name
  const categoryKey = bestCategory as keyof typeof TAX_CATEGORIES;
  const categoryInfo = TAX_CATEGORIES[categoryKey];

  return {
    suggested_category: categoryInfo.name,
    category_confidence: Math.min(confidence, 95), // Cap at 95%
    category_reasoning: reasons.join("; "),
    needs_review: false,
  };
}
