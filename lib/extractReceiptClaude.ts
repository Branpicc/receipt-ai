// lib/extractReceiptClaude.ts
//
// Claude-based receipt extraction. Two flows:
//   • extractReceiptFromImageClaude(imageUrl): hybrid — runs Google Vision OCR
//     for a high-quality text transcript, then sends BOTH the image and the
//     OCR text to Claude. Claude reads the visual layout and cross-checks
//     against Vision's character recognition. Best accuracy on photo / PDF
//     receipts (thermal prints, restaurant POS layouts, gratuity placement,
//     bilingual receipts, etc).
//   • extractReceiptFromTextClaude(emailText, fromEmail?): text-only — for
//     forwarded email receipts where the body is HTML/plaintext. No image,
//     no Vision call. Claude handles every vendor's template natively.
//
// Output schema matches lib/extractReceiptData.ts ExtractedReceiptData so the
// rest of the pipeline (DB inserts, categorization, SMS prompts) doesn't change.

import type { ExtractedReceiptData, LineItem } from "./extractReceiptData";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// Tool schema enforces structured output — Claude must return values matching
// these types or the API rejects the response.
const RECEIPT_TOOL = {
  name: "record_receipt_data",
  description:
    "Record the structured data extracted from a receipt. Cents are integers (e.g. $1.23 → 123). Dates are YYYY-MM-DD. Use null for any field that cannot be confidently determined from the receipt.",
  input_schema: {
    type: "object" as const,
    properties: {
      vendor: {
        type: ["string", "null"],
        description:
          "Merchant / business name as it appears on the receipt (e.g. 'Tim Hortons', 'Petro-Canada'). Strip address and tagline.",
      },
      date: {
        type: ["string", "null"],
        description: "Transaction date in YYYY-MM-DD format.",
      },
      total_cents: {
        type: ["integer", "null"],
        description: "Final total amount paid, in cents. Includes tax and gratuity.",
      },
      tax_cents: {
        type: ["integer", "null"],
        description:
          "Total tax amount in cents — sum of all GST/HST/PST/QST lines. Excludes gratuity. Null if no tax line found.",
      },
      gratuity_cents: {
        type: ["integer", "null"],
        description:
          "Tip / gratuity / service charge in cents. Null if not present or if it is a printed suggestion line that wasn't actually charged.",
      },
      line_items: {
        type: "array",
        description:
          "Individual purchased items with description, quantity and price. Skip toppings/modifiers/loyalty/promo lines.",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "integer" },
            unit_price_cents: { type: "integer" },
            total_cents: { type: "integer" },
          },
          required: ["description", "quantity", "unit_price_cents", "total_cents"],
        },
      },
      payment_method: {
        type: ["string", "null"],
        description:
          "One of: 'Cash', 'Debit', 'Credit', 'E-Transfer', 'Cheque', 'Gift Card', 'Contactless'. Null if not stated.",
      },
      card_brand: {
        type: ["string", "null"],
        description: "One of: 'Visa', 'Mastercard', 'Amex', 'Discover', 'Interac'. Null if not a card payment.",
      },
      card_last_four: {
        type: ["string", "null"],
        description: "Last four digits of the card used. Null if not present.",
      },
      card_entry_method: {
        type: ["string", "null"],
        description: "One of: 'Contactless/Tap', 'Chip/Insert', 'Swipe', 'Manual Entry'. Null if not stated.",
      },
      confidence: {
        type: "integer",
        description:
          "Self-assessed confidence in the overall extraction, 0-100. Lower this when key fields had to be guessed or the receipt was hard to read.",
      },
    },
    required: [
      "vendor",
      "date",
      "total_cents",
      "tax_cents",
      "gratuity_cents",
      "line_items",
      "payment_method",
      "card_brand",
      "card_last_four",
      "card_entry_method",
      "confidence",
    ],
  },
};

const SYSTEM_PROMPT = `You are a receipt-parsing assistant for a Canadian accounting firm. Extract structured data from receipts with high accuracy.

Rules:
- Always call the record_receipt_data tool. Never reply in plain text.
- All money amounts go in CENTS as integers ($1.23 → 123). Never store dollars as floats.
- Dates always YYYY-MM-DD. If only month/day visible, use the most plausible recent year.
- Distinguish "tax 13%" (a rate, ignore) from "Tax: $1.30" (an amount, capture).
- total_cents is the FINAL amount charged (includes tax + tip). Not the subtotal.
- gratuity_cents only counts an actually-charged tip, not printed suggestion amounts.
- Skip topping/modifier lines (e.g. "no onions", "add bacon"), loyalty earnings, "you saved", survey codes from line_items.
- For Canadian vendors with multiple HST/PST/QST lines, sum them into tax_cents.
- If a value isn't clearly present, return null rather than guessing.
- confidence: 90+ if everything is clear, 70-85 if some fields ambiguous, <60 if image is bad or layout is unrecognized.`;

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return key;
}

async function callClaude(messages: any[]): Promise<any> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [RECEIPT_TOOL],
      tool_choice: { type: "tool", name: RECEIPT_TOOL.name },
      messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errBody}`);
  }

  return res.json();
}

function parseToolResponse(claudeResponse: any, rawText: string): ExtractedReceiptData {
  const toolUseBlock = claudeResponse?.content?.find(
    (b: any) => b.type === "tool_use" && b.name === RECEIPT_TOOL.name
  );

  if (!toolUseBlock) {
    throw new Error("Claude did not return a tool_use response");
  }

  const input = toolUseBlock.input as {
    vendor: string | null;
    date: string | null;
    total_cents: number | null;
    tax_cents: number | null;
    gratuity_cents: number | null;
    line_items: LineItem[];
    payment_method: string | null;
    card_brand: string | null;
    card_last_four: string | null;
    card_entry_method: string | null;
    confidence: number;
  };

  return {
    vendor: input.vendor,
    date: input.date,
    total_cents: input.total_cents,
    tax_cents: input.tax_cents,
    gratuity_cents: input.gratuity_cents,
    line_items: input.line_items || [],
    raw_text: rawText,
    confidence: input.confidence,
    payment_method: input.payment_method,
    card_brand: input.card_brand,
    card_last_four: input.card_last_four,
    card_entry_method: input.card_entry_method,
  };
}

// ── HYBRID IMAGE EXTRACTION ────────────────────────────────────────────────

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");

  const contentType = res.headers.get("content-type") || "";
  let mediaType = "image/jpeg";
  if (contentType.includes("png")) mediaType = "image/png";
  else if (contentType.includes("webp")) mediaType = "image/webp";
  else if (contentType.includes("gif")) mediaType = "image/gif";
  else if (contentType.includes("pdf")) {
    // Anthropic supports PDF via documents API but our existing pipeline
    // pre-renders PDFs server-side. Treating as a PDF media type triggers
    // Claude's PDF handling path.
    mediaType = "application/pdf";
  }

  return { base64, mediaType };
}

async function fetchVisionOcrText(imageUrl: string): Promise<string> {
  const apiKey =
    process.env.GOOGLE_VISION_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
  if (!apiKey) return "";

  try {
    const imgRes = await fetch(imageUrl);
    const buf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) return "";
    const data = await visionRes.json();
    return data.responses?.[0]?.textAnnotations?.[0]?.description || "";
  } catch {
    return "";
  }
}

export async function extractReceiptFromImageClaude(
  imageUrl: string
): Promise<ExtractedReceiptData> {
  // Run Vision OCR and image fetch in parallel — both feed Claude.
  const [ocrText, imageData] = await Promise.all([
    fetchVisionOcrText(imageUrl),
    fetchImageAsBase64(imageUrl),
  ]);

  const userMessage: any[] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: imageData.mediaType,
        data: imageData.base64,
      },
    },
  ];

  if (ocrText) {
    userMessage.push({
      type: "text",
      text: `OCR transcript from Google Vision (use as a cross-reference for character recognition; the image above is authoritative for layout and structure):\n\n${ocrText}`,
    });
  } else {
    userMessage.push({
      type: "text",
      text: "Extract the receipt data using the image above.",
    });
  }

  const response = await callClaude([{ role: "user", content: userMessage }]);
  return parseToolResponse(response, ocrText);
}

// ── EMAIL TEXT EXTRACTION ──────────────────────────────────────────────────

// ── ENGINE DISPATCH ────────────────────────────────────────────────────────
//
// Selects extraction engine via RECEIPT_EXTRACTION_ENGINE env var:
//   "claude"  → Claude hybrid (Vision OCR text + Claude vision); on failure
//               falls back to legacy Vision-only regex parsing so a single
//               bad image never breaks the upload.
//   anything else (or unset) → legacy Vision-only behaviour.

export async function extractReceiptImageWithEngine(
  imageUrl: string
): Promise<ExtractedReceiptData> {
  const engine = (process.env.RECEIPT_EXTRACTION_ENGINE || "vision").toLowerCase();

  if (engine === "claude") {
    try {
      return await extractReceiptFromImageClaude(imageUrl);
    } catch (err: any) {
      console.error("[Claude extraction failed, falling back to Vision]", err.message);
    }
  }

  const { extractReceiptData } = await import("./extractReceiptData");
  return extractReceiptData(imageUrl);
}

export async function extractReceiptFromTextClaude(
  emailText: string,
  fromEmail?: string
): Promise<ExtractedReceiptData> {
  const context = fromEmail
    ? `Email is from: ${fromEmail}\n\nEmail body:\n\n${emailText}`
    : `Email body:\n\n${emailText}`;

  const response = await callClaude([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Extract the receipt data from this forwarded email. The sender domain may hint at the vendor (Amazon, Uber, Stripe, etc).\n\n${context}`,
        },
      ],
    },
  ]);

  return parseToolResponse(response, emailText);
}
