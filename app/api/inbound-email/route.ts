// app/api/inbound-email/route.ts - Receive emails from SendGrid
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractReceiptData } from '@/lib/extractReceiptData';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // SendGrid sends data as form fields
    const to = formData.get('to') as string;
    const from = formData.get('from') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    
    console.log('📧 Inbound email received:', { to, from, subject });

    // Extract firm ID from email address (firm-abc123@receipts.yourdomain.com)
    const emailMatch = to?.match(/firm-([a-f0-9-]+)@/);
    if (!emailMatch) {
      console.error('❌ Could not extract firm ID from:', to);
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const firmIdPrefix = emailMatch[1];
    
    // Find firm by email address prefix
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id')
      .ilike('email_ingestion_address', `%${firmIdPrefix}%`)
      .single();

    if (firmError || !firm) {
      console.error('❌ Firm not found for:', to);
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const firmId = firm.id;
    console.log('✅ Matched firm:', firmId);

    // Check for attachment
    const attachment = formData.get('attachment1') as File | null;
    let hasAttachment = false;
    let attachmentUrl = null;
    let attachmentFilename = null;

    if (attachment && attachment.size > 0) {
      console.log('📎 Attachment found:', attachment.name, attachment.size);
      hasAttachment = true;
      attachmentFilename = attachment.name;

      // Upload attachment to storage
      const safeName = attachment.name.replace(/[^\w.\-]+/g, '_');
      const storagePath = `email-attachments/${firmId}/${Date.now()}_${safeName}`;

      const arrayBuffer = await attachment.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('receipt-files')
        .upload(storagePath, buffer, {
          contentType: attachment.type,
          upsert: false,
        });

      if (!uploadError) {
        attachmentUrl = storagePath;
        console.log('✅ Attachment uploaded:', storagePath);
      }
    }

    // Create email receipt record
    const { data: emailReceipt, error: insertError } = await supabase
      .from('email_receipts')
      .insert([{
        firm_id: firmId,
        from_email: from,
        subject: subject,
        email_text: text,
        email_html: html,
        has_attachment: hasAttachment,
        attachment_url: attachmentUrl,
        attachment_filename: attachmentFilename,
        status: 'pending',
        extraction_status: 'pending',
      }])
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Failed to insert email receipt:', insertError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('✅ Email receipt created:', emailReceipt.id);

    // Try to extract receipt data from text or attachment
    let extractedData = null;
    let vendorName = 'Unknown vendor';

    if (hasAttachment && attachmentUrl) {
      // Run OCR on attachment
      try {
        const { data: signedData } = await supabase.storage
          .from('receipt-files')
          .createSignedUrl(attachmentUrl, 3600);

        if (signedData?.signedUrl) {
          extractedData = await extractReceiptData(signedData.signedUrl);
          vendorName = extractedData.vendor || vendorName;
          console.log('✅ OCR extracted from attachment:', extractedData);
        }
      } catch (ocrError) {
        console.error('❌ OCR failed:', ocrError);
      }
    } else if (text) {
      // Try to parse receipt data from email text
      try {
        extractedData = parseEmailText(text);
        vendorName = extractedData.vendor || vendorName;
        console.log('✅ Parsed from email text:', extractedData);
      } catch (parseError) {
        console.error('❌ Text parsing failed:', parseError);
      }
    }

    // Update email receipt with extracted data
    if (extractedData) {
      await supabase
        .from('email_receipts')
        .update({
          vendor: extractedData.vendor,
          receipt_date: extractedData.date,
          total_cents: extractedData.total_cents,
          extraction_status: 'completed',
          ocr_raw_text: extractedData.raw_text,
        })
        .eq('id', emailReceipt.id);
    }

    // Create notification for received email
    try {
      await supabase.from('notifications').insert([
        {
          firm_id: firmId,
          type: 'email_received',
          title: 'New email receipt',
          message: `Receipt from ${vendorName} received via email`,
          email_id: emailReceipt.id,
          read: false,
        },
      ]);
      console.log('✅ Notification created');
    } catch (notifError) {
      console.error('❌ Failed to create notification:', notifError);
      // Don't fail the email processing if notification fails
    }

    return NextResponse.json({ 
      success: true, 
      emailReceiptId: emailReceipt.id 
    });

  } catch (error: any) {
    console.error('❌ Inbound email error:', error);
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    );
  }
}

// Simple text parser for email receipts
function parseEmailText(text: string): any {
  const lines = text.split('\n').map(l => l.trim());
  
  let vendor = null;
  let date = null;
  let total = null;

  // Try to find vendor (usually first few lines)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].length > 3 && lines[i].length < 50) {
      vendor = lines[i];
      break;
    }
  }

  // Find total (look for $ amounts)
  const totalRegex = /(?:total|amount|balance).*?\$?\s*(\d+\.?\d{0,2})/i;
  for (const line of lines) {
    const match = line.match(totalRegex);
    if (match) {
      total = Math.round(parseFloat(match[1]) * 100);
      break;
    }
  }

  // Find date
  const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\w+ \d{1,2},? \d{4})/;
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      date = match[0];
      break;
    }
  }

  return {
    vendor,
    date,
    total_cents: total,
    raw_text: text.substring(0, 1000), // First 1000 chars
  };
}