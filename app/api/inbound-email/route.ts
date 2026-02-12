import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log("📧 Received inbound email webhook");

    const formData = await request.formData();
    
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    const subject = formData.get("subject") as string || "";
    const text = formData.get("text") as string || "";
    const attachmentCount = parseInt(formData.get("attachments") as string || "0");
    
    console.log("From:", from);
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Attachments:", attachmentCount);

    // Extract client_id from email
    const clientIdMatch = to.match(/receipts-([a-f0-9-]+)@/);
    
    if (!clientIdMatch) {
      console.log("❌ Invalid recipient format");
      return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
    }
    
    const clientId = clientIdMatch[1];
    
    // Get client and firm
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, firm_id, name")
      .eq("id", clientId)
      .single();
    
    if (clientError || !client) {
      console.log("❌ Client not found:", clientId);
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    console.log("✅ Client found:", client.name);

    // Process attachments
    const attachmentUrls: string[] = [];
    
    if (attachmentCount > 0) {
      console.log(`📎 Processing ${attachmentCount} attachments...`);
      
      for (let i = 1; i <= attachmentCount; i++) {
        const attachmentFile = formData.get(`attachment${i}`) as File | null;
        const attachmentName = formData.get(`attachment-info${i}`) as string || `attachment${i}`;
        
        if (attachmentFile) {
          try {
            // Generate unique filename
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            const extension = attachmentName.split('.').pop() || 'bin';
            const filename = `${timestamp}-${randomId}.${extension}`;
            const storagePath = `email-attachments/${client.firm_id}/${client.id}/${filename}`;
            
            // Upload to Supabase Storage
            const arrayBuffer = await attachmentFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("receipt-files")
              .upload(storagePath, buffer, {
                contentType: attachmentFile.type || "application/octet-stream",
                upsert: false,
              });
            
            if (uploadError) {
              console.error(`❌ Failed to upload attachment ${i}:`, uploadError);
            } else {
              attachmentUrls.push(storagePath);
              console.log(`✅ Uploaded attachment ${i}: ${storagePath}`);
            }
          } catch (err) {
            console.error(`❌ Error processing attachment ${i}:`, err);
          }
        }
      }
    }

    // Detection: Is this a receipt?
    const isReceipt = detectIfReceipt(subject, text, attachmentCount);
    
    if (isReceipt) {
      console.log("✅ Detected as receipt - auto-processing");
      
      const { data: inboxEntry, error: inboxError } = await supabase
        .from("email_inbox")
        .insert([
          {
            firm_id: client.firm_id,
            client_id: client.id,
            from_email: from,
            subject,
            body_text: text,
            has_attachment: attachmentCount > 0,
            attachment_count: attachmentCount,
            attachment_urls: attachmentUrls,
            status: "auto_processed",
            processed_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();
      
      if (inboxError) {
        console.error("❌ Failed to save:", inboxError);
      } else {
        console.log("✅ Saved to inbox:", inboxEntry.id);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Receipt auto-processed",
        attachments_saved: attachmentUrls.length
      });
      
    } else {
      console.log("⚠️ Not a receipt - saving for review");
      
      const { data: inboxEntry, error: inboxError } = await supabase
        .from("email_inbox")
        .insert([
          {
            firm_id: client.firm_id,
            client_id: client.id,
            from_email: from,
            subject,
            body_text: text,
            has_attachment: attachmentCount > 0,
            attachment_count: attachmentCount,
            attachment_urls: attachmentUrls,
            status: "pending",
          },
        ])
        .select()
        .single();
      
      if (inboxError) {
        console.error("❌ Failed to save:", inboxError);
      } else {
        console.log("✅ Saved for review:", inboxEntry.id);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Email saved for review",
        attachments_saved: attachmentUrls.length
      });
    }
    
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function detectIfReceipt(subject: string, body: string, attachmentCount: number): boolean {
  if (attachmentCount === 0) return false;
  
  const combined = `${subject} ${body}`.toLowerCase();
  
  const receiptKeywords = ["receipt", "invoice", "purchase", "order", "payment", "transaction"];
  const nonReceiptKeywords = ["newsletter", "unsubscribe", "promotion", "deal", "sale"];
  
  if (nonReceiptKeywords.some(k => combined.includes(k))) return false;
  return receiptKeywords.some(k => combined.includes(k));
}