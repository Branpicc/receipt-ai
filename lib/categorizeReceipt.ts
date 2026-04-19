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
  GIFTS: {
    name: "Advertising & Promotion",
    deductible: 100,
    gst_hst_eligible: true,
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
"amazon",
    "best buy", "bestbuy", "staples business", "fellows", "avery",
    "uline", "viking", "reliable", "quill", "bulk barn office",
    "costco business", "walmart office",
  ],
  MEALS: [
    "tim hortons", "starbucks", "mcdonalds", "mcdonald",
    "subway", "heal wellness", "heal", "restaurant", "cafe", "coffee", "pizz",
    "burger", "food", "keg", "canoe", "grill", "bistro",
    "bar", "pub", "diner", "steakhouse", "tavern", "eatery",
    "kitchen", "harvey", "wendy", "dairy queen", "dq",
    "a&w", "popeyes", "kfc", "taco bell", "chipotle",
    "five guys", "swiss chalet", "montana", "east side",
    "boston pizza", "pizza pizza", "domino", "papa john",
    "sushi", "pho", "ramen", "thai", "indian", "chinese",
"greek", "italian", "french", "mexican", "bbq",
    "toast", "toasttab", "square", "mcdonald", "burger king",
    "freshii", "mary browns", "mucho burrito", "qdoba",
    "pita pit", "mr sub", "quiznos", "arby", "sonic",
    "panera", "nandos", "jack astor", "joeys", "milestones",
    "earls", "cactus club", "original joe", "moxie",
    "bp's", "bier markt", "firkin", "kelsey", "montanas",
    "red lobster", "olive garden", "ihop", "denny",
    "breakfast", "brunch", "lunch", "dinner", "eatery",
    "wings", "poutine", "shawarma", "falafel", "kebab",
    "dumpling", "noodle", "curry", "tandoori", "buffet",
    "catering", "tim", "horton", "second cup", "country style",
    "robin", "donut", "bagel", "bakery", "patisserie",
    "creperie", "boulangerie", "trattoria", "osteria",
    "heal", "jugo juice", "booster juice", "orange julius",
    "poke", "acai", "smoothie", "bubble tea", "boba",
  ],
    EQUIPMENT: [
    "ebgames", "eb games", "best buy", "bestbuy",
    "staples", "canada computers", "memory express",
    "apple store", "microsoft store", "dell",
"nintendo", "playstation", "xbox", "gaming",
    "henry's", "vistek", "london drugs", "visions electronics",
    "factory direct", "tiger direct", "pc express",
    "dell", "lenovo", "hp", "apple", "samsung",
    "logitech", "brother", "epson", "canon", "nikon",
    "tools", "equipment", "machinery", "hardware",
    "home depot tools", "princess auto", "rona tools",
  ],
      VEHICLE: [
    "shell",
    "esso",
    "petro-canada",
    "petro canada",
    "chevron",
    "husky",
    "canadian tire gas",
    "costco gas",
    "petro", "shell", "esso", "husky", "ultramar",
"pioneer", "canadian tire", "circle k",
    "ultramar", "irving", "sunoco", "mobil", "bp",
    "speedway", "couche-tard", "mac", "needs",
    "midas", "mr lube", "jiffy lube", "oil change",
    "car wash", "auto", "napa auto", "lordco",
    "canadian tire auto", "active green", "kal tire",
    "fountain tire", "ok tire", "sears auto",
    "meineke", "monro", "pep boys", "advance auto",
    "enterprise", "hertz", "avis", "budget rental",
    "national car", "discount car", "driving",
    "parking", "impark", "indigo", "greenp",
    "407 etr", "highway", "toll",
  ],

  TELECOM: [
    "rogers",
    "bell",
    "telus",
    "fido",
    "koodo",
    "virgin mobile",
"freedom mobile",
    "wind mobile", "public mobile", "chatr", "lucky mobile",
    "shaw", "videotron", "eastlink", "tbaytel",
    "xplornet", "distributel", "teksavvy",
    "rogers wireless", "bell mobility", "telus mobility",
    "internet", "phone", "wireless", "cellular", "data plan",
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
    "google ads",
    "facebook",
    "meta",
"linkedin",
    "github", "gitlab", "bitbucket", "jira", "confluence",
    "hubspot", "salesforce", "mailchimp", "klaviyo",
    "figma", "sketch", "canva", "invision",
    "notion", "asana", "monday", "trello", "basecamp",
    "zendesk", "intercom", "freshdesk", "helpscout",
    "stripe", "paypal", "square", "shopify payments",
    "aws", "azure", "google cloud", "digitalocean", "heroku",
    "vercel", "netlify", "cloudflare", "godaddy", "namecheap",
    "sendgrid", "twilio", "mailgun", "postmark",
    "supabase", "firebase", "mongodb", "planetscale",
    "anthropic", "openai", "cursor", "copilot",
    "1password", "lastpass", "norton", "mcafee", "bitdefender",
    "webex", "teams", "google meet", "whereby",
    "loom", "grammarly", "calendly", "docusign",
    "quickbooks", "freshbooks", "wave", "xero", "sage",
    "subscription", "saas", "software", "licence", "license",
  ],
    PROFESSIONAL_FEES: [
    "deloitte",
    "pwc",
    "kpmg",
    "ey",
    "mccarthy",
"legal", "law",
    "accounting", "accountant", "bookkeeping", "bookkeeper",
    "consultant", "consulting", "advisor", "advisory",
    "notary", "paralegal", "barrister", "solicitor",
    "bdo", "grant thornton", "mns", "crowe",
    "hr block", "h&r block", "turbotax", "wealthsimple tax",
    "recruiter", "staffing", "hays", "robert half",
    "manpower", "adecco", "randstad",
    "marketing agency", "design agency", "pr agency",
    "architect", "engineer", "surveyor",
  ],
    GIFTS: [
    "flowers", "florist", "1-800-flowers", "ftd",
"hallmark", "gift", "basket",
    "1800flowers", "teleflora", "proflowers",
    "edible arrangements", "godiva", "lindt",
    "wine rack", "lcbo", "saq", "wine", "spirits",
    "chapters", "indigo", "coles", "amazon gift",
    "spa", "massage", "treat", "reward",
    "client gift", "promotional", "swag",
  ],
    RENT: [
"cadillac fairview", "wework", "regus",
    "ivanhoé cambridge", "oxford properties", "brookfield",
    "allied reit", "dream office", "slate",
    "spaces", "shift", "desk", "cowork", "coworking",
    "office space", "commercial rent", "lease",
    "property management", "landlord",
  ],
  TRAVEL: [
    "air canada", "westjet", "porter", "swoop", "flair",
    "american airlines", "united", "delta", "southwest",
    "airbnb", "vrbo", "booking", "hotels.com", "expedia",
    "marriott", "hilton", "hyatt", "ihg", "best western",
    "delta hotels", "sheraton", "westin", "four seasons",
    "holiday inn", "comfort inn", "days inn", "super 8",
    "via rail", "amtrak", "greyhound", "megabus",
    "uber", "lyft", "taxi", "cab", "limo",
    "conference", "hotel", "motel", "inn", "resort",
    "flight", "airline", "airport", "train", "transit",
  ],
  ADVERTISING: [
    "google ads", "facebook ads", "instagram ads",
    "tiktok ads", "twitter ads", "linkedin ads",
    "youtube ads", "pinterest ads", "snapchat ads",
    "mailchimp", "klaviyo", "constant contact",
    "hootsuite", "buffer", "sprout social",
    "flyer", "billboard", "signage", "print",
    "newspaper", "magazine", "radio", "television",
    "sponsorship", "promotion", "marketing",
    "seo", "sem", "ppc", "digital marketing",
    "branding", "logo", "design", "creative",
  ],
  INSURANCE: [
    "intact", "aviva", "co-operators", "wawanesa",
    "belairdirect", "td insurance", "rbc insurance",
    "manulife", "sunlife", "great-west life", "canada life",
    "blue cross", "green shield", "desjardins insurance",
    "allstate", "state farm", "industrial alliance",
    "insurance", "premium", "coverage", "policy",
  ],
  UTILITIES: [
    "hydro one", "toronto hydro", "bc hydro", "enmax",
    "atco gas", "union gas", "enbridge", "fortis",
    "epcor", "nova scotia power", "nb power", "newfoundland power",
    "water", "electricity", "gas utility", "hydro",
    "waste management", "bin", "recycling",
  ],
  REPAIRS: [
    "rona", "home depot", "lowes", "canadian tire repair",
    "plumber", "electrician", "hvac", "furnace",
    "appliance repair", "computer repair", "phone repair",
    "geek squad", "ubreakifix", "fix", "repair", "maintenance",
    "cleaning", "janitorial", "landscaping", "snow removal",
    "pest control", "locksmith", "glazier",
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

  // Lower threshold to 60% for better coverage
  if (confidence < 60) {
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
    needs_review: confidence < 80, // Still flag for review if < 80%
  };
}