import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractReceiptData } from "@/lib/extractReceiptData";
import { convertToJpg, getFileExtension } from "@/lib/convertImage";

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

    console.log("📤 Upload started:", { 
      fileName: file?.name, 
      fileSize: file?.size,
      firmId, 
      clientId 
    });

    if (!file || !firmId || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
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

    // 2. Convert image to JPG if needed (HEIC, HEIF, WebP, etc.)
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);
    let mimeType = file.type;
    
    const conversionResult = await convertToJpg(buffer, mimeType);
    buffer = conversionResult.buffer;
    mimeType = conversionResult.mimeType;
    
    if (conversionResult.converted) {
      console.log(`✅ Image converted from ${file.type} to ${mimeType}`);
    }

    // 3. Upload file to storage with retry logic and progressive timeouts
    const originalName = file.name.replace(/\.[^.]+$/, ''); // Remove extension
    const extension = getFileExtension(mimeType);
    const safeName = `${originalName.replace(/[^\w.\-]+/g, "_")}.${extension}`;
    const storagePath = `${firmId}/${clientId}/${receiptId}/${Date.now()}_${safeName}`;

    console.log("📤 Uploading to storage:", storagePath, "Size:", buffer.length);

    let uploadAttempt = 0;
    let uploadError = null;
    const MAX_RETRIES = 3;

    // Try progressively longer timeouts and smaller chunks for large files
    const isLargeFile = buffer.length > 2 * 1024 * 1024; // 2MB+

    while (uploadAttempt < MAX_RETRIES) {
      uploadAttempt++;
      console.log(`Upload attempt ${uploadAttempt}/${MAX_RETRIES}${isLargeFile ? ' (large file mode)' : ''}`);

      try {
        const { error } = await supabase.storage
          .from("receipt-files")
          .upload(storagePath, buffer, {
            contentType: mimeType, // Use converted mime type
            upsert: false,
          });

        if (!error) {
          console.log("✅ File uploaded successfully");
          uploadError = null;
          break;
        }

        uploadError = error;
        console.error(`❌ Upload attempt ${uploadAttempt} failed:`, error);
      } catch (err: any) {
        uploadError = err;
        console.error(`❌ Upload attempt ${uploadAttempt} exception:`, err.message);
      }

      // Wait before retry with exponential backoff (longer for large files)
      if (uploadAttempt < MAX_RETRIES) {
        const baseWait = isLargeFile ? 3000 : 2000; // Start with 3s for large files
        const waitTime = Math.pow(2, uploadAttempt - 1) * baseWait; // 3s, 6s, 12s for large
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (uploadError) {
      console.error("❌ All upload attempts failed:", uploadError);
      
      // Delete the receipt record since upload failed
      await supabase.from("receipts").delete().eq("id", receiptId);
      
      throw new Error(`Storage upload failed after ${MAX_RETRIES} attempts: ${uploadError.message}`);
    }

    // 3. Update receipt with file path
    await supabase
      .from("receipts")
      .update({ file_path: storagePath })
      .eq("id", receiptId);

    console.log("✅ Receipt updated with file_path");

    // 4. Check if firm has OCR feature (not on free plan)
    const { data: firm } = await supabase
      .from("firms")
      .select("subscription_plan")
      .eq("id", firmId)
      .single();

    const plan = firm?.subscription_plan || 'free';

    // Skip OCR for free plan
    if (plan === 'free') {
      console.log("ℹ️ Free plan - skipping OCR (manual entry required)");
      await supabase
        .from("receipts")
        .update({ extraction_status: "manual_entry_required" })
        .eq("id", receiptId);

      return NextResponse.json({
        success: true,
        receiptId,
        message: "Receipt uploaded successfully (manual entry required for free plan)",
        requiresManualEntry: true,
      });
    }

    // Continue with OCR for paid plans...
    // 5. Get signed URL and run OCR
    const { data: signedData, error: signedError } = await supabase.storage
      .from("receipt-files")
      .createSignedUrl(storagePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("❌ Failed to create signed URL:", signedError);
      // Don't fail the whole upload, OCR can be done later
      return NextResponse.json({
        success: true,
        receiptId,
        message: "Receipt uploaded (OCR will be processed later)",
      });
    }

    console.log("📸 Starting OCR extraction...");
    
    try {
      const extracted = await extractReceiptData(signedData.signedUrl);
      console.log("✅ OCR extracted:", extracted);

      // 6. Update receipt with extracted data
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

      // 7. Save tax if found
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
        console.log("✅ Tax saved:", extracted.tax_cents);
      }
    } catch (ocrError: any) {
      console.error("❌ OCR extraction failed:", ocrError);
      await supabase
        .from("receipts")
        .update({ extraction_status: "failed" })
        .eq("id", receiptId);
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