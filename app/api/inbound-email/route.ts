// app/api/inbound-email/route.ts - Receive emails from SendGrid
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractReceiptData } from '@/lib/extractReceiptData';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractTextFromMime(raw: string): string {
  // Try to extract text/plain section
  const textMatch = raw.match(/Content-Type: text\/plain[^\n]*\n(?:[^\n]+\n)*\n([\s\S]*?)(?=\n--[a-zA-Z0-9])/i);
  if (textMatch) {
    return textMatch[1]
      .replace(/=\r?\n/g, '')
      .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
      .replace(/\[image:[^\]]+\]/g, '') // Remove [image: ...] placeholders
      .trim();
  }
  // Fallback: strip all headers and boundaries
  return raw
    .replace(/^[\s\S]*?(?=---------- Forwarded message)/m, '')
    .replace(/=\r?\n/g, '')
    .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
    .replace(/\[image:[^\]]+\]/g, '')
    .substring(0, 5000);
}

function extractHtmlFromMime(raw: string): string {
  const htmlMatch = raw.match(/Content-Type: text\/html[^\n]*\n(?:Content-Transfer-Encoding:[^\n]*\n)?\n([\s\S]*?)(?=\n--[a-zA-Z0-9]|\z)/i);
  if (htmlMatch) {
    return htmlMatch[1]
      .replace(/=\r?\n/g, '')
      .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
      .trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
const to = formData.get('to') as string;
    const from = formData.get('from') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    const rawEmail = formData.get('email') as string; // Raw MIME when Send Raw is enabled
    
    console.log('📧 Inbound email received:', { to, from, subject });
    console.log('📧 Has text:', !!text, 'Has html:', !!html, 'Has raw:', !!rawEmail);
    console.log('📧 Raw email preview:', rawEmail?.substring(0, 500));

    let firmId: string | null = null;
    let clientId: string | null = null;

// Try to match client-specific alias first (e.g., branpicc2@receipts.receipture.ca)
    const clientAliasMatch = to?.match(/([a-zA-Z0-9]+)@receipts\.receipture\.ca/);
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
email_text: text || extractTextFromMime(rawEmail || ''),
        email_html: html || extractHtmlFromMime(rawEmail || ''),
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
// Try to extract inline images from HTML email body
    if (!extractedData && (html || rawEmail)) {
      try {
        const htmlContent = html || extractHtmlFromMime(rawEmail || '');
        const base64Images = htmlContent?.match(/data:image\/[^;]+;base64,([^"']+)/g) || [];
        const imgSrcMatches = htmlContent?.match(/src=["']https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*/gi) || [];
        
        console.log(`📧 Found ${base64Images.length} inline images, ${imgSrcMatches.length} external images`);
        
        // Try extracting from external image URLs (like Toast receipt images)
        for (const imgTag of imgSrcMatches.slice(0, 3)) {
          const urlMatch = imgTag.match(/src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)/i);
          if (urlMatch) {
            try {
              const imgResult = await extractReceiptData(urlMatch[1]);
              if (imgResult.total_cents || imgResult.vendor) {
                extractedData = imgResult;
                vendorName = extractedData.vendor || vendorName;
                console.log('✅ OCR from inline image:', extractedData);
                break;
              }
            } catch { /* skip failed images */ }
          }
        }
      } catch (imgError) {
        console.error('❌ Inline image extraction failed:', imgError);
      }
    }

} else if (text || html || rawEmail) {
      try {
        // Strip HTML tags for text parsing - handle forwarded emails
        let emailContent = text || '';
        if (!emailContent && html) {
                              emailContent = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<\/td>/gi, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#\d+;/g, ' ')
            .replace(/\s{3,}/g, '\n')
            .trim();
        }
        // Fallback to raw MIME email if no text/html
        if (!emailContent && rawEmail) {
          emailContent = rawEmail
            .replace(/Content-Type:[^\n]+\n/gi, '')
            .replace(/Content-Transfer-Encoding:[^\n]+\n/gi, '')
            .replace(/MIME-Version:[^\n]+\n/gi, '')
            .replace(/--[a-zA-Z0-9_-]+/g, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/=\r?\n/g, '')
            .replace(/=[0-9A-F]{2}/gi, ' ')
            .replace(/\s{3,}/g, '\n')
            .trim();
        }

        
        // Also use subject as vendor hint
        if (subject) {
          emailContent = `Subject: ${subject}\n` + emailContent;
        }
        // Clean the content before parsing
// Extract just the plain text body from MIME
        const plainTextMatch = emailContent.match(/Content-Type: text\/plain[^\n]*\n(?:[^\n]+\n)*\n([\s\S]*?)(?=\n--[a-zA-Z0-9])/i);
        if (plainTextMatch) {
          emailContent = plainTextMatch[1]
            .replace(/=\r?\n/g, '')
            .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
            .replace(/\[image:[^\]]+\]/g, '')
            .trim();
        } else {
          emailContent = emailContent
            .replace(/^[\s\S]*?(?=Thank you for your order|Server:|Check #|Transaction Information|Thank you for shopping)/m, '')
            .replace(/=\r?\n/g, '')
            .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
            .replace(/\[image:[^\]]+\]/g, '')
            .trim();
        }
        console.log('📧 Cleaned email content preview:', emailContent.substring(0, 200));
        extractedData = parseEmailText(emailContent);

                // Use from_email as vendor hint if no vendor detected
        if (!extractedData.vendor && from) {
          const fromDomain = from.match(/@([^.]+)\./)?.[1];
          if (fromDomain) {
            const domainVendorMap: Record<string, string> = {
              amazon: 'Amazon',
              meta: 'Meta',
              facebook: 'Meta',
              nintendo: 'Nintendo',
              google: 'Google',
              microsoft: 'Microsoft',
              apple: 'Apple',
              netflix: 'Netflix',
              spotify: 'Spotify',
            };
            extractedData.vendor = domainVendorMap[fromDomain.toLowerCase()] || fromDomain;
          }
        }
        vendorName = extractedData.vendor || vendorName;
                console.log('✅ Parsed from text:', extractedData);
      } catch (parseError) {
        console.error('❌ Parsing failed:', parseError);
      }
    }

// Extract line items from HTML for retailers like Best Buy
    let htmlLineItems: Array<{description: string, price_cents: number}> = [];
    if (html || rawEmail) {
      const htmlContent = html || extractHtmlFromMime(rawEmail || '');
      if (htmlContent) {
        htmlLineItems = extractBestBuyItems(htmlContent);
        console.log('🛒 HTML line items found:', htmlLineItems.length);
        if (htmlLineItems.length === 0 && htmlContent) {
        // Log a sample of the HTML to debug
        const sampleText = htmlContent
          .replace(/<[^>]+>/g, '\n')
          .replace(/\s{3,}/g, '\n')
          .trim()
          .substring(0, 500);
        console.log('🛒 HTML text sample:', sampleText);
      }
      }
    }

if (extractedData) {
      const { categorizeReceipt } = await import('@/lib/categorizeReceipt');
      const categorization = categorizeReceipt(extractedData.vendor || '', '');
      // Clean the raw text - strip MIME headers
const cleanRawText = (extractedData.raw_text || '')
        .replace(/^[\s\S]*?(?=---------- Forwarded message|Thank you for your order|Server:\s|Check #\d|Subtotal\s+\$|1 Mango|1 Nutella)/m, '')
        .replace(/Received: from[\s\S]*?(?=---------- Forwarded message|Thank you for your order)/m, '')
        .replace(/=\r?\n/g, '')
        .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)))
        .replace(/\[image:[^\]]+\]/g, '')
        .trim();
await supabase
        .from('email_receipts')
        .update({
          vendor: extractedData.vendor,
          receipt_date: extractedData.date,
          total_cents: extractedData.total_cents,
          tax_cents: extractedData.tax_cents || null,
          line_items_json: htmlLineItems.length > 0 ? htmlLineItems : null,
          extraction_status: 'completed',
          ocr_raw_text: cleanRawText || extractedData.raw_text,
          suggested_category: categorization.suggested_category,
          payment_method: extractedData.payment_method || null,
          card_brand: extractedData.card_brand || null,
          card_last_four: extractedData.card_last_four || null,
        })
        .eq('id', emailReceipt.id);
          }

// Save tax if extracted
    if (extractedData?.tax_cents && extractedData.tax_cents > 0 && emailReceipt.id) {
      try {
        await supabase.from('receipt_taxes').insert([{
          receipt_id: emailReceipt.id,
          firm_id: firmId,
          tax_type: 'HST',
          rate: 0.13,
          amount_cents: extractedData.tax_cents,
        }]);
      } catch {} // non-blocking
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

// Trigger SMS if client has it enabled
if (clientId) {
  try {
    const { data: clientSms } = await supabase
      .from('clients')
      .select('name, phone_number, sms_enabled, sms_timing, sms_end_of_day_time, timezone')
      .eq('id', clientId)
      .single();

    if (clientSms?.sms_enabled && clientSms?.phone_number) {
      const { getGreeting, formatPhone, getScheduledTime, getSuggestedPurposes } = await import('@/lib/twilio');
      const now = new Date();
      const greeting = getGreeting(now.getHours());
      const nameParts = clientSms.name.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : clientSms.name;
      const suggestions = getSuggestedPurposes(vendorName);
      const suggestionText = suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
      const amount = extractedData?.total_cents ? `$${(extractedData.total_cents / 100).toFixed(2)}` : 'an unknown amount';
      const message = `${greeting}, ${lastName}. We received your receipt via email from ${vendorName} for ${amount}. What was the purpose of this expense?\n\n${suggestionText}\n\nReply with a number or describe in your own words.`;

      const scheduledFor = getScheduledTime(
        clientSms.sms_timing || 'instant',
        clientSms.sms_end_of_day_time || '20:00',
        clientSms.timezone || 'America/Toronto'
      );

const { data: queueEntry } = await supabase.from('sms_queue').insert({
        client_id: clientId,
        firm_id: firmId,
        receipt_id: null,
        email_receipt_id: emailReceipt.id,
        message,
        suggested_purposes: suggestions,
        status: 'pending',
        scheduled_for: scheduledFor.toISOString(),
      }).select().single();

      if (clientSms.sms_timing === 'instant' && queueEntry) {
        const twilio = await import('twilio');
        const twilioClient = twilio.default(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: formatPhone(clientSms.phone_number),
        });
        await supabase.from('sms_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', queueEntry.id);
        console.log('📱 Email SMS sent successfully');
      }
    }
  } catch (smsErr) {
    console.error('📱 SMS trigger failed:', smsErr);
  }
}
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

function extractBestBuyItems(html: string): Array<{description: string, price_cents: number}> {
  const items: Array<{description: string, price_cents: number}> = [];
  // Match Best Buy HTML table rows with item info
  // Pattern: item name followed by price with H/N indicator
  const cleanHtml = html
    .replace(/=\r?\n/g, '')
    .replace(/=[0-9A-F]{2}/gi, (m: string) => String.fromCharCode(parseInt(m.slice(1), 16)));
  
  // Extract text content from HTML
  const text = cleanHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{3,}/g, '\n')
    .trim();

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Best Buy H/N price format
    const bbPrice = line.match(/^[HN]\s+\$?([\d,]+\.?\d*)$/);
    if (bbPrice && i > 0) {
      const desc = lines[i - 1].trim();
      const price = Math.round(parseFloat(bbPrice[1].replace(/,/g, '')) * 100);
      if (price > 0 && price < 500000 && desc.length > 3 &&
          !/^(subtotal|tax|total|payment|approved|finance|transaction|date|auth|val|store|gst|hst|province|summary)/i.test(desc)) {
        items.push({ description: desc.substring(0, 100), price_cents: price });
      }
    }
  }
  return items;
}

function parseEmailText(text: string): any {
  // Use the same extraction logic as image OCR
  // but feed it the email text directly
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Vendor detection from known senders
  const KNOWN_EMAIL_VENDORS: Record<string, string> = {
    'amazon': 'Amazon',
    'meta': 'Meta',
    'bestbuy': 'Best Buy',
    'best-buy': 'Best Buy',
    'bestbuy.ca': 'Best Buy',
    'facebook': 'Meta',
    'nintendo': 'Nintendo',
    'google': 'Google',
    'microsoft': 'Microsoft',
    'apple': 'Apple',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'adobe': 'Adobe',
    'dropbox': 'Dropbox',
    'zoom': 'Zoom',
    'shopify': 'Shopify',
    'stripe': 'Stripe',
    'paypal': 'PayPal',
  };

let vendor: string | null = null;

  // Check for specific store names first before product names
  if (/best buy/i.test(text)) vendor = 'Best Buy';
  else if (/walmart/i.test(text)) vendor = 'Walmart';
  else if (/costco/i.test(text)) vendor = 'Costco';
  else if (/canadian tire/i.test(text)) vendor = 'Canadian Tire';
  else if (/home depot/i.test(text)) vendor = 'Home Depot';
  else if (/staples/i.test(text)) vendor = 'Staples';
  else if (/tim hortons/i.test(text)) vendor = 'Tim Hortons';
  else if (/starbucks/i.test(text)) vendor = 'Starbucks';
  else if (/mcdonalds|mcdonald's/i.test(text)) vendor = "McDonald's";
  else if (/harvey's/i.test(text)) vendor = "Harvey's";

  // Try to extract vendor from Toast/restaurant email subject pattern
  // "Receipt for Order #85 at HEAL Wellness"
  const atVendorMatch = text.match(/(?:order|receipt)\s+(?:#\d+\s+)?at\s+([^\n<]+)/i);
  if (atVendorMatch) {
    vendor = atVendorMatch[1].trim().replace(/\s*-\s*.*$/, '').trim(); // Remove location suffix
  }

  // Try "Thank you for your order" followed by business name
  if (!vendor) {
    const thankYouMatch = text.match(/(?:thank you for your order|visit to)\s+([A-Z][^\n<.]+)/i);
    if (thankYouMatch) vendor = thankYouMatch[1].trim();
  }

  if (!vendor) {
    for (const [key, name] of Object.entries(KNOWN_EMAIL_VENDORS)) {
      if (text.toLowerCase().includes(key)) {
        vendor = name;
        break;
      }
    }
  }

  // Date patterns
  const monthMap: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04',
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  let date: string | null = null;
  for (const line of lines) {
    // "March 12, 2026" or "January 7, 2026"
    const namedMatch = line.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
    if (namedMatch) {
      const month = monthMap[namedMatch[1].toLowerCase()];
      const day = namedMatch[2].padStart(2, '0');
      date = `${namedMatch[3]}-${month}-${day}`;
      break;
    }
    // "02/23/2026"
    const numMatch = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
    if (numMatch) {
      date = `${numMatch[3]}-${numMatch[1].padStart(2, '0')}-${numMatch[2].padStart(2, '0')}`;
      break;
    }
    // "2026-01-07"
    const isoMatch = line.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
    if (isoMatch) {
      date = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
      break;
    }
  }

  // Total patterns
  let total_cents: number | null = null;
  for (const line of lines) {

// Toast POS format: "Total$31.64" or "Total $31.64"
    const toastTotal = line.match(/^total\$?([\d,.]+)$/i);
    if (toastTotal && !total_cents) {
      const val = Math.round(parseFloat(toastTotal[1].replace(/,/g, '')) * 100);
      if (val > 50) { total_cents = val; break; }
    }

// "Order Total: CDN$ 59.72" or "Grand Total: CDN$ 11.29" or "Total: $28.24"
    const orderTotal = line.match(/order\s+total[:\s]+(?:cdn\$?|ca\$?|cad\$?)?\s*([\d,.]+)/i);
    if (orderTotal) {
      total_cents = Math.round(parseFloat(orderTotal[1].replace(/,/g, '')) * 100);
      break;
    }
    const grandTotal = line.match(/grand\s+total[:\s]+(?:cdn\$?|ca\$?|cad\$?)?\s*([\d,.]+)/i);
    if (grandTotal) {
      total_cents = Math.round(parseFloat(grandTotal[1].replace(/,/g, '')) * 100);
      break;
    }
    const totalMatch = line.match(/^total[:\s]+(?:cdn\$?|ca\$?|cad\$?|\$)?\s*([\d,.]+)/i);
    if (totalMatch) {
      total_cents = Math.round(parseFloat(totalMatch[1].replace(/,/g, '')) * 100);
      break;
    }
    // "CDN$ 59.72" or "CA$6.78"
    const cadMatch = line.match(/(?:cdn|ca|cad)\$\s*([\d,.]+)/i);
    if (cadMatch && !total_cents) {
      const val = Math.round(parseFloat(cadMatch[1].replace(/,/g, '')) * 100);
      if (val > 50) total_cents = val;
    }
  }

// Tax patterns
  let tax_cents: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/tax/i.test(line)) console.log('🧾 Tax line found:', JSON.stringify(line));
        // "Tax Collected: CDN$ 1.30"
    const taxCollected = line.match(/tax\s+collected[:\s]+(?:cdn\$?|ca\$?|cad\$?)?\s*([\d,.]+)/i);
    if (taxCollected) {
      tax_cents = Math.round(parseFloat(taxCollected[1].replace(/,/g, '')) * 100);
      break;
    }
    // "Tax (13%) CA$0.78"
    const taxPercent = line.match(/tax\s+\(\d+%\)[:\s]+(?:ca\$?|cdn\$?|cad\$?)?\s*([\d,.]+)/i);
    if (taxPercent) {
      tax_cents = Math.round(parseFloat(taxPercent[1].replace(/,/g, '')) * 100);
      break;
    }

// "HST 13.00% of $2,539.98 $330.20"
    const hstPercent = line.match(/hst\s+[\d.]+%\s+of\s+\$[\d,.]+\s+\$?([\d,]+\.?\d*)/i);
    if (hstPercent) {
      tax_cents = Math.round(parseFloat(hstPercent[1].replace(/,/g, '')) * 100);
      break;
    }

    // Toast format: "Tax$3.64"
    const toastTax = line.match(/^tax\$?([\d,.]+)$/i);
    if (toastTax) {
      tax_cents = Math.round(parseFloat(toastTax[1].replace(/,/g, '')) * 100);
      break;
    }

// Toast format: "Tax" on one line, "$3.64" on next line
    if (/^tax$/i.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextAmount = nextLine.match(/^\$?([\d,.]+)$/);
      if (nextAmount) {
        tax_cents = Math.round(parseFloat(nextAmount[1].replace(/,/g, '')) * 100);
        break;
      }
    }

// "Tax $3.64" with space
    const taxSpace = line.match(/^tax\s+\$?([\d,.]+)$/i);
    if (taxSpace) {
      tax_cents = Math.round(parseFloat(taxSpace[1].replace(/,/g, '')) * 100);
      break;
    }

    // Simple "Tax: $1.30"
    const simpleTax = line.match(/^tax[:\s]+\$?\s*([\d,.]+)$/i);
    if (simpleTax) {
      tax_cents = Math.round(parseFloat(simpleTax[1].replace(/,/g, '')) * 100);
      break;
    }
  }

  // Payment info
let card_last_four: string | null = null;
  let card_brand: string | null = null;
  let payment_method: string | null = null;
    for (const line of lines) {
const cardMatch = line.match(/(?:mastercard|visa|amex)[^\d]*[·*]{4}\s*(\d{4})/i) ||
                      line.match(/card\s+number[:\s]+[*·\s]+(\d{4})/i);
    if (cardMatch) card_last_four = cardMatch[1];

// Best Buy format: "************3896 SC BBF $2,940.17"
    const bbCard = line.match(/\*+(\d{4})\s+SC\s+BBF/i);
    if (bbCard) {
      card_last_four = bbCard[1];
      card_brand = 'Visa'; // Best Buy uses Visa financing
      payment_method = 'card';
    }
    // Generic masked card: "************1234"
    const maskedCard = line.match(/\*{4,}(\d{4})/);
    if (maskedCard && !card_last_four) {
      card_last_four = maskedCard[1];
    }

// Toast format: "Mastercardxxxxxxxx2054" or "Mastercard xxxxxxxx2054"
    const toastCard = line.match(/(mastercard|visa|amex)\s*x+(\d{4})/i);
    if (toastCard) {
      card_brand = toastCard[1].charAt(0).toUpperCase() + toastCard[1].slice(1).toLowerCase();
      card_last_four = toastCard[2];
    }
        if (/mastercard/i.test(line) && !card_brand) card_brand = 'Mastercard';
    if (/\bvisa\b/i.test(line) && !card_brand) card_brand = 'Visa';
    if (/amex|american\s+express/i.test(line) && !card_brand) card_brand = 'Amex';
    if (/contactless|tap|chip|swipe/i.test(line) && card_brand) payment_method = 'card';
    }

// Strip MIME headers from raw_text before saving
  const cleanText = text
    .replace(/^[\s\S]*?(?=---------- Forwarded message|Thank you for your order|Server:|Check #)/m, '')
    .replace(/=\r?\n/g, '')
    .replace(/\[image:[^\]]+\]/g, '')
    .trim();

// Set payment_method if card was detected
  if (card_brand && !payment_method) payment_method = 'card';

  return {
    vendor,
    date,
    total_cents,
    tax_cents,
    card_last_four,
    card_brand,
    payment_method,
    raw_text: (cleanText || text).substring(0, 3000),
  };
}