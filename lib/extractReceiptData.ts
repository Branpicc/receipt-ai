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
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

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
      throw new Error(
        visionData.error?.message || "Vision API request failed"
      );
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

function parseReceiptText(text: string): {
  vendor: string | null;
  date: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  line_items: LineItem[];
} {
  const lines = text.split("\n").map((line) => line.trim());
  
  let vendor: string | null = null;
  let date: string | null = null;
  let total_cents: number | null = null;
  let tax_cents: number | null = null;

  const nonEmptyLines = lines.filter(l => l.length > 2);
  if (nonEmptyLines.length > 0) {
    vendor = nonEmptyLines[0];
  }

  const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/;
  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      date = normalizeDate(dateMatch[0]);
      break;
    }
  }

  // Extract total FIRST (needed for validation)
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].match(/^(TOTAL|Order Total)$/i)) {
      const nextLine = lines[i + 1];
      const amountMatch = nextLine.match(/\$?([\d,]+\.?\d{2})/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (amount > 0 && amount < 100000) {
          total_cents = Math.round(amount * 100);
          break;
        }
      }
    }
  }
  
  if (!total_cents) {
    const totalPattern = /(total|order total)[:\s]*\$?\s*([\d,]+\.?\d{2})/i;
    for (const line of lines) {
      const totalMatch = line.match(totalPattern);
      if (totalMatch) {
        const amount = parseFloat(totalMatch[2].replace(/,/g, ""));
        if (amount > 0 && amount < 100000) {
          total_cents = Math.round(amount * 100);
          break;
        }
      }
    }
  }

  // Extract tax SECOND (needed for validation)
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].match(/^Tax$/i)) {
      const nextLine = lines[i + 1];
      const amountMatch = nextLine.match(/\$?(\d{1,4}\.\d{2})/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1]);
        if (amount > 0 && amount < 10000) {
          tax_cents = Math.round(amount * 100);
          break;
        }
      }
    }
  }
  
  if (!tax_cents) {
    const taxPattern1 = /(hst|gst|pst|qst|tax)[:\s]*\$?\s*([\d,]+\.?\d{2})/i;
    for (const line of lines) {
      const taxMatch = line.match(taxPattern1);
      if (taxMatch) {
        const amount = parseFloat(taxMatch[2].replace(/,/g, ""));
        if (amount > 0 && amount < 10000) {
          tax_cents = Math.round(amount * 100);
          break;
        }
      }
    }
  }
  
  if (!tax_cents) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].match(/\d+\.?\d*%\s*(hst|gst|pst|qst)/i)) {
        const nextLine = lines[i + 1];
        const amountMatch = nextLine.match(/^(\d{1,4}\.\d{2})$/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          if (amount > 0 && amount < 10000) {
            tax_cents = Math.round(amount * 100);
            break;
          }
        }
      }
    }
  }

  // Extract line items LAST and validate against subtotal
  const expectedSubtotal = total_cents && tax_cents ? total_cents - tax_cents : null;
  const line_items = extractLineItems(lines, expectedSubtotal);

  return { vendor, date, total_cents, tax_cents, line_items };
}

function extractLineItems(lines: string[], expectedSubtotal: number | null): LineItem[] {
  const allCandidates: LineItem[] = [];
  
  const skipKeywords = [
    'subtotal', 'total', 'tax', 'hst', 'gst', 'pst', 'qst',
    'change', 'tender', 'payment', 'cash', 'credit', 'debit',
    'thank', 'visit', 'receipt', 'invoice',
    'transaction', 'balance', 'approved', 'auth',
    'register', 'cashier', 'clerk', 'store', 'phone',
    'business number', 'gst:', 'amount', 'customer',
    'approved', 'retain', 'important', 'copy', 'records',
    'expr:', 'type:', 'date/time:', 'reference', 'label:',
    'contactless', 'purchase', 'mastercard', 'visa', 'amex',
    'tip', 'gratuity', 'amount tendered', 'emv terminal',
    'application', 'terminal', 'tendered'
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    if (skipKeywords.some(keyword => lineLower.includes(keyword))) {
      continue;
    }

    if (line.length < 3 || /[<>{}[\]\\|~`]/.test(line)) {
      continue;
    }

    let item = parseLineItem(line);
    
    if (!item && i < lines.length - 1) {
      item = parseMultiLineItem(lines[i], lines[i + 1], lines[i + 2]);
      if (item) {
        i++; // Skip next line since we consumed it
      }
    }
    
    if (item) {
      if (item.description.length >= 3 && 
          item.total_cents > 0 && 
          item.total_cents < 1000000 &&
          item.unit_price_cents > 0) {
        allCandidates.push(item);
      }
    }
  }

  // VALIDATION: Check if candidates sum to expected subtotal
  if (expectedSubtotal && allCandidates.length > 0) {
    const sum = allCandidates.reduce((total, item) => total + item.total_cents, 0);
    const difference = Math.abs(sum - expectedSubtotal);
    const percentOff = (difference / expectedSubtotal) * 100;

    console.log(`📊 Line items validation: Sum=$${sum/100}, Expected=$${expectedSubtotal/100}, Diff=${percentOff.toFixed(1)}%`);

    // If sum is within 5% of expected subtotal, accept all items
    if (percentOff <= 5) {
      console.log(`✅ Line items validated (within 5% tolerance)`);
      return allCandidates;
    }

    // If sum is way off, try to find the best subset
    if (percentOff > 20) {
      console.log(`⚠️ Sum is ${percentOff.toFixed(1)}% off - filtering items`);
      
      // Strategy: Keep items that together sum close to subtotal
      // Try removing items one by one to see if we get closer
      let bestItems = allCandidates;
      let bestDiff = difference;

      for (let i = 0; i < allCandidates.length; i++) {
        const subset = allCandidates.filter((_, idx) => idx !== i);
        const subsetSum = subset.reduce((total, item) => total + item.total_cents, 0);
        const subsetDiff = Math.abs(subsetSum - expectedSubtotal);
        
        if (subsetDiff < bestDiff) {
          bestItems = subset;
          bestDiff = subsetDiff;
        }
      }

      const finalPercentOff = (bestDiff / expectedSubtotal) * 100;
      
      // Only return if we got within 10% after filtering
      if (finalPercentOff <= 10) {
        console.log(`✅ Filtered to ${bestItems.length} items (${finalPercentOff.toFixed(1)}% off)`);
        return bestItems;
      } else {
        console.log(`❌ Could not find valid item combination (still ${finalPercentOff.toFixed(1)}% off)`);
        return []; // Return empty if we can't get close
      }
    }
  }

  // No validation possible or passed validation
  return allCandidates;
}

function parseLineItem(line: string): LineItem | null {
  const pattern1 = /^(\d+)\s*[@x×]\s*(.+?)\s+\$?([\d,]+\.?\d{0,2})\s*[=]?\s*\$?([\d,]+\.?\d{2})$/i;
  let match = line.match(pattern1);
  if (match) {
    const [, qty, desc, unitPrice, total] = match;
    return {
      description: desc.trim(),
      quantity: parseInt(qty),
      unit_price_cents: Math.round(parseFloat(unitPrice.replace(/,/g, "")) * 100),
      total_cents: Math.round(parseFloat(total.replace(/,/g, "")) * 100),
    };
  }

  const pattern2 = /^(.+?)\s+(\d+)\s*[@x×]\s*\$?([\d,]+\.?\d{0,2})\s+\$?([\d,]+\.?\d{2})$/i;
  match = line.match(pattern2);
  if (match) {
    const [, desc, qty, unitPrice, total] = match;
    return {
      description: desc.trim(),
      quantity: parseInt(qty),
      unit_price_cents: Math.round(parseFloat(unitPrice.replace(/,/g, "")) * 100),
      total_cents: Math.round(parseFloat(total.replace(/,/g, "")) * 100),
    };
  }

  const pattern3 = /^(.{3,60}?)\s+\$?([\d,]+\.\d{2})$/;
  match = line.match(pattern3);
  if (match) {
    const [, desc, price] = match;
    const priceCents = Math.round(parseFloat(price.replace(/,/g, "")) * 100);
    
    if (!/[a-zA-Z]{2,}/.test(desc) || priceCents < 50 || priceCents > 100000) {
      return null;
    }
    
    if (/^\d+$/.test(desc.trim())) {
      return null;
    }
    
    return {
      description: desc.trim(),
      quantity: 1,
      unit_price_cents: priceCents,
      total_cents: priceCents,
    };
  }

  const pattern4 = /^(\d+)\s+(.{3,60}?)\s+([\d,]+\.\d{2})$/;
  match = line.match(pattern4);
  if (match) {
    const [, qty, desc, total] = match;
    const totalCents = Math.round(parseFloat(total.replace(/,/g, "")) * 100);
    const quantity = parseInt(qty);
    
    if (!/[a-zA-Z]{2,}/.test(desc) || totalCents < 50) {
      return null;
    }
    
    return {
      description: desc.trim(),
      quantity: quantity,
      unit_price_cents: Math.round(totalCents / quantity),
      total_cents: totalCents,
    };
  }

  return null;
}

function parseMultiLineItem(line1: string, line2: string, line3?: string): LineItem | null {
  const line1Lower = line1.toLowerCase();
  const skipWords = ['subtotal', 'total', 'tax', 'tip', 'tender', 'payment'];
  
  if (skipWords.some(word => line1Lower.includes(word))) {
    return null;
  }

  const qtyPricePattern1 = /^(\d+)\s*[@x×]\s*\$?([\d,]+\.\d{2})$/;
  let match = line2.match(qtyPricePattern1);
  if (match) {
    const [, qty, price] = match;
    const priceCents = Math.round(parseFloat(price.replace(/,/g, "")) * 100);
    const quantity = parseInt(qty);
    
    if (!/[a-zA-Z]{2,}/.test(line1) || line1.length > 60) {
      return null;
    }
    
    return {
      description: line1.trim(),
      quantity: quantity,
      unit_price_cents: priceCents,
      total_cents: priceCents * quantity,
    };
  }

  const priceOnlyPattern = /^\$?([\d,]+\.\d{2})$/;
  match = line2.match(priceOnlyPattern);
  if (match) {
    const [, price] = match;
    const priceCents = Math.round(parseFloat(price.replace(/,/g, "")) * 100);
    
    if (!/[a-zA-Z]{2,}/.test(line1) || line1.length < 3 || line1.length > 60) {
      return null;
    }
    
    if (priceCents < 50 || priceCents > 100000) {
      return null;
    }
    
    const notAProduct = /^(date|time|order|register|store|phone|address|unit|street|thank|customer)/i;
    if (notAProduct.test(line1)) {
      return null;
    }
    
    return {
      description: line1.trim(),
      quantity: 1,
      unit_price_cents: priceCents,
      total_cents: priceCents,
    };
  }

  if (line3) {
    const qtyPattern = /^(\d{1,2})$/;
    const qtyMatch = line2.match(qtyPattern);
    const priceMatch = line3.match(priceOnlyPattern);
    
    if (qtyMatch && priceMatch) {
      const quantity = parseInt(qtyMatch[1]);
      const totalCents = Math.round(parseFloat(priceMatch[1].replace(/,/g, "")) * 100);
      
      if (!/[a-zA-Z]{2,}/.test(line1) || quantity > 99 || totalCents < 50) {
        return null;
      }
      
      return {
        description: line1.trim(),
        quantity: quantity,
        unit_price_cents: Math.round(totalCents / quantity),
        total_cents: totalCents,
      };
    }
  }

  const qtyAndPrice = /^(\d+)\s+\$?([\d,]+\.\d{2})$/;
  match = line2.match(qtyAndPrice);
  if (match) {
    const [, qty, price] = match;
    const quantity = parseInt(qty);
    const totalCents = Math.round(parseFloat(price.replace(/,/g, "")) * 100);
    
    if (!/[a-zA-Z]{2,}/.test(line1) || line1.length < 3) {
      return null;
    }
    
    return {
      description: line1.trim(),
      quantity: quantity,
      unit_price_cents: Math.round(totalCents / quantity),
      total_cents: totalCents,
    };
  }

  return null;
}

function normalizeDate(dateStr: string): string {
  const formats = [
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    /(\d{1,2})[-/](\d{1,2})[-/](\d{2})/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[1]) {
        [, year, month, day] = match;
      } else {
        [, month, day, year] = match;
        
        if (year && year.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          year = String(century + parseInt(year));
        }
      }
      
      month = month?.padStart(2, "0");
      day = day?.padStart(2, "0");
      
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateStr;
}