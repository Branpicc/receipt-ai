// app/api/sms/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

function parseMultiReply(body: string): Record<number, string> {
  const results: Record<number, string> = {};
  const pattern = /(\d+)\s*[:.\s]\s*([^0-9]+?)(?=\s*\d+\s*[:.\s]|$)/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const num = parseInt(match[1]);
    const text = match[2].trim();
    if (text.length > 0) {
      results[num] = text;
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

        const { data: receipt } = await supabase
          .from('receipts')
          .select('vendor')
          .eq('id', entry.receipt_id)
          .single();

        const suggestions = (entry.suggested_purposes as string[]) || [];
        const purposeSummary = await summarizePurpose(purposeText, receipt?.vendor || '', suggestions);

        const { error: updateError } = await supabase.from('receipts').update({
          purpose_text: purposeSummary,
          purpose_source: 'client',
          purpose_updated_at: new Date().toISOString(),
        }).eq('id', entry.receipt_id);

        if (updateError) console.error('❌ Failed to save purpose:', updateError);
        else console.log('✅ Purpose saved:', purposeSummary, 'for receipt:', entry.receipt_id);

        if (!updateError && receipt?.vendor) {
          await recategorizeAfterPurpose(entry.receipt_id, receipt.vendor, purposeSummary, client.firm_id);
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
          receipt_id: entry.receipt_id,
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
        `<?xml version="1.0"?><Response><Message>${confirmMessage}</Message></Response>`,
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
        `<?xml version="1.0"?><Response><Message>${confirmMessage}</Message></Response>`,
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