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

function cleanNumber(str: string): string {
  return str.replace(/(\d+)\s*\.\s*(\d+)/, "$1.$2").replace(/,/g, "");
}

function parseCents(str: string): number | null {
  // Handle CDN$, CA$, CAD$, C$
  const cleaned = cleanNumber(str.replace(/[$\s]|CAD|CDN|CA\b|C\b/gi, ""));
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 100000) return null;
  return Math.round(num * 100);
}

// ── VENDOR EXTRACTION ─────────────────────────────────────────────────────────

const KNOWN_VENDORS = [
  "FORTINOS", "SHOPPERS DRUG MART", "SHOPPERS", "HARVEY'S", "HARVEYS",
  "TIM HORTONS", "TIM HORTON", "STARBUCKS", "MCDONALDS", "MCDONALD'S",
  "SUBWAY", "WALMART", "COSTCO", "CANADIAN TIRE", "STAPLES",
  "HOME DEPOT", "BEST BUY", "AMAZON", "SHELL", "ESSO",
  "PETRO-CANADA", "PETRO CANADA", "HUSKY", "CHEVRON",
  "ROGERS", "BELL", "TELUS", "LOBLAWS", "SOBEYS", "METRO",
  "NO FRILLS", "FOOD BASICS", "FRESHCO", "DOLLARAMA", "RONA",
  "LCBO", "THE BEER STORE", "SECOND CUP", "A&W", "BURGER KING",
  "PIZZA PIZZA", "DOMINOS", "KFC", "POPEYES", "WENDY'S",
  "NINTENDO", "META", "FACEBOOK", "GOOGLE", "MICROSOFT", "APPLE",
  "NETFLIX", "SPOTIFY", "ADOBE", "DROPBOX", "ZOOM", "SLACK",
];

function extractVendor(lines: string[]): string | null {
  const nonEmpty = lines.filter(l => l.trim().length > 2);

  // Check first 6 lines for known vendors
  for (let i = 0; i < Math.min(6, nonEmpty.length); i++) {
    const upper = nonEmpty[i].toUpperCase();
    for (const vendor of KNOWN_VENDORS) {
      if (upper.includes(vendor)) {
        if (vendor === "HARVEY'S" || vendor === "HARVEYS") return "HARVEY'S";
        if (vendor === "TIM HORTON" || vendor === "TIM HORTONS") return "Tim Hortons";
        if (vendor === "PETRO-CANADA" || vendor === "PETRO CANADA") return "Petro-Canada";
        if (vendor === "SHOPPERS DRUG MART" || vendor === "SHOPPERS") return "Shoppers Drug Mart";
        return vendor.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
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
    /^(take\s+out|drive\s+thru|dine\s+in|order\s*#)/i,
  ];

  for (let i = 0; i < Math.min(6, nonEmpty.length); i++) {
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
    // "DATE: 2021-05-08" or "Transaction Date: 02/23/2026"
    const labeledDate = line.match(/(?:date|placed\s+on)[:\s]+(.+)/i);
    if (labeledDate) {
      const datePart = labeledDate[1].trim();
      // Try to parse the date part
      const isoInLabel = datePart.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
      if (isoInLabel) {
        return `${isoInLabel[1]}-${isoInLabel[2].padStart(2, "0")}-${isoInLabel[3].padStart(2, "0")}`;
      }
      const numInLabel = datePart.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
      if (numInLabel) {
        return `${numInLabel[3]}-${numInLabel[2].padStart(2, "0")}-${numInLabel[1].padStart(2, "0")}`;
      }
      const namedInLabel = datePart.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
      if (namedInLabel) {
        const month = monthMap[namedInLabel[1].toLowerCase().slice(0, 3)];
        return `${namedInLabel[3]}-${month}-${namedInLabel[2].padStart(2, "0")}`;
      }
    }

    // Named month: "Apr 03, 2026" or "March 12, 2026" or "Apr04'26"
    const namedMatch = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s']*(\d{1,2})[,\s']*(\d{2,4})/i);
    if (namedMatch) {
      const month = monthMap[namedMatch[1].toLowerCase().slice(0, 3)];
      const day = namedMatch[2].padStart(2, "0");
      let year = namedMatch[3];
      if (year.length === 2) year = "20" + year;
      return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD or YYYY/MM/DD (Petro-Canada: "2021-05-08")
    const isoMatch = line.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }

    // YY/MM/DD (Fortinos/Shoppers: "26/04/03")
    const yymmdd = line.match(/\b(\d{2})[/](\d{2})[/](\d{2})\b/);
    if (yymmdd) {
      const year = "20" + yymmdd[1];
      const month = yymmdd[2].padStart(2, "0");
      const day = yymmdd[3].padStart(2, "0");
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // MM/DD/YYYY (Nintendo: "02/23/2026")
    const usDate = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
    if (usDate) {
      const month = usDate[1].padStart(2, "0");
      const day = usDate[2].padStart(2, "0");
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${usDate[3]}-${month}-${day}`;
      }
    }
  }

  return null;
}

// ── TOTAL EXTRACTION ──────────────────────────────────────────────────────────

function extractTotal(lines: string[]): number | null {
  let bestTotal: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/subtotal|sub total|sub-total|before\s+tax|item\s+subtotal/i.test(line)) continue;

    // "Grand Total:   $9.23" or "Grand Total: CDN$ 11.29"
    if (/grand\s+total/i.test(line)) {
      const nums = line.match(/[\d]+\s*\.?\s*[\d]*/g);
      if (nums) {
        for (const n of nums) {
          const cents = parseCents(n);
          if (cents && cents > 50 && (!bestTotal || cents > bestTotal)) bestTotal = cents;
        }
      }
      if (!bestTotal && i + 1 < lines.length) {
        const cents = parseCents(lines[i + 1]);
        if (cents && cents > 50) bestTotal = cents;
      }
      if (bestTotal) break;
    }

    // "TOTAL   CAD $   59.43" or "TOTAL: $21.44" or "Total: $28.24"
    if (/^total[:\s]/i.test(line) && !/subtotal/i.test(line)) {
      const nums = line.match(/[\d]+\s*\.?\s*[\d]*/g);
      if (nums) {
        for (const n of nums) {
          const cents = parseCents(n);
          if (cents && cents > 50 && (!bestTotal || cents > bestTotal)) bestTotal = cents;
        }
      }
      if (!bestTotal && i + 1 < lines.length) {
        const cents = parseCents(lines[i + 1]);
        if (cents && cents > 50) bestTotal = cents;
      }
      if (bestTotal) break;
    }

    // "CA$6.78" or "CDN$ 11.29" or "CAD$ 59.43"
    const cadMatch = line.match(/(?:CA|CDN|CAD)\$?\s*([\d\s,.]+)/i);
    if (cadMatch && !bestTotal) {
      const cents = parseCents(cadMatch[1]);
      if (cents && cents > 50) bestTotal = cents;
    }

    // "$30.83" alone on a line
    if (/^\$[\d,.]+$/.test(line)) {
      const cents = parseCents(line);
      if (cents && cents > 50 && !bestTotal) bestTotal = cents;
    }
  }

  // Harvey's/restaurant fallback: standalone amount in bottom half
  if (!bestTotal) {
    for (let i = Math.floor(lines.length * 0.5); i < lines.length; i++) {
      const line = lines[i].trim();
      if (/subtotal|tax|hst|gst|rounded|survey|feedback|cash|change|optimum|points|tip|balance/i.test(line)) continue;
      const standalone = line.match(/^([\d]+\.\d{2})$/);
      if (standalone) {
        const cents = parseCents(standalone[1]);
        if (cents && cents > 500) { bestTotal = cents; break; }
      }
    }
  }

  return bestTotal;
}

// ── TAX EXTRACTION ────────────────────────────────────────────────────────────

function extractTax(lines: string[]): number | null {
  const taxAmounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // H=HST 13%   7.98 @ 13.000%   1.04
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

    // "FHST INCLUDED IN FUEL 2.63" or "PHST INCLUDED IN FUEL 4.21" (Petro-Canada)
    const fuelTax = line.match(/^[FPB]HST\s+INCLUDED\s+IN\s+FUEL\s+([\d.]+)/i);
    if (fuelTax) {
      const cents = parseCents(fuelTax[1]);
      if (cents && cents > 0 && cents < 10000) { taxAmounts.push(cents); continue; }
    }

    // "Tax Collected:   CDN$ 1.30" (Amazon)
    const taxCollected = line.match(/tax\s+collected[:\s]+(?:cdn\$?|ca\$?|cad\$?)?\s*([\d,.]+)/i);
    if (taxCollected) {
      const cents = parseCents(taxCollected[1]);
      if (cents && cents > 0 && cents < 10000) return cents;
    }

    // "Tax   (13%) CA$0.78" (Meta)
    const taxWithPercent = line.match(/^tax\s+\(\d+%\)\s+(?:ca\$?|cdn\$?|cad\$?)?\s*([\d,.]+)/i);
    if (taxWithPercent) {
      const cents = parseCents(taxWithPercent[1]);
      if (cents && cents > 0 && cents < 10000) return cents;
    }

    // "Total Tax:   $1.06" (Tim Hortons)
    const totalTax = line.match(/total\s+tax[:\s]+\$?\s*([\d,.]+)/i);
    if (totalTax) {
      const cents = parseCents(totalTax[1]);
      if (cents && cents > 0 && cents < 10000) return cents;
    }

    // "HST1:   $0.65" or "HST:   $0.41" (Tim Hortons multiple HST lines)
    const hstNumbered = line.match(/^hst\d*[:\s]+\$?\s*([\d,.]+)$/i);
    if (hstNumbered) {
      const cents = parseCents(hstNumbered[1]);
      if (cents && cents > 0 && cents < 10000) { taxAmounts.push(cents); continue; }
    }

    // "HST :   3.18" or "HST:3.18" or "HST   3.18"
    const simpleTax = line.match(/^(?:hst|gst|pst|qst|tax)[:\s=]+\$?\s*([\d\s,.]+)$/i);
    if (simpleTax) {
      const cents = parseCents(simpleTax[1]);
      if (cents && cents > 0 && cents < 10000) return cents;
    }

    // "HST" alone on line, amount on next line (Harvey's)
    if (/^hst\s*$/i.test(line) && i + 1 < lines.length) {
      const cents = parseCents(lines[i + 1].trim());
      if (cents && cents > 0 && cents < 10000) return cents;
    }

    // "HST   4.29" with spaces
    const hstSpaced = line.match(/^(?:hst|gst|tax)\s+([\d,.]+)$/i);
    if (hstSpaced) {
      const cents = parseCents(hstSpaced[1]);
      if (cents && cents > 0 && cents < 10000) return cents;
    }
  }

  if (taxAmounts.length > 0) {
    return taxAmounts.reduce((sum, t) => sum + t, 0);
  }

  return null;
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
    { pattern: /\bmc\b|\bmastercard\b|\bmaster\s*card\b/i, name: "Mastercard" },
    { pattern: /\bamex\b|\bamerican express\b/i, name: "Amex" },
    { pattern: /\bdiscover\b/i, name: "Discover" },
    { pattern: /\binterac\b/i, name: "Interac" },
  ];

  const paymentMethods = [
    { pattern: /\bcash\b/i, name: "Cash" },
    { pattern: /\bdebit\b|\bchequing\b|\bchecking\b/i, name: "Debit" },
    { pattern: /\bcredit\b/i, name: "Credit" },
    { pattern: /\be-?transfer\b/i, name: "E-Transfer" },
    { pattern: /\bcheque\b|\bcheck\b/i, name: "Cheque" },
    { pattern: /\bgift\s*card\b/i, name: "Gift Card" },
    { pattern: /contactless/i, name: "Contactless" },
  ];

  const entryMethods = [
    { pattern: /contactless|tap/i, name: "Contactless/Tap" },
    { pattern: /\bchip\b|\binsert\b/i, name: "Chip/Insert" },
    { pattern: /\bswipe\b/i, name: "Swipe" },
    { pattern: /\bmanual\b|\bkey.?entered\b/i, name: "Manual Entry" },
  ];

  for (const line of lines) {
    // Various last-four formats including "MasterCard ···· 2054" (Nintendo/Meta)
    const lastFourMatch =
      line.match(/[*·xX]{2,}\s*(\d{4})\s*[P\s]?$/i) ||
      line.match(/[*·xX]{4,}(\d{4})/i) ||
      line.match(/card\s+(?:number|#)[:\s]+[*·xX\s]+(\d{4})/i) ||
      line.match(/\b(?:VIS|MC|AMX|AMEX|DISC)[:\s]+(\d{4})\b/i) ||
      line.match(/ending\s+(?:in\s+)?(\d{4})/i) ||
      line.match(/[·.]{4}\s*(\d{4})$/);

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
  /^(subtotal|sub\s*total|sub-total|item\s+subtotal|total\s+before\s+tax)/i,
  /^(total|grand\s+total|order\s+total|amount\s+due|balance\s+due)/i,
  /^(hst|gst|pst|qst|tax|h=hst|ppd\s+fd|fhst|phst)/i,
  /^(cash|change|tender|payment|credit|debit|visa|mastercard|amex|interac)/i,
  /^(thank|visit|receipt|invoice|transaction|balance|approved|auth)/i,
  /^(register|cashier|clerk|store|phone|business\s+number)/i,
  /^(customer|retain|important|copy|records|expr|date.?time|reference)/i,
  /^(contactless|purchase|tip|gratuity|emv|terminal|application)/i,
  /^(card\s+number|card\s+type|acct|account|trans|ref\.?\s*#|systrace)/i,
  /^(rounded|survey|certificate|contest|optimum|pc\s+financial|pc\s+optimum|you\s+could|earn|points\s+with|petro-?points|loyalty)/i,
  /^(www\.|http|tel:|fax:|\*{3,}|={3,}|-{5,})/i,
  /^(fuel|pump\s+\d|regular|premium|diesel|litre|liter)/i,
  /^(take\s+out|drive\s+thru|order\s*#|chk\s*\d|check\s+closed|check\s+open)/i,
  /^(sold\s+by|transaction\s+id|transaction\s+date|remaining\s+balance|associated|billing\s+reason|product\s+type|payment\s+method|reference\s+number|date\s+range|amount\s+billed|campaign|results|impressions)/i,
  /^cad\$?$|^cdn\$?$|^ca\$?$/i,
  /^\d{10,}$/,
  /^[*=\-_·]{3,}$/,
  /^\d+\s+items?\b/i,
  /^\$?[\d,.]+\s+[A-Z]{1,2}$/,
  /^\d{2}-[A-Z\s]+$/,
  /^[LF]\s*\(L\)|^\(\$\/L\)/,
  /^points\s+earned$/i,
  /^toasted$|^butter$|^milk$/i,
];

const TOPPING_KEYWORDS = [
  "pickle", "onion", "lettuce", "harvsauce", "hot sauce", "light harvsauce",
  "mg bun", "ketchup", "mustard", "tomato", "bacon", "mushroom",
  "no ", "add ", "sub ", "w/ ", "w.o.", "rings -", "ftn pop",
  "diet pepsi", "diet coke", "frz lemon", "rg ftn", "lg slushie",
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
    if (lower.startsWith(t) || lower === t.trim()) return true;
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
  let match: RegExpMatchArray | null;

  // Shoppers double price: "GATORADE DRINK   4.49 GP   4.49"
  const shoppersDouble = /^([A-Z][A-Z\s]{2,30}?)\s+([\d,.]+)\s+[A-Z]{1,2}\s+([\d,.]+)$/;
  match = line.match(shoppersDouble);
  if (match) {
    const desc = match[1].trim();
    const price = parseCents(match[2]);
    if (price && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  // Shoppers single price: "HYDROSILK RAZO   12.99 GP"
  const shoppersSimple = /^([A-Z][A-Z\s]{2,30}?)\s+([\d,.]+)\s+[A-Z]{1,2}$/;
  match = line.match(shoppersSimple);
  if (match) {
    const desc = match[1].trim();
    const price = parseCents(match[2]);
    if (price && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  // Harvey's / Tim Hortons style: "1 Apple Pie   1.89" or "1 H Specialty Tea   $2.19"
  const qtyDescPrice = /^(\d+)\s+(.{2,40}?)\s{2,}\$?([\d,.]+)$/;
  match = line.match(qtyDescPrice);
  if (match) {
    const qty = parseInt(match[1]);
    const desc = match[2].trim();
    const total = parseCents(match[3]);
    if (total && qty > 0 && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: qty, unit_price_cents: Math.round(total / qty), total_cents: total };
    }
  }

  // Tim Hortons flexible: "1 Bgl - Four Cheese   $3.29"
  const timHortonsStyle = /^(\d)\s+(.{3,40}?)\s+\$?([\d,.]+)$/;
  match = line.match(timHortonsStyle);
  if (match) {
    const qty = parseInt(match[1]);
    const desc = match[2].trim();
    const total = parseCents(match[3]);
    if (total && qty > 0 && /[a-zA-Z]{2,}/.test(desc) && !shouldSkipLine(desc)) {
      return { description: desc, quantity: qty, unit_price_cents: Math.round(total / qty), total_cents: total };
    }
  }

  // Email receipt style: "Prime Membership Fee   CDN$ 9.99" or "Meta ads   CA$6.00"
  const emailStyle = /^(.{3,60}?)\s+(?:CDN|CA|CAD)?\$?\s*([\d,.]+)$/i;
  match = line.match(emailStyle);
  if (match) {
    const desc = match[1].trim();
    const price = parseCents(match[2]);
    if (
      price && price >= 25 && price < 100000 &&
      /[a-zA-Z]{3,}/.test(desc) &&
      !shouldSkipLine(desc) &&
      !/^\d+$/.test(desc)
    ) {
      return { description: desc, quantity: 1, unit_price_cents: price, total_cents: price };
    }
  }

  // Generic 2+ spaces: "DESCRIPTION   price"
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

  // Simple end: "DESCRIPTION price"
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

  // Fortinos: "(2)62911830001 GH GINGER 60ML HMRJ" + "2 @ $3.99   7.98"
  const fortinosQty = line2.match(/^(\d+)\s*@\s*\$?([\d\s,.]+)\s+([\d\s,.]+)$/);
  if (fortinosQty) {
    const qty = parseInt(fortinosQty[1]);
    const unit = parseCents(fortinosQty[2]);
    const total = parseCents(fortinosQty[3]);
    const desc = line1
      .replace(/^\(\d+\)\d+\s+/, "")
      .replace(/^\d{8,}\s+/, "")
      .replace(/\s+\d+MRJ\s*$/i, "")
      .replace(/\s+HMRJ\s*$/i, "")
      .trim();
    if (unit && total && qty > 0 && desc.length >= 2 && /[a-zA-Z]/.test(desc)) {
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
      const notProduct = /^(date|time|order|register|store|phone|address|thank|customer|fuel|pump)/i;
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