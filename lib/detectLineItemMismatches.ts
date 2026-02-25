// lib/detectLineItemMismatches.ts - Detect when line items don't match vendor category

const FOOD_KEYWORDS = [
  "gum",
  "candy",
  "chocolate",
  "chips",
  "snack",
  "soda",
  "pop",
  "drink",
  "water",
  "juice",
  "energy drink",
  "coffee",
  "tea",
  "cookie",
  "granola",
  "protein bar",
];

const OFFICE_KEYWORDS = [
  "paper",
  "pen",
  "pencil",
  "marker",
  "highlighter",
  "notebook",
  "binder",
  "folder",
  "stapler",
  "tape",
  "clip",
  "toner",
  "ink",
  "printer",
  "envelope",
  "label",
];

const PERSONAL_KEYWORDS = [
  "shampoo",
  "soap",
  "lotion",
  "toothpaste",
  "deodorant",
  "tissue",
  "toilet paper",
  "paper towel",
  "cleaning",
  "detergent",
];

export type LineItemCategory = "office" | "food" | "personal" | "unknown";

export function categorizeLineItem(description: string): LineItemCategory {
  const desc = description.toLowerCase().trim();
  
  // Check for food items
  for (const keyword of FOOD_KEYWORDS) {
    if (desc.includes(keyword)) {
      return "food";
    }
  }
  
  // Check for personal items
  for (const keyword of PERSONAL_KEYWORDS) {
    if (desc.includes(keyword)) {
      return "personal";
    }
  }
  
  // Check for office items
  for (const keyword of OFFICE_KEYWORDS) {
    if (desc.includes(keyword)) {
      return "office";
    }
  }
  
  return "unknown";
}

export type MismatchResult = {
  hasMismatch: boolean;
  mismatchedItems: {
    description: string;
    detectedCategory: LineItemCategory;
    expectedCategory: string;
  }[];
  flagMessage?: string;
};

export function detectLineItemMismatches(
  vendorCategory: string,
  lineItems: { description: string }[]
): MismatchResult {
  if (!lineItems || lineItems.length === 0) {
    return {
      hasMismatch: false,
      mismatchedItems: [],
    };
  }

  const mismatchedItems: MismatchResult["mismatchedItems"] = [];
  
  // Office supplies vendor
  if (vendorCategory.includes("Office Supplies")) {
    for (const item of lineItems) {
      const itemCategory = categorizeLineItem(item.description);
      
      if (itemCategory === "food") {
        mismatchedItems.push({
          description: item.description,
          detectedCategory: "food",
          expectedCategory: "Office Supplies",
        });
      } else if (itemCategory === "personal") {
        mismatchedItems.push({
          description: item.description,
          detectedCategory: "personal",
          expectedCategory: "Office Supplies",
        });
      }
    }
  }
  
  // Meals & Entertainment vendor
  if (vendorCategory.includes("Meals & Entertainment")) {
    for (const item of lineItems) {
      const itemCategory = categorizeLineItem(item.description);
      
      if (itemCategory === "office") {
        mismatchedItems.push({
          description: item.description,
          detectedCategory: "office",
          expectedCategory: "Meals & Entertainment",
        });
      }
    }
  }
  
  // Vehicle expenses vendor
  if (vendorCategory.includes("Vehicle")) {
    for (const item of lineItems) {
      const itemCategory = categorizeLineItem(item.description);
      
      if (itemCategory === "food" || itemCategory === "office") {
        mismatchedItems.push({
          description: item.description,
          detectedCategory: itemCategory,
          expectedCategory: "Vehicle Expenses",
        });
      }
    }
  }

  if (mismatchedItems.length === 0) {
    return {
      hasMismatch: false,
      mismatchedItems: [],
    };
  }

  // Generate flag message
  const itemList = mismatchedItems
    .map(item => `"${item.description}" (${item.detectedCategory})`)
    .join(", ");
  
  const flagMessage = 
    `⚠️ Line item mismatch detected at ${vendorCategory} vendor: ${itemList}. ` +
    `These items may need different categorization. Please review.`;

  return {
    hasMismatch: true,
    mismatchedItems,
    flagMessage,
  };
}