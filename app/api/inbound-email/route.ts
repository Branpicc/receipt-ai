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
    
    const to = formData.get('to') as string;
    const from = formData.get('from') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    
    console.log('📧 Inbound email received:', { to, from, subject });

    let firmId: string | null = null;
    let clientId: string | null = null;

    // Try to match client-specific alias first (e.g., branpicc2@receipts.example.com)
    const clientAliasMatch = to?.match(/([a-zA-Z0-9]+)@receipts\.example\.com/);
    if (clientAliasMatch) {
      const emailAlias = clientAliasMatch[1];
      console.log('🔍 Checking for client alias:', emailAlias);

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, firm_id')
        .eq('email_alias', emailAlias)
        .single();

      if (client) {
        firmId = client.firm_id;
        clientId = client.id;
        console.log('✅ Matched client alias:', emailAlias, '→ Client:', clientId, 'Firm:', firmId);
      }
    }

    // If no client alias match, try firm-wide email (firm-abc123@receipts.yourdomain.com)
    if (!firmId) {
      const firmEmailMatch = to?.match(/firm-([a-f0-9-]+)@/);
      if (!firmEmailMatch) {
        console.error('❌ Could not extract firm ID or client alias from:', to);
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      const firmIdPrefix = firmEmailMatch[1];
      
      const { data: firm, error: firmError } = await supabase
        .from('firms')
        .select('id, subscription_tier')
        .ilike('email_ingestion_address', `%${firmIdPrefix}%`)
        .single();

      if (firmError || !firm) {
        console.error('❌ Firm not found for:', to);
        return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
      }

      firmId = firm.id;
      console.log('✅ Matched firm email:', firmIdPrefix, '→ Firm:', firmId);
    }

    // Get firm subscription info
    const { data: firm } = await supabase
      .from('firms')
      .select('subscription_tier')
      .eq('id', firmId)
      .single();

    const subscriptionTier = firm?.subscription_tier || 'free';
    console.log('📋 Firm tier:', subscriptionTier);

    // Count attachments
    let attachmentCount = 0;
    const attachments: Array<{ file: File; name: string; url?: string }> = [];

    for (let i = 1; i <= 20; i++) {
      const attachment = formData.get(`attachment${i}`) as File | null;
      if (attachment && attachment.size > 0) {
        attachmentCount++;
        attachments.push({ file: attachment, name: attachment.name });
        console.log(`📎 Attachment ${i} found:`, attachment.name, attachment.size);
      }
    }

    console.log(`📎 Total attachments: ${attachmentCount}`);

    // Get subscription limits
const monthlyLimit = 999999; // Unlimited for all paid plans
//     // Count receipts this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { count: regularReceiptsCount } = await supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .gte('created_at', startOfMonth.toISOString());

    const { count: emailReceiptsCount } = await supabase
      .from('email_receipts')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('status', 'approved')
      .gte('created_at', startOfMonth.toISOString());

    const currentUsage = (regularReceiptsCount || 0) + (emailReceiptsCount || 0);
    const remainingSlots = monthlyLimit - currentUsage;

    console.log(`📊 Usage: ${currentUsage}/${monthlyLimit} (${remainingSlots} remaining)`);

// Limit check disabled - all paid plans have unlimited receipts

    // Process attachments
    console.log('✅ Limit check passed - Processing attachments');

    for (const attachment of attachments) {
      const safeName = attachment.name.replace(/[^\w.\-]+/g, '_');
      const storagePath = `email-attachments/${firmId}/${Date.now()}_${safeName}`;

      const arrayBuffer = await attachment.file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('receipt-files')
        .upload(storagePath, buffer, {
          contentType: attachment.file.type,
          upsert: false,
        });

      if (!uploadError) {
        attachment.url = storagePath;
        console.log('✅ Attachment uploaded:', storagePath);
      } else {
        console.error('❌ Upload failed:', uploadError);
      }
    }

    // Create email receipt
    const { data: emailReceipt, error: insertError } = await supabase
      .from('email_receipts')
      .insert([{
        firm_id: firmId,
        client_id: clientId,
        from_email: from,
        subject: subject,
        email_text: text,
        email_html: html,
        has_attachment: attachmentCount > 0,
        attachment_count: attachmentCount,
        attachment_url: attachments[0]?.url || null,
        attachment_filename: attachments[0]?.name || null,
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

    // Extract data from first attachment or text
    let extractedData = null;
    let vendorName = 'Unknown vendor';

    if (attachments.length > 0 && attachments[0].url) {
      try {
        const { data: signedData } = await supabase.storage
          .from('receipt-files')
          .createSignedUrl(attachments[0].url, 3600);

        if (signedData?.signedUrl) {
          extractedData = await extractReceiptData(signedData.signedUrl);
          vendorName = extractedData.vendor || vendorName;
          console.log('✅ OCR extracted:', extractedData);
        }
      } catch (ocrError) {
        console.error('❌ OCR failed:', ocrError);
      }
    } else if (text) {
      try {
        extractedData = parseEmailText(text);
        vendorName = extractedData.vendor || vendorName;
        console.log('✅ Parsed from text:', extractedData);
      } catch (parseError) {
        console.error('❌ Parsing failed:', parseError);
      }
    }

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

    // Create notification
    await supabase.from('notifications').insert([
      {
        firm_id: firmId,
        client_id: clientId,
        type: 'email_received',
        title: 'New email receipt',
        message: attachmentCount > 1
          ? `${attachmentCount} receipts from ${vendorName} received via email`
          : `Receipt from ${vendorName} received via email`,
        email_id: emailReceipt.id,
        read: false,
      },
    ]);

    return NextResponse.json({ 
      success: true, 
      emailReceiptId: emailReceipt.id,
      attachmentCount,
      currentUsage: currentUsage + attachmentCount,
      monthlyLimit,
      clientId,
    });

  } catch (error: any) {
    console.error('❌ Inbound email error:', error);
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    );
  }
}

function parseEmailText(text: string): any {
  const lines = text.split('\n').map(l => l.trim());
  
  let vendor = null;
  let date = null;
  let total = null;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].length > 3 && lines[i].length < 50) {
      vendor = lines[i];
      break;
    }
  }

  const totalRegex = /(?:total|amount|balance).*?\$?\s*(\d+\.?\d{0,2})/i;
  for (const line of lines) {
    const match = line.match(totalRegex);
    if (match) {
      total = Math.round(parseFloat(match[1]) * 100);
      break;
    }
  }

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
    raw_text: text.substring(0, 1000),
  };
}