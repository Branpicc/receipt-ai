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
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const firmId = formData.get("firmId") as string;
    const clientId = formData.get("clientId") as string;
    const authUserId = formData.get("userId") as string | null;

    console.log("📤 Upload started:", { 
      fileName: file?.name, 
      fileSize: file?.size,
      firmId, 
      clientId,
      authUserId 
    });

    if (!file || !firmId || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Look up firm_users.id from auth_user_id
    let firmUserId = null;
    if (authUserId) {
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .eq("firm_id", firmId)
        .single();
      
      firmUserId = firmUser?.id;
      console.log("👤 Resolved firm_user_id:", firmUserId);
    }

    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
          uploaded_by: firmUserId, // Use firm_users.id, not auth_user_id
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

    // 2. Upload file to storage with retry logic
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${firmId}/${clientId}/${receiptId}/${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("📤 Uploading to storage:", storagePath, "Size:", buffer.length);

    let uploadAttempt = 0;
    let uploadError = null;
    const MAX_RETRIES = 3;
    const isLargeFile = buffer.length > 2 * 1024 * 1024;

    while (uploadAttempt < MAX_RETRIES) {
      uploadAttempt++;
      console.log(`Upload attempt ${uploadAttempt}/${MAX_RETRIES}${isLargeFile ? ' (large file mode)' : ''}`);

      try {
        const { error } = await supabase.storage
          .from("receipt-files")
          .upload(storagePath, buffer, {
            contentType: file.type,
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

      if (uploadAttempt < MAX_RETRIES) {
        const baseWait = isLargeFile ? 3000 : 2000;
        const waitTime = Math.pow(2, uploadAttempt - 1) * baseWait;
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (uploadError) {
      console.error("❌ All upload attempts failed:", uploadError);
      await supabase.from("receipts").delete().eq("id", receiptId);
      throw new Error(`Storage upload failed after ${MAX_RETRIES} attempts: ${uploadError.message}`);
    }

    // 3. Update receipt with file path
    await supabase
      .from("receipts")
      .update({ file_path: storagePath })
      .eq("id", receiptId);

    console.log("✅ Receipt updated with file_path");

    // 5. Get signed URL and run OCR
    const { data: signedData, error: signedError } = await supabase.storage
      .from("receipt-files")
      .createSignedUrl(storagePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("❌ Failed to create signed URL:", signedError);
      return NextResponse.json({
        success: true,
        receiptId,
        message: "Receipt uploaded (OCR will be processed later)",
      });
    }

    console.log("📸 Starting OCR extraction...");
    
    let vendorName = "Unknown vendor";
    
    try {
      const extracted = await extractReceiptData(signedData.signedUrl);
      console.log("✅ OCR extracted:", extracted);

      vendorName = extracted.vendor || "Unknown vendor";

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
    } catch (ocrError: any) {
      console.error("❌ OCR extraction failed:", ocrError);
      await supabase
        .from("receipts")
        .update({ extraction_status: "failed" })
        .eq("id", receiptId);
    }

    // 9. Create notifications for OTHER users
    try {
      const { data: firmUsers } = await supabase
        .from("firm_users")
        .select("auth_user_id")
        .eq("firm_id", firmId)
        .neq("auth_user_id", authUserId || "");

      if (firmUsers && firmUsers.length > 0) {
        const notifications = firmUsers.map(user => ({
          firm_id: firmId,
          user_id: user.auth_user_id,
          type: "receipt_uploaded",
          title: "New receipt uploaded",
          message: `Receipt from ${vendorName} needs review`,
          receipt_id: receiptId,
          read: false,
        }));

        await supabase.from("notifications").insert(notifications);
        console.log(`✅ Created ${notifications.length} notifications for other users`);
      }
    } catch (notifError: any) {
      console.error("❌ Failed to create notifications:", notifError);
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