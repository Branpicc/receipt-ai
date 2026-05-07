// lib/processUploadedReceipt.ts
//
// Background orchestrator for an uploaded receipt. The HTTP POST handler
// returns to the user as soon as the file lands in storage; this function
// runs inside Next.js `after()` and does the slow work without blocking.
//
// Two-stage flow:
//   STAGE 1 — fast: Vision OCR + regex pulls vendor/date/total. If the regex
//             can't find vendor or total, we fall back to a Haiku call asking
//             only for those three fields. Either way we update the receipt
//             row and fire the SMS so the client gets context immediately.
//   STAGE 2 — full: Claude hybrid extraction (image + OCR text) for line
//             items, tax, gratuity, payment info. We reuse the OCR text from
//             stage 1 so Vision is only called once.
//
// The user-facing perceived latency drops from ~3-5s to <1s; the SMS still
// goes out within ~1-2s of the upload finishing.

import { createClient } from "@supabase/supabase-js";
import {
  fetchVisionOcrText,
  extractReceiptFromImageClaude,
  extractStage1Claude,
} from "./extractReceiptClaude";
import { parseReceiptText, extractReceiptData, type ExtractedReceiptData } from "./extractReceiptData";
import { triggerSms, sendBatchSms } from "./triggerSms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type ProcessUploadedReceiptOptions = {
  receiptId: string;
  signedUrl: string;
  firmId: string;
  clientId: string;
  authUserId: string | null;
  source: "upload" | "email" | "camera";
  batchId?: string;
  batchIndex: number;
  batchTotal: number;
};

export async function processUploadedReceipt(
  opts: ProcessUploadedReceiptOptions
): Promise<void> {
  const {
    receiptId,
    signedUrl,
    firmId,
    clientId,
    authUserId,
    source,
    batchId,
    batchIndex,
    batchTotal,
  } = opts;

  try {
    // ── STAGE 1 ──────────────────────────────────────────────────────────
    const ocrText = await fetchVisionOcrText(signedUrl);

    let stage1: { vendor: string | null; date: string | null; total_cents: number | null } = {
      vendor: null,
      date: null,
      total_cents: null,
    };

    if (ocrText) {
      const parsed = parseReceiptText(ocrText);
      stage1 = {
        vendor: parsed.vendor,
        date: parsed.date,
        total_cents: parsed.total_cents,
      };
    }

    // Fallback B: regex didn't find vendor or total → ask Haiku for the 3
    // fields directly. Still cheaper / faster than the full extraction.
    if (!stage1.vendor || !stage1.total_cents) {
      try {
        const haiku = await extractStage1Claude(signedUrl);
        stage1 = {
          vendor: stage1.vendor || haiku.vendor,
          date: stage1.date || haiku.date,
          total_cents: stage1.total_cents || haiku.total_cents,
        };
        console.log("[stage1] Haiku fallback succeeded");
      } catch (err: any) {
        console.error("[stage1] Haiku fallback failed:", err.message);
      }
    }

    if (stage1.vendor || stage1.date || stage1.total_cents) {
      await supabase
        .from("receipts")
        .update({
          vendor: stage1.vendor,
          receipt_date: stage1.date,
          total_cents: stage1.total_cents,
        })
        .eq("id", receiptId);
      console.log("[stage1] receipt updated:", stage1);
    }

    // Fire SMS using whatever stage 1 produced — triggerSms reads vendor/total
    // from the receipts row we just updated.
    try {
      const smsResult = await triggerSms(
        receiptId,
        clientId,
        firmId,
        source,
        batchId,
        batchIndex,
        batchTotal
      );
      console.log("[stage1] SMS:", smsResult);
    } catch (smsErr: any) {
      console.error("[stage1] SMS trigger failed:", smsErr.message);
    }

    // ── STAGE 2 ──────────────────────────────────────────────────────────
    const engine = (process.env.RECEIPT_EXTRACTION_ENGINE || "vision").toLowerCase();

    let extracted: ExtractedReceiptData;

    if (engine === "claude") {
      try {
        extracted = await extractReceiptFromImageClaude(signedUrl, {
          prefetchedOcrText: ocrText,
        });
      } catch (claudeErr: any) {
        console.error("[stage2] Claude failed, falling back to Vision regex:", claudeErr.message);
        extracted = await extractReceiptData(signedUrl);
      }
    } else {
      extracted = await extractReceiptData(signedUrl);
    }

    const vendorName = extracted.vendor || stage1.vendor || "Unknown vendor";

    await supabase
      .from("receipts")
      .update({
        vendor: extracted.vendor,
        receipt_date: extracted.date,
        total_cents: extracted.total_cents,
        extraction_status: "completed",
        ocr_raw_text: extracted.raw_text,
        payment_method: extracted.payment_method,
        card_brand: extracted.card_brand,
        card_last_four: extracted.card_last_four,
        card_entry_method: extracted.card_entry_method,
      })
      .eq("id", receiptId);

    if (extracted.tax_cents && extracted.tax_cents > 0) {
      await supabase.from("receipt_taxes").insert([
        {
          receipt_id: receiptId,
          firm_id: firmId,
          tax_type: "HST",
          rate: 0.13,
          amount_cents: extracted.tax_cents,
        },
      ]);
      if (extracted.gratuity_cents && extracted.gratuity_cents > 0) {
        await supabase
          .from("receipts")
          .update({ gratuity_cents: extracted.gratuity_cents })
          .eq("id", receiptId);
      }
    }

    // Card check vs registered client cards (carried over from upload route)
    if (extracted.card_last_four && extracted.card_brand) {
      try {
        const { data: clientCards } = await supabase
          .from("client_cards")
          .select("id, card_brand, last_four, card_type, nickname")
          .eq("client_id", clientId);

        if (clientCards && clientCards.length > 0) {
          const matchedCard = clientCards.find(
            (c) =>
              c.last_four === extracted.card_last_four &&
              c.card_brand.toLowerCase() ===
                (extracted.card_brand || "").toLowerCase()
          );

          if (matchedCard) {
            if (matchedCard.card_type === "personal") {
              await supabase.from("receipt_flags").insert([
                {
                  receipt_id: receiptId,
                  firm_id: firmId,
                  flag_type: "personal_card_used",
                  severity: "high",
                  message: `Personal card detected: ${matchedCard.card_brand} ****${matchedCard.last_four}${matchedCard.nickname ? ` (${matchedCard.nickname})` : ""}. Please verify if this is a business expense.`,
                },
              ]);
              await supabase.from("notifications").insert([
                {
                  firm_id: firmId,
                  client_id: clientId,
                  type: "receipt_flagged",
                  title: "⚠️ Personal card used",
                  message: `${vendorName} receipt was paid with a personal card (${matchedCard.card_brand} ****${matchedCard.last_four}). Please review.`,
                  receipt_id: receiptId,
                  read: false,
                },
              ]);
            }
          } else {
            await supabase.from("receipt_flags").insert([
              {
                receipt_id: receiptId,
                firm_id: firmId,
                flag_type: "unrecognized_card",
                severity: "warn",
                message: `Unrecognized card: ${extracted.card_brand} ****${extracted.card_last_four}. This card is not registered as a business card. Please verify.`,
              },
            ]);
          }
        }
      } catch (cardErr: any) {
        console.error("[stage2] card check failed:", cardErr.message);
      }
    }

    if (extracted.line_items && extracted.line_items.length > 0) {
      const rows = extracted.line_items.map((item, index) => ({
        receipt_id: receiptId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.total_cents,
        line_index: index + 1,
      }));
      await supabase.from("receipt_items").insert(rows);
    }

    // Notify other firm users that a new receipt is awaiting review
    try {
      const { data: firmUsers } = await supabase
        .from("firm_users")
        .select("auth_user_id")
        .eq("firm_id", firmId)
        .neq("auth_user_id", authUserId || "");

      if (firmUsers && firmUsers.length > 0) {
        const notifications = firmUsers.map((u) => ({
          firm_id: firmId,
          user_id: u.auth_user_id,
          type: "receipt_uploaded",
          title: "New receipt uploaded",
          message: `Receipt from ${vendorName} needs review`,
          receipt_id: receiptId,
          read: false,
        }));
        await supabase.from("notifications").insert(notifications);
      }
    } catch (notifErr: any) {
      console.error("[stage2] notification fanout failed:", notifErr.message);
    }

    // ── BATCH SMS TRIGGER (post-Stage-2) ─────────────────────────────────
    // For batch+instant uploads, sendBatchSms reads vendor/total from the
    // receipts table. We only fire once:
    //   (a) every batchTotal upload has queued an sms_queue entry
    //       — using `queueEntries.length >= batchTotal` instead of just
    //       `queueEntries.length > 0` prevents a race where the first 4
    //       receipts to finish Stage 2 see "4 of 4 queued + done" while
    //       the slow 5th is still in OCR
    //   (b) every queued receipt has reached completed/failed extraction
    //       state, so the combined SMS reflects Claude's Stage-2 values
    // sendBatchSms is idempotent (dedup guard on status='sent'), so the
    // natural race when multiple Stage-2 completions land simultaneously
    // is harmless — only the first to acquire the row wins.
    if (batchId && batchTotal > 1) {
      try {
        const { data: client } = await supabase
          .from("clients")
          .select("sms_timing")
          .eq("id", clientId)
          .single();

        if (client?.sms_timing === "instant") {
          const { data: queueEntries } = await supabase
            .from("sms_queue")
            .select("receipt_id")
            .eq("batch_id", batchId)
            .eq("status", "pending_batch");

          if (queueEntries && queueEntries.length >= batchTotal) {
            const receiptIds = queueEntries.map((e: any) => e.receipt_id).filter(Boolean);
            const { count: completedCount } = await supabase
              .from("receipts")
              .select("id", { count: "exact", head: true })
              .in("id", receiptIds)
              .in("extraction_status", ["completed", "failed"]);

            if (completedCount !== null && completedCount >= batchTotal) {
              console.log(`[stage2] all ${batchTotal} batch members queued + done — firing sendBatchSms`);
              await sendBatchSms(clientId, batchId, firmId);
            }
          }
        }
      } catch (batchErr: any) {
        console.error("[stage2] batch SMS check failed:", batchErr.message);
      }
    }
  } catch (err: any) {
    console.error("[processUploadedReceipt] fatal:", err);
    await supabase
      .from("receipts")
      .update({ extraction_status: "failed" })
      .eq("id", receiptId);
  }
}
