import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractReceiptData } from "@/lib/extractReceiptData";

// Use service role key to bypass RLS
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
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const firmId = formData.get("firmId") as string;
    const clientId = formData.get("clientId") as string;

    console.log("📤 Upload started:", { fileName: file?.name, firmId, clientId });

    if (!file || !firmId || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Create receipt record
    const { data: receiptData, error: receiptError } = await supabase
      .from("receipts")
      .insert([
        {
          firm_id: firmId,
          client_id: clientId,
          source: "upload",
          status: "needs_review",
          currency: "CAD",
          extraction_status: "pending",
        },
      ])
      .select("id")
      .single();

    if (receiptError) {
      console.error("❌ Receipt insert error:", receiptError);
      throw receiptError;
    }

    const receiptId = receiptData.id;
    console.log("✅ Receipt created:", receiptId);

    // 2. Upload file to storage
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${firmId}/${clientId}/${receiptId}/${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("receipt-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Storage upload error:", uploadError);
      throw uploadError;
    }

    console.log("✅ File uploaded to storage:", storagePath);

    // 3. Update receipt with file path
    await supabase
      .from("receipts")
      .update({ file_path: storagePath })
      .eq("id", receiptId);

    // 4. Get signed URL and run OCR
    const { data: signedData } = await supabase.storage
      .from("receipt-files")
      .createSignedUrl(storagePath, 3600);

    if (signedData?.signedUrl) {
      console.log("📸 Starting OCR extraction...");
      console.log("🔗 Signed URL:", signedData.signedUrl);
      
      try {
        const extracted = await extractReceiptData(signedData.signedUrl);
        console.log("✅ OCR extracted:", extracted);

        // 5. Update receipt with extracted data
        await supabase
          .from("receipts")
          .update({
            vendor: extracted.vendor,
            receipt_date: extracted.date,
            total_cents: extracted.total_cents,
            extraction_status: "completed",
            ocr_raw_text: extracted.raw_text,
          })
          .eq("id", receiptId);

        console.log("✅ Receipt updated with OCR data");

        // 6. Save tax if found
        if (extracted.tax_cents && extracted.tax_cents > 0) {
          await supabase.from("receipt_taxes").insert([
            {
              receipt_id: receiptId,
              tax_type: "HST",
              rate: 0.13,
              amount_cents: extracted.tax_cents,
            },
          ]);
          console.log("✅ Tax saved:", extracted.tax_cents);
        }
      } catch (ocrError) {
        console.error("❌ OCR extraction failed:", ocrError);
        await supabase
          .from("receipts")
          .update({ extraction_status: "failed" })
          .eq("id", receiptId);
      }
    } else {
      console.error("❌ Failed to create signed URL");
    }

    return NextResponse.json({
      success: true,
      receiptId,
      message: "Receipt uploaded successfully",
    });
  } catch (error: any) {
    console.error("❌ Upload API error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}