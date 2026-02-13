export type ParsedEmailReceipt = {
  vendor: string | null;
  date: string | null;
  total: number | null;
  description: string | null;
  confidence: number;
};

export function parseEmailBodyForReceipt(
  subject: string,
  body: string,
  fromEmail: string
): ParsedEmailReceipt | null {
  
  const combined = `${subject}\n${body}`.toLowerCase();
  
  if (!looksLikeReceipt(combined)) {
    return null;
  }
  
  let vendor: string | null = null;
  let date: string | null = null;
  let total: number | null = null;
  let description: string | null = null;
  let confidence = 50;
  
  vendor = extractVendor(fromEmail, subject);
  if (vendor) confidence += 20;
  
  date = extractDate(body);
  if (date) confidence += 10;
  
  total = extractTotal(body);
  if (total) confidence += 20;
  
  description = extractDescription(subject, body);
  
  if (vendor && total) {
    return { vendor, date, total, description, confidence };
  }
  
  return null;
}

function looksLikeReceipt(text: string): boolean {
  const receiptKeywords = [
    'receipt',
    'invoice',
    'payment',
    'order confirmation',
    'your order',
    'payment successful',
    'thank you for your purchase',
    'transaction',
    'paid',
    'total:',
    'amount:',
  ];
  
  return receiptKeywords.some(keyword => text.includes(keyword));
}

function extractVendor(fromEmail: string, subject: string): string | null {
  const vendorMap: Record<string, string> = {
    'uber.com': 'Uber',
    'amazon.com': 'Amazon',
    'stripe.com': 'Stripe',
    'square.com': 'Square',
    'paypal.com': 'PayPal',
    'shopify.com': 'Shopify',
  };
  
  for (const [domain, vendor] of Object.entries(vendorMap)) {
    if (fromEmail.includes(domain)) {
      return vendor;
    }
  }
  
  const subjectMatch = subject.match(/from\s+([A-Z][a-zA-Z\s&]+)/i);
  if (subjectMatch) {
    return subjectMatch[1].trim();
  }
  
  const domainMatch = fromEmail.match(/@([a-z0-9-]+)\./i);
  if (domainMatch) {
    return domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1);
  }
  
  return null;
}

function extractDate(body: string): string | null {
  const patterns = [
    /date[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    /on\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      return normalizeDate(match[1]);
    }
  }
  
  return null;
}

function extractTotal(body: string): number | null {
  const patterns = [
    /total[:\s]*\$?\s*([\d,]+\.?\d{2})/i,
    /amount[:\s]*\$?\s*([\d,]+\.?\d{2})/i,
    /charged[:\s]*\$?\s*([\d,]+\.?\d{2})/i,
    /paid[:\s]*\$?\s*([\d,]+\.?\d{2})/i,
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (amount > 0 && amount < 100000) {
        return amount;
      }
    }
  }
  
  return null;
}

function extractDescription(subject: string, body: string): string | null {
  const itemMatch = body.match(/item[s]?[:\s]+([^\n]{10,100})/i);
  if (itemMatch) {
    return itemMatch[1].trim();
  }
  
  const forMatch = subject.match(/for\s+([^\n]{10,100})/i);
  if (forMatch) {
    return forMatch[1].trim();
  }
  
  const lines = body.split('\n').filter(l => l.trim().length > 10);
  if (lines.length > 0) {
    return lines[0].trim().substring(0, 100);
  }
  
  return null;
}

function normalizeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Invalid date
  }
  return dateStr;
}