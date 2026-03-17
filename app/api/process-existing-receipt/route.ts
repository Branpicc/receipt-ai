import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractReceiptData } from "@/lib/extractReceiptData";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const { receiptId, filePath } = await request.json();

    if (!receiptId || !filePath) {
      return NextResponse.json(
        { error: "Missing receiptId or filePath" },
        { status: 400 }
      );
    }

    console.log("📸 Processing receipt:", receiptId, filePath);

    // Get signed URL for the file
    const { data: signedData, error: signedError } = await supabase.storage
      .from("receipts")
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("❌ Failed to create signed URL:", signedError);
      throw new Error("Failed to access receipt file");
    }

    // Run OCR
    console.log("📸 Starting OCR extraction...");
    const extracted = await extractReceiptData(signedData.signedUrl);
    console.log("✅ OCR extracted:", extracted);

    // Update receipt with extracted data
    await supabase
      .from("receipts")
      .update({
        vendor: extracted.vendor,
        receipt_date: extracted.date,
        total_cents: extracted.total_cents,
        extraction_status: "completed",
        ocr_raw_text: extracted.raw_text,
        status: "needs_review",
      })
      .eq("id", receiptId);

    console.log("✅ Receipt updated with OCR data");

    // Save tax if found
    if (extracted.tax_cents && extracted.tax_cents > 0) {
      await supabase.from("receipt_taxes").insert([
        {
          receipt_id: receiptId,
          tax_type: "HST",
          rate: 0.13,
          amount_cents: extracted.tax_cents,
        },
      ]);
    }

    // Save line items if extracted
    if (extracted.line_items && extracted.line_items.length > 0) {
      const lineItemsToInsert = extracted.line_items.map((item, index) => ({
        receipt_id: receiptId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.total_cents,
        line_index: index + 1,
      }));

      await supabase.from("receipt_items").insert(lineItemsToInsert);
      console.log(`✅ Line items saved: ${lineItemsToInsert.length} items`);
    }

    return NextResponse.json({
      success: true,
      message: "Receipt processed successfully",
    });
  } catch (error: any) {
    console.error("❌ OCR processing error:", error);
    
    // Update receipt status to failed
    if (request.json) {
      const { receiptId } = await request.json();
      await supabase
        .from("receipts")
        .update({ extraction_status: "failed" })
        .eq("id", receiptId);
    }

    return NextResponse.json(
      { error: error.message || "Processing failed" },
      { status: 500 }
    );
  }
}