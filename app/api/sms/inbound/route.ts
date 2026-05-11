// app/api/sms/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { escapeXml } from '@/lib/xmlEscape';

// Verifies the request actually came from Twilio by recomputing the
// HMAC-SHA1 signature Twilio sends in X-Twilio-Signature. Without this,
// anyone who learns the webhook URL could POST a fake reply attributed to
// any client phone number.
//
// Fail-soft mode: if the signature doesn't match (often due to URL
// mismatch — e.g. Twilio webhook configured as receipture.ca but
// NEXT_PUBLIC_APP_URL is www.receipture.ca), we still accept the request
// but log a warning so it's visible in Vercel logs. To enforce strict
// rejection, set TWILIO_STRICT_SIGNATURE=true in the env.
async function isValidTwilioRequest(
  request: NextRequest,
  params: Record<string, string>
): Promise<boolean> {
  // Skip in development — ngrok / local testing can't easily produce a
  // valid Twilio signature, and we don't want to block local debugging.
  if (process.env.NODE_ENV !== "production") return true;

  const signature = request.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const strict = process.env.TWILIO_STRICT_SIGNATURE === "true";

  if (!signature || !authToken) {
    if (strict) return false;
    console.warn("[sms/inbound] missing signature header or TWILIO_AUTH_TOKEN — accepting in fail-soft mode (set TWILIO_STRICT_SIGNATURE=true to enforce)");
    return true;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${request.headers.get("host") || "receipture.ca"}`;
  const url = `${baseUrl.replace(/\/$/, "")}/api/sms/inbound`;

  try {
    const twilio = await import("twilio");
    const valid = twilio.default.validateRequest(authToken, signature, url, params);
    if (!valid) {
      if (strict) {
        console.warn(`[sms/inbound] signature mismatch — strict mode rejected. Computed against URL: ${url}`);
        return false;
      }
      console.warn(`[sms/inbound] signature mismatch — accepting in fail-soft mode. Check that Twilio's webhook URL exactly matches '${url}' (set TWILIO_STRICT_SIGNATURE=true to enforce)`);
      return true;
    }
    return true;
  } catch (err) {
    console.error("[sms/inbound] signature verification threw:", err);
    return !strict;
  }
}

// Wraps user-controlled text in TwiML safely. Without escapeXml, a reply
// containing & or < would break the response parser.
function twimlMessage(message: string): string {
  return `<?xml version="1.0"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function summarizePurpose(
  rawReply: string,
  vendor: string,
  suggestions: string[]
): Promise<string> {
  try {
    const trimmed = rawReply.trim();
    const num = parseInt(trimmed);
    if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
      return suggestions[num - 1];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `A client replied about the purpose of a receipt from "${vendor}". Their reply: "${rawReply}". Write a clean, professional 1-sentence summary for a tax record. Reply with only the summary, nothing else.`,
        }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || rawReply;
  } catch {
    return rawReply;
  }
}

// Parse a reply like "1: business expense 2: gift for partner 3: medication"
// into { 1: "business expense", 2: "gift for partner", 3: "medication" }.
//
// Strategy: split on the position BEFORE each "<digit>:" or "<digit>." token,
// then for each segment match "<digit><sep><text>". This is more robust than
// a single global regex with lookahead because:
//   - it correctly handles purposes containing digits (e.g. "$50 dinner")
//   - it requires a colon or period as the separator (a single space, like
//     in the previous regex's [:.\s] class, was too lenient and made the
//     lookahead fail on real input)
//   - it explicitly anchors on a word boundary so we don't split inside
//     things like "1.5" or phone numbers.
function parseMultiReply(body: string): Record<number, string> {
  const results: Record<number, string> = {};
  const segments = body.split(/(?=\b\d+\s*[:.])/);
  for (const seg of segments) {
    const match = seg.match(/^\s*(\d+)\s*[:.]\s*([\s\S]+?)\s*$/);
    if (match) {
      const num = parseInt(match[1]);
      const text = match[2].trim();
      if (text.length > 0) results[num] = text;
    }
  }
  if (Object.keys(results).length === 0 && body.trim().length > 0) {
    results[0] = body.trim();
  }
  return results;
}

async function recategorizeAfterPurpose(receiptId: string, vendor: string, purposeSummary: string, firmId: string) {
  try {
    const { categorizeReceipt } = await import('@/lib/categorizeReceipt');
    
    // Check vendor history for pattern learning
    const { data: pastReceipts } = await supabase
      .from('receipts')
      .select('approved_category, suggested_category')
      .eq('firm_id', firmId)
      .eq('vendor', vendor)
      .not('approved_category', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    // If 2+ past receipts from same vendor have same approved category, use it
    if (pastReceipts && pastReceipts.length >= 2) {
      const categoryCounts: Record<string, number> = {};
      pastReceipts.forEach(r => {
        if (r.approved_category) {
          categoryCounts[r.approved_category] = (categoryCounts[r.approved_category] || 0) + 1;
        }
      });
      const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
if (topCategory && topCategory[1] >= 2) {
        await supabase.from('receipts').update({
          suggested_category: topCategory[0],
          approved_category: topCategory[0],
          category_confidence: 90,
          category_reasoning: `Auto-approved: ${topCategory[1]} previous ${vendor} receipts categorized as ${topCategory[0]}`,
        }).eq('id', receiptId);
                console.log('🧠 Pattern-based category applied:', topCategory[0]);
        return;
      }
    }

    // Otherwise re-run categorization with vendor + purpose
    const result = categorizeReceipt(vendor, purposeSummary);
    if (result.suggested_category) {
      await supabase.from('receipts').update({
        suggested_category: result.suggested_category,
        category_confidence: result.category_confidence,
        category_reasoning: result.category_reasoning,
      }).eq('id', receiptId);
      console.log('🏷️ Re-categorized after purpose:', result.suggested_category);
    }
  } catch (err: any) {
    console.error('❌ Re-categorization failed:', err.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Build a plain-string param map for signature verification.
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    if (!(await isValidTwilioRequest(request, params))) {
      console.warn("[sms/inbound] rejected request — invalid Twilio signature");
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        status: 403,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    console.log('📱 Inbound SMS from:', from, 'Body:', body);

    if (!from || !body) {
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const normalizedPhone = from.replace(/\D/g, '');

const { data: clients } = await supabase
      .from('clients')
      .select('id, name, firm_id, timezone')
      .or(`phone_number.eq.${from},phone_number.eq.+${normalizedPhone},phone_number.eq.${normalizedPhone}`);

    console.log('📱 Phone lookup:', from, 'normalized:', normalizedPhone, 'clients found:', clients?.length);

    if (!clients || clients.length === 0) {
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Sorry, we could not find your account. Please contact your accountant.</Message></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
      );
    }

// Search across ALL clients with this phone number
    const clientIds = clients.map(c => c.id);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: sentEntries } = await supabase
      .from('sms_queue')
.select('id, receipt_id, email_receipt_id, suggested_purposes, firm_id, batch_id, batch_index, batch_total, status, client_id')
      .in('client_id', clientIds)
      .eq('status', 'sent')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Use the client from the most recent queue entry
    const client = sentEntries && sentEntries.length > 0
      ? clients.find(c => c.id === sentEntries[0].client_id) || clients[0]
      : clients[0];

    console.log('📱 Sent entries found:', sentEntries?.length, 'in last 24h');

    if (!sentEntries || sentEntries.length === 0) {
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Thanks! We could not find a matching receipt. Please contact your accountant if you need help.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const parsed = parseMultiReply(body.trim());
    const parsedKeys = Object.keys(parsed).map(Number);
    const isMultiReply = parsedKeys.length > 1;

    let savedCount = 0;
    let confirmParts: string[] = [];

    if (isMultiReply) {
      const mostRecentEntry = sentEntries[0];
      const batchId = mostRecentEntry.batch_id;
      const batchEntries = batchId
        ? sentEntries.filter(e => e.batch_id === batchId)
        : [mostRecentEntry];

      for (const [numStr, purposeText] of Object.entries(parsed)) {
        const num = parseInt(numStr);
        const entry = batchEntries.find(e => e.batch_index === num);
        if (!entry) continue;

        // The same multi-reply might span both regular receipts (queue
        // entries with receipt_id) and forwarded email receipts (entries
        // with email_receipt_id). Resolve which row to update per entry
        // — the previous version only handled receipt_id and silently
        // dropped the purpose for any email-receipt slot.
        const isEmailReceipt = !entry.receipt_id && !!(entry as any).email_receipt_id;
        const targetTable = isEmailReceipt ? 'email_receipts' : 'receipts';
        const targetId = isEmailReceipt ? (entry as any).email_receipt_id : entry.receipt_id;
        if (!targetId) continue;

        const { data: target } = await supabase
          .from(targetTable)
          .select('vendor')
          .eq('id', targetId)
          .single();

        const suggestions = (entry.suggested_purposes as string[]) || [];
        const purposeSummary = await summarizePurpose(purposeText, target?.vendor || '', suggestions);

        const updatePayload: Record<string, any> = isEmailReceipt
          ? { purpose_text: purposeSummary }
          : {
              purpose_text: purposeSummary,
              purpose_source: 'client',
              purpose_updated_at: new Date().toISOString(),
            };
        const { error: updateError } = await supabase
          .from(targetTable)
          .update(updatePayload)
          .eq('id', targetId);

        if (updateError) console.error('❌ Failed to save purpose:', updateError);
        else console.log('✅ Purpose saved:', purposeSummary, `for ${targetTable}:`, targetId);

        // Re-categorisation only applies to regular receipts.
        if (!updateError && !isEmailReceipt && target?.vendor) {
          await recategorizeAfterPurpose(targetId, target.vendor, purposeSummary, client.firm_id);
        }

        await supabase.from('sms_queue').update({
          status: 'replied',
          reply_text: purposeText,
          reply_received_at: new Date().toISOString(),
        }).eq('id', entry.id);

        await supabase.from('notifications').insert({
          firm_id: client.firm_id,
          client_id: client.id,
          type: 'receipt_uploaded',
          title: 'Receipt purpose received',
          message: `${client.name} — receipt ${num}: "${purposeSummary}"`,
          receipt_id: isEmailReceipt ? null : targetId,
          read: false,
        });

        confirmParts.push(`${num}: ${purposeSummary}`);
        savedCount++;
      }

      const allReplied = batchEntries.every(e =>
        confirmParts.some((_, i) => parsedKeys[i] === e.batch_index) ||
        e.status === 'replied'
      );

      const confirmMessage = savedCount > 0
        ? `Got it! Saved ${savedCount} purpose${savedCount > 1 ? 's' : ''}:\n${confirmParts.join('\n')}${allReplied ? '\n\nAll done! ✅' : ''}`
        : `Hmm, we couldn't match your reply to a receipt. Try "1: purpose" format.`;

      return new NextResponse(
        twimlMessage(confirmMessage),
        { headers: { 'Content-Type': 'text/xml' } }
      );

    } else {
      // Single reply — find most recent entry with a valid receipt_id
      const queueEntry = sentEntries.find(e => e.receipt_id !== null) || sentEntries[0];
      console.log('📱 Queue entry found:', queueEntry?.id, 'receipt_id:', queueEntry?.receipt_id);

if (!queueEntry.receipt_id && !(queueEntry as any).email_receipt_id) {
        return new NextResponse(
          '<?xml version="1.0"?><Response><Message>Thanks for your reply! We could not find a matching receipt. Please contact your accountant.</Message></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      const { data: receipt } = await supabase
        .from('receipts')
        .select('vendor')
        .eq('id', queueEntry.receipt_id)
        .single();

      const suggestions = (queueEntry.suggested_purposes as string[]) || [];
      const purposeText = parsed[0] || body.trim();
      const purposeSummary = await summarizePurpose(purposeText, receipt?.vendor || '', suggestions);

let updateError = null;
      if (queueEntry.receipt_id) {
        const { error } = await supabase.from('receipts').update({
          purpose_text: purposeSummary,
          purpose_source: 'client',
          purpose_updated_at: new Date().toISOString(),
        }).eq('id', queueEntry.receipt_id);
        updateError = error;
      } else if ((queueEntry as any).email_receipt_id) {
        const { error } = await supabase.from('email_receipts').update({
          purpose_text: purposeSummary,
        }).eq('id', (queueEntry as any).email_receipt_id);
        updateError = error;
      }

      if (updateError) {
        console.error('❌ Failed to save purpose:', updateError);
      } else {
        console.log('✅ Purpose saved:', purposeSummary, 'for receipt:', queueEntry.receipt_id);
      }

      // Re-categorize with vendor + purpose
      if (!updateError && receipt?.vendor) {
        await recategorizeAfterPurpose(queueEntry.receipt_id, receipt.vendor, purposeSummary, client.firm_id);
      }

      await supabase.from('sms_queue').update({
        status: 'replied',
        reply_text: body.trim(),
        reply_received_at: new Date().toISOString(),
      }).eq('id', queueEntry.id);

      await supabase.from('notifications').insert({
        firm_id: client.firm_id,
        client_id: client.id,
        type: 'receipt_uploaded',
        title: 'Receipt purpose received',
        message: `${client.name} replied: "${purposeSummary}"`,
        receipt_id: queueEntry.receipt_id,
        read: false,
      });

      const batchId = queueEntry.batch_id;
      const batchIndex = queueEntry.batch_index || 1;
      const batchTotal = queueEntry.batch_total || 1;
      const remaining = batchTotal - batchIndex;

      let confirmMessage = `Got it! Saved: "${purposeSummary}"`;
      if (remaining > 0 && batchId) {
        confirmMessage += `\n\n${remaining} receipt${remaining > 1 ? 's' : ''} still need a purpose. Reply with their numbers, e.g. "${batchIndex + 1}: purpose"`;
      } else {
        confirmMessage += ' ✅';
      }

      return new NextResponse(
        twimlMessage(confirmMessage),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

  } catch (error: any) {
    console.error('Inbound SMS error:', error);
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}