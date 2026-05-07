import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processUploadedReceipt } from "@/lib/processUploadedReceipt";

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
      authUserId,
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
          uploaded_by: firmUserId,
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
      console.log(`Upload attempt ${uploadAttempt}/${MAX_RETRIES}${isLargeFile ? " (large file mode)" : ""}`);

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
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    if (uploadError) {
      console.error("❌ All upload attempts failed:", uploadError);
      await supabase.from("receipts").delete().eq("id", receiptId);
      throw new Error(
        `Storage upload failed after ${MAX_RETRIES} attempts: ${uploadError.message}`
      );
    }

    // 3. Update receipt with file path
    await supabase
      .from("receipts")
      .update({ file_path: storagePath })
      .eq("id", receiptId);

    console.log("✅ Receipt updated with file_path");

    // 4. Get signed URL and run OCR
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

    // 5. Schedule background processing (Stage 1 fast extract + SMS, then
    //    Stage 2 full Claude extraction). The HTTP response returns now —
    //    user perceives upload as ~instant. `after()` keeps the function
    //    alive on Vercel until processUploadedReceipt resolves.
    const batchId = formData.get("batchId") as string | null;
    const batchIndex = parseInt(formData.get("batchIndex") as string || "1");
    const batchTotal = parseInt(formData.get("batchTotal") as string || "1");
    const source =
      (formData.get("source") as "upload" | "email" | "camera") || "upload";

    after(async () => {
      await processUploadedReceipt({
        receiptId,
        signedUrl: signedData.signedUrl,
        firmId,
        clientId,
        authUserId,
        source,
        batchId: batchId || undefined,
        batchIndex,
        batchTotal,
      });
    });

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
