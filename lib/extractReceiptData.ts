export type LineItem = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ExtractedReceiptData = {
  vendor: string | null;
  date: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  line_items: LineItem[];
  raw_text: string;
  confidence: number;
  payment_method: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  card_entry_method: string | null;
};

export async function extractReceiptData(
  imageUrl: string
): Promise<ExtractedReceiptData> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    throw new Error("Google Vision API key not configured");
  }

  try {
    const imageResponse = await fetch(imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: "DOCUMENT_TEXT_DETECTION" },
                { type: "TEXT_DETECTION" },
              ],
            },
          ],
        }),
      }
    );

    const visionData = await visionResponse.json();

    if (!visionResponse.ok) {
      throw new Error(visionData.error?.message || "Vision API request failed");
    }

    const response = visionData.responses?.[0];
    const annotations = response?.textAnnotations;

    if (!annotations || annotations.length === 0) {
      return {
        vendor: null,
        date: null,
        total_cents: null,
        tax_cents: null,
        line_items: [],
        raw_text: "",
        confidence: 0,
        payment_method: null,
        card_brand: null,
        card_last_four: null,
        card_entry_method: null,
      };
    }

    const fullText = annotations[0]?.description || "";
    const extracted = parseReceiptText(fullText);

    return {
      ...extracted,
      raw_text: fullText,
      confidence: 85,
    };
  } catch (error: any) {
    console.error("OCR extraction failed:", error);
    throw new Error(error.message || "Failed to extract receipt data");
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Remove spaces within a number like "21. 44" -> "21.44" */
function cleanNumber(str: string): string {
  return str.replace(/(\d+)\s*\.\s*(\d+)/, "$1.$2").replace(/,/g, "");
}

/** Parse a dollar amount string to cents */
function parseCents(str: string): number | null {
  const cleaned = cleanNumber(str.replace(/[$CAD\s]/g, ""));
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 100000) return null;
  return Math.round(num * 100);
}

// ── VENDOR EXTRACTION ─────────────────────────────────────────────────────────

const KNOWN_VENDORS = [
  "FORTINOS", "SHOPPERS DRUG MART", "SHOPPERS", "HARVEY'S", "HARVEYS",
  "TIM HORTONS", "STARBUCKS", "MCDONALDS", "SUBWAY", "WALMART", "COSTCO",
  "CANADIAN TIRE", "STAPLES", "HOME DEPOT", "BEST BUY", "AMAZON",
  "SHELL", "ESSO", "PETRO-CANADA", "PETRO CANADA", "CHEVRON",
  "ROGERS", "BELL", "TELUS", "LOBLAWS", "SOBEYS", "METRO",
  "NO FRILLS", "FOOD BASICS", "FRESHCO", "DOLLARAMA", "RONA",
  "LCBO", "THE BEER STORE", "SECOND CUP", "A&W", "BURGER KING",
  "PIZZA PIZZA", "DOMINOS", "KFC", "POPEYES", "WENDY'S",
];

function extractVendor(lines: string[]): string | null {
  const nonEmpty = lines.filter(l => l.trim().length > 2);

  // Check first 5 lines for known vendors
  for (let i = 0; i < Math.min(5, nonEmpty.length); i++) {
    const upper = nonEmpty[i].toUpperCase();
    for (const vendor of KNOWN_VENDORS) {
      if (upper.includes(vendor)) {
        return vendor === "HARVEY'S" ? "HARVEY'S" :
          vendor.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
      }
    }
  }

  // Skip lines that look like addresses, phones, dates, separators
  const skipPatterns = [
    /^\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
    /\d{3,5}\s+\w+\s+(st|ave|rd|blvd|dr|way|ln)/i,
    /^(apr|may|jun|jul|aug|sep|oct|nov|dec|jan|feb|mar)/i,
    /^\d{4}[-/]\d{2}[-/]\d{2}/,
    /^[*=\-_]{3,}/,
    /receipt|invoice|tax|hst|gst|total|subtotal/i,
  ];

  for (let i = 0; i < Math.min(5, nonEmpty.length); i++) {
    const line = nonEmpty[i].trim();
    if (skipPatterns.some(p => p.test(line))) continue;
    if (line.length >= 3 && line.length <= 50 && /[a-zA-Z]/.test(line)) {
      if (/^[A-Z\s'&.-]+$/.test(line) || /^[A-Z][a-z]/.test(line)) {
        return line;
      }
    }
  }

  return nonEmpty[0] || null;
}

// ── DATE EXTRACTION ───────────────────────────────────────────────────────────

function extractDate(lines: string[]): string | null {
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  for (const line of lines) {
    // Named month: "Apr 03, 2026" or "Apr03'26" or "Apr04'26 04:11P"
    const namedMatch = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s']*(\d{1,2})[,\s']*(\d{2,4})/i);
    if (namedMatch) {
      const month = monthMap[namedMatch[1].toLowerCase().slice(0, 3)];
      const day = namedMatch[2].padStart(2, "0");
      let year = namedMatch[3];
      if (year.length === 2) year = "20" + year;
      return `${year}-${month}-${day}`;
    }

    // YY/MM/DD (Fortinos: "26/04/03", Shoppers: "26/04/03")
    const yymmdd = line.match(/\b(\d{2})[/](\d{2})[/](\d{2})\b/);
    if (yymmdd) {
      const year = "20" + yymmdd[1];
      const month = yymmdd[2].padStart(2, "0");
      const day = yymmdd[3].padStart(2, "0");
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // DD/MM/YYYY
    const numMatch = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
    if (numMatch) {
      const month = numMatch[2].padStart(2, "0");
      const day = numMatch[1].padStart(2, "0");
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${numMatch[3]}-${month}-${day}`;
      }
    }

    // YYYY-MM-DD
    const isoMatch = line.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }
  }

  return null;
}

// ── TOTAL EXTRACTION ──────────────────────────────────────────────────────────

function extractTotal(lines: string[]): number | null {
  let bestTotal: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/subtotal/i.test(line)) continue;

    // "TOTAL   21. 44" or "TOTAL: $21.44" — same line with possible spaces in number
    if (/^total/i.test(line)) {
      // Extract all number-like sequences from the line
      const nums = line.match(/[\d]+\s*\.?\s*[\d]*/g);
      if (nums) {
        for (const n of nums) {
          const cents = parseCents(n);
          if (cents && cents > 100 && (!bestTotal || cents > bestTotal)) {
            bestTotal = cents;
          }
        }
      }
      // Also check next line
      if (!bestTotal && i + 1 < lines.length) {
        const cents = parseCents(lines[i + 1]);
        if (cents && cents > 100) bestTotal = cents;
      }
      if (bestTotal) break;
    }

    // "CAD$ 21.44" or "CAD$21.44"
    const cadMatch = line.match(/CAD\$?\s*([\d\s,.]+)/i);
    if (cadMatch && !bestTotal) {
      const cents = parseCents(cadMatch[1]);
      if (cents && cents > 100) bestTotal = cents;
    }

    // "$30.83" alone on a line near TOTAL context
    if (/^\$[\d,.]+$/.test(line.trim())) {
      const cents = parseCents(line.trim());
      if (cents && cents > 100 && !bestTotal) bestTotal = cents;
    }
  }

  return bestTotal;
}

// ── TAX EXTRACTION ────────────────────────────────────────────────────────────

function extractTax(lines: string[]): number | null {
  const taxAmounts: number[] = [];
  let simpleTax: number | null = null;

  for (const line of lines) {
    // H=HST 13%   7.98 @ 13.000%   1.04 — take last number
    const hstAtRate = line.match(/(?:h=hst|hst|gst|pst)[^@]*@\s*[\d.]+%\s+([\d\s.]+)$/i);
    if (hstAtRate) {
      const cents = parseCents(hstAtRate[1]);
      if (cents && cents > 0 && cents < 10000) { taxAmounts.push(cents); continue; }
    }

    // PPD FD1   10.99 @ 13.000%   1.43 (Fortinos food tax)
    const ppdMatch = line.match(/ppd\s+fd\d[^@]*@\s*[\d.]+%\s+([\d\s.]+)$/i);
    if (ppdMatch) {
      const cents = parseCents(ppdMatch[1]);
      if (cents && cents > 0 && cents < 10000) { taxAmounts.push(cents); continue; }
    }

    // "HST :   3.18" or "HST   4.29" or "HST: 3.18"
    const simpleTaxMatch = line.match(/^(?:hst|gst|pst|qst|tax)[:\s=]+\$?\s*([\d\s,.]+)$/i);
    if (simpleTaxMatch) {
      const cents = parseCents(simpleTaxMatch[1]);
      if (cents && cents > 0 && cents < 10000) { simpleTax = cents; }
    }
  }

  // Fortinos has multiple tax lines — sum them
  if (taxAmounts.length > 0) {
    return taxAmounts.reduce((sum, t) => sum + t, 0);
  }

  return simpleTax;
}

// ── PAYMENT INFO ──────────────────────────────────────────────────────────────

function parsePaymentInfo(lines: string[]): {
  payment_method: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  card_entry_method: string | null;
} {
  let payment_method: string | null = null;
  let card_brand: string | null = null;
  let card_last_four: string | null = null;
  let card_entry_method: string | null = null;

  const cardBrands = [
    { pattern: /\bvisa\b|\bvis\b/i, name: "Visa" },
    { pattern: /\bmc\b|\bmastercard\b|\bmaster card\b/i, name: "Mastercard" },
    { pattern: /\bamex\b|\bamerican express\b/i, name: "Amex" },
    { pattern: /\bdiscover\b/i, name: "Discover" },
    { pattern: /\binterac\b/i, name: "Interac" },
  ];

  const paymentMethods = [
    { pattern: /\bcash\b/i, name: "Cash" },
    { pattern: /\bdebit\b/i, name: "Debit" },
    { pattern: /\bcredit\b/i, name: "Credit" },
    { pattern: /\be-?transfer\b/i, name: "E-Transfer" },
    { pattern: /\bcheque\b|\bcheck\b/i, name: "Cheque" },
    { pattern: /\bgift card\b/i, name: "Gift Card" },
    { pattern: /contactless/i, name: "Contactless" },
  ];

  const entryMethods = [
    { pattern: /contactless|tap/i, name: "Contactless/Tap" },
    { pattern: /\bchip\b|\binsert\b/i, name: "Chip/Insert" },
    { pattern: /\bswipe\b/i, name: "Swipe" },
    { pattern: /\bmanual\b|\bkey.?entered\b/i, name: "Manual Entry" },
  ];

  for (const line of lines) {
    const lastFourMatch =
      line.match(/[*xX]{2,}\s*(\d{4})\s*[P\s]?$/i) ||
      line.match(/[*xX]{4,}(\d{4})/i) ||
      line.match(/card\s+number[:\s]+[*xX]+(\d{4})/i) ||
      line.match(/\b(?:VIS|MC|AMX|AMEX|DISC)[:\s]+(\d{4})\b/i) ||
      line.match(/ending\s+(?:in\s+)?(\d{4})/i);

    if (lastFourMatch && !card_last_four) card_last_four = lastFourMatch[1];

    for (const brand of cardBrands) {
      if (brand.pattern.test(line) && !card_brand) card_brand = brand.name;
    }
    for (const method of paymentMethods) {
      if (method.pattern.test(line) && !payment_method) payment_method = method.name;
    }
    for (const entry of entryMethods) {
      if (entry.pattern.test(line) && !card_entry_method) card_entry_method = entry.name;
    }
  }

  if (card_brand && !payment_method) {
    if (card_brand === "Interac") payment_method = "Debit";
    else if (["Visa", "Mastercard", "Amex", "Discover"].includes(card_brand))
      payment_method = "Credit";
  }

  return { payment_method, card_brand, card_last_four, card_entry_method };
}

// ── LINE ITEM SKIP RULES ──────────────────────────────────────────────────────

const GLOBAL_SKIP_PATTERNS = [
  /^(subtotal|sub total|sub-total)/i,
  /^(total|order total|amount due|balance due)/i,
  /^(hst|gst|pst|qst|tax|h=hst|ppd\s+fd)/i,
  /^(cash|change|tender|payment|credit|debit|visa|mastercard|amex|interac)/i,
  /^(thank|visit|receipt|invoice|transaction|balance|approved|auth)/i,
  /^(register|cashier|clerk|store|phone|business\s+number)/i,
  /^(customer|retain|important|copy|records|expr|date.?time|reference)/i,
  /^(contactless|purchase|tip|gratuity|emv|terminal|application)/i,
  /^(card\s+number|card\s+type|acct|account|trans|ref\.?\s*#)/i,
  /^(rounded|survey|certificate|contest|optimum|pc\s+financial)/i,
  /^(www\.|http|tel:|fax:|\*{3,}|={3,}|-{5,})/i,
  /^cad\$?$/i,
  /^\d{10,}$/,
  /^[*=\-_]{3,}$/,
  /^\d+\s+items?\b/i,
  // Shoppers price duplicate: "4.49 GP" or "6.99 S"
  /^\$?[\d,.]+\s+[A-Z]{1,2}$/,
  // Fortinos category headers: "27-PRODUCE" or "36-HOME MEAL REPLACEMENT"
  /^\d{2}-[A-Z\s]+$/,
];

const TOPPING_KEYWORDS = [
  "pickle", "onion", "lettuce", "harvsauce", "hot sauce", "light harvsauce",
  "mg bun", "bun", "ketchup", "mustard", "tomato", "bacon", "mushroom",
  "no ", "add ", "sub ", "w/ ", "w.o.", "rings -", "ftn pop",
  "diet pepsi", "diet coke", "diet", "slushie", "frz lemon",
];

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;
  if (/[<>{}[\]\\|~`]/.test(trimmed)) return true;
  for (const pattern of GLOBAL_SKIP_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  const lower = trimmed.toLowerCase();
  for (const t of TOPPING_KEYWORDS) {
    if (lower.startsWith(t)) return true;
  }
  return false;
}

// ── LINE ITEM EXTRACTION ──────────────────────────────────────────────────────

function extractLineItems(lines: string[], expectedSubtotal: number | null): LineItem[] {
  const candidates: LineItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (shouldSkipLine(line)) continue;

    let item = parseLineItem(line);

    if (!item && i + 1 < lines.length) {
      item = parseMultiLineItem(line, lines[i + 1], lines[i + 2]);
      if (item) i++;
    }

    if (
      item &&
      item.description.length >= 2 &&
      item.total_cents > 0 &&
      item.total_cents < 1000000 &&
      item.unit_price_cents > 0 &&
      !shouldSkipLine(item.description) &&
      !/^\$?[\d\s,.]+$/.test(item.description)
    ) {
      candidates.push(item);
    }
  }

  if (expectedSubtotal && candidates.length > 0) {
    const sum = candidates.reduce((t, i) => t + i.total_cents, 0);
    const pctOff = Math.abs(sum - expectedSubtotal) / expectedSubtotal;
    if (pctOff <= 0.1) return candidates;

    let best = candidates;
    let bestDiff = Math.abs(sum - expectedSubtotal);
    for (let i = 0; i < candidates.length; i++) {
      const subset = candidates.filter((_, idx) => idx !== i);
      const subSum = subset.reduce((t, item) => t + item.total_cents, 0);
      const diff = Math.abs(subSum - expectedSubtotal);
      if (diff < bestDiff) { best = subset; bestDiff = diff; }
    }
    const finalPct = expectedSubtotal > 0 ? bestDiff / expectedSubtotal : 1;
    return finalPct <= 0.15 ? best : candidates;
  }

  return candidates;
}

function parseLineItem(line: string): LineItem | null {
  // Harvey's style: "1 Apple Pie   1.89" or "1 Grill Ckn Cb   13.29"
  const harveyStyle = /^(\d+)\s+(.{2,40}?)\s{2,}([\d\s,.]+)$/;
  let match = line.match(harveyStyle);
  if (match) {
    const qty = parseInt(match[1]);
    const desc = match[2].trim();
    const total = parseCents(match[3]);
    if (total && qty > 0 && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: qty, unit_price_cents: Math.round(total / qty), total_cents: total };
    }
  }

  // Shoppers style: "GATORADE DRINK   4.49 GP   4.49" — take first price, ignore suffix
  const shoppersStyle = /^([A-Z][A-Z\s]+?)\s+([\d,.]+)\s+[A-Z]{1,2}\s+([\d,.]+)$/;
  match = line.match(shoppersStyle);
  if (match) {
    const desc = match[1].trim();
    const price = parseCents(match[2]);
    if (price && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  // Generic with 2+ spaces separator: "DESCRIPTION   price"
  const genericPattern = /^(.{2,50}?)\s{2,}\$?([\d\s,.]+)$/;
  match = line.match(genericPattern);
  if (match) {
    const desc = match[1].trim();
    const total = parseCents(match[2]);
    if (
      total && total > 0 && total < 100000 &&
      /[a-zA-Z]{2,}/.test(desc) &&
      !shouldSkipLine(desc) &&
      !/^\d+$/.test(desc)
    ) {
      return { description: desc, quantity: 1, unit_price_cents: total, total_cents: total };
    }
  }

  // Simple end: "DESCRIPTION price" with single space
  const simpleEnd = /^(.{3,60}?)\s+\$?([\d,]+\.\d{2})$/;
  match = line.match(simpleEnd);
  if (match) {
    const desc = match[1].trim();
    const price = parseCents(match[2]);
    if (
      price && price >= 25 && price < 100000 &&
      /[a-zA-Z]{2,}/.test(desc) &&
      !shouldSkipLine(desc) &&
      !/^\d+(\.\d+)?$/.test(desc)
    ) {
      return { description: desc, quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  return null;
}

function parseMultiLineItem(line1: string, line2: string, line3?: string): LineItem | null {
  if (shouldSkipLine(line1)) return null;

  // Fortinos style: "(2)barcode GH GINGER 60ML" + "2 @ $3.99   7.98"
  const fortinosQty = line2.match(/^(\d+)\s*@\s*\$?([\d\s,.]+)\s+([\d\s,.]+)$/);
  if (fortinosQty) {
    const qty = parseInt(fortinosQty[1]);
    const unit = parseCents(fortinosQty[2]);
    const total = parseCents(fortinosQty[3]);
    // Strip barcode prefix from description
    const desc = line1.replace(/^\(\d+\)\d+\s+/, "").replace(/\d{8,}\s+/, "").trim();
    if (unit && total && qty > 0 && desc.length >= 2) {
      return { description: desc, quantity: qty, unit_price_cents: unit, total_cents: total };
    }
  }

  // Price only on next line
  const priceOnly = line2.match(/^\$?([\d\s,.]+)$/);
  if (priceOnly) {
    const price = parseCents(priceOnly[1]);
    if (
      price && price >= 25 && price < 100000 &&
      /[a-zA-Z]{2,}/.test(line1) &&
      !shouldSkipLine(line1) &&
      line1.length >= 3 && line1.length <= 60
    ) {
      const notProduct = /^(date|time|order|register|store|phone|address|thank|customer)/i;
      if (notProduct.test(line1)) return null;
      return { description: line1.trim(), quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  return null;
}

// ── MAIN PARSER ───────────────────────────────────────────────────────────────

function parseReceiptText(text: string): {
  vendor: string | null;
  date: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  line_items: LineItem[];
  payment_method: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  card_entry_method: string | null;
} {
  const lines = text.split("\n").map(l => l.trim());

  const vendor = extractVendor(lines);
  const date = extractDate(lines);
  const total_cents = extractTotal(lines);
  const tax_cents = extractTax(lines);
  const { payment_method, card_brand, card_last_four, card_entry_method } = parsePaymentInfo(lines);

  const expectedSubtotal = total_cents && tax_cents ? total_cents - tax_cents : null;
  const line_items = extractLineItems(lines, expectedSubtotal);

  return { vendor, date, total_cents, tax_cents, line_items, payment_method, card_brand, card_last_four, card_entry_method };
}