export type ExtractedReceiptData = {
  vendor: string | null;
  date: string | null;
  total_cents: number | null;
  tax_cents: number | null;
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
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const base64 = await blobToBase64(imageBlob);
    
    // Remove data URL prefix if present
    const base64Image = base64.split(',')[1] || base64;

    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION" }],
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

    const annotations = visionData.responses?.[0]?.textAnnotations;
    
    if (!annotations || annotations.length === 0) {
      return {
        vendor: null,
        date: null,
        total_cents: null,
        tax_cents: null,
        raw_text: "",
        confidence: 0,
      };
    }

    // First annotation is the full text
    const fullText = annotations[0]?.description || "";
    
    // Parse the extracted text
    const extracted = parseReceiptText(fullText);
    
    return {
      ...extracted,
      raw_text: fullText,
      confidence: 85, // Google Vision typically 85-90% for receipts
    };
  } catch (error: any) {
    console.error("OCR extraction failed:", error);
    throw new Error(error.message || "Failed to extract receipt data");
  }
}

// Helper: Convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper: Parse text to extract structured data
function parseReceiptText(text: string): {
  vendor: string | null;
  date: string | null;
  total_cents: number | null;
  tax_cents: number | null;
} {
  const lines = text.split("\n").map((line) => line.trim());
  
  let vendor: string | null = null;
  let date: string | null = null;
  let total_cents: number | null = null;
  let tax_cents: number | null = null;

  // Extract vendor (usually first 1-3 non-empty lines)
  const nonEmptyLines = lines.filter(l => l.length > 2);
  if (nonEmptyLines.length > 0) {
    vendor = nonEmptyLines[0];
  }

  // Extract date (look for date patterns anywhere in text)
  const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/;
  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      date = normalizeDate(dateMatch[0]);
      break;
    }
  }

  // Extract total - multiple patterns
  // Pattern 1: "TOTAL" on one line, amount on next line
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
  
  // Pattern 2: "TOTAL" or "Order Total" followed by amount on same line
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

  // Extract tax - multiple patterns
  // Pattern 1: "Tax" on one line, amount on next (like Orangeville Flowers)
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
  
  // Pattern 2: HST/GST/PST followed by amount on same line
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
  
  // Pattern 3: "13.000% HST" on one line, amount on next
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

  return { vendor, date, total_cents, tax_cents };
}

// Helper: Normalize date to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  // Try parsing common formats
  const formats = [
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, // YYYY/MM/DD
    /(\d{1,2})[-/](\d{1,2})[-/](\d{2})/,  // MM/DD/YY or DD/MM/YY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[1]) {
        // YYYY/MM/DD
        [, year, month, day] = match;
      } else {
        // Assume MM/DD/YYYY or MM/DD/YY (common in North America)
        [, month, day, year] = match;
        
        // Handle 2-digit year
        if (year && year.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          year = String(century + parseInt(year));
        }
      }
      
      // Pad month and day with leading zeros
      month = month?.padStart(2, "0");
      day = day?.padStart(2, "0");
      
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateStr; // Return as-is if can't parse
}