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

// Parse multi-receipt replies like "1: lunch 2: office supplies 3: fuel"
// or single "1: lunch with client"
function parseMultiReply(body: string): Record<number, string> {
  const results: Record<number, string> = {};

  // Match patterns like "1: text" or "1. text" with optional following numbers
  const pattern = /(\d+)\s*[:.\s]\s*([^0-9]+?)(?=\s*\d+\s*[:.\s]|$)/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const num = parseInt(match[1]);
    const text = match[2].trim();
    if (text.length > 0) {
      results[num] = text;
    }
  }

  // If no numbered pattern found, treat whole message as single reply
  if (Object.keys(results).length === 0 && body.trim().length > 0) {
    results[0] = body.trim(); // 0 = apply to current pending receipt
  }

  return results;
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

    if (!clients || clients.length === 0) {
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Sorry, we could not find your account. Please contact your accountant.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const client = clients[0];

    // Get all sent SMS entries for this client to handle batch replies
const { data: sentEntries } = await supabase
      .from('sms_queue')
      .select('id, receipt_id, suggested_purposes, firm_id, batch_id, batch_index, batch_total, status')
            .eq('client_id', client.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(10);

    if (!sentEntries || sentEntries.length === 0) {
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Thanks! We could not find a matching receipt. Please contact your accountant if you need help.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Parse the reply — may contain multiple numbered purposes
    const parsed = parseMultiReply(body.trim());
    const parsedKeys = Object.keys(parsed).map(Number);
    const isMultiReply = parsedKeys.length > 1 || (parsedKeys.length === 1 && parsedKeys[0] > 0);

    let savedCount = 0;
    let confirmParts: string[] = [];

    if (isMultiReply) {
      // Multi-reply: match numbers to batch entries
      const mostRecentEntry = sentEntries[0];
      const batchId = mostRecentEntry.batch_id;

      // Get all sent entries for this batch
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

        await supabase.from('receipts').update({
          purpose_text: purposeSummary,
          purpose_source: 'client',
          purpose_updated_at: new Date().toISOString(),
        }).eq('id', entry.receipt_id);

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

      // Check if all batch receipts are now replied
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
      // Single reply — apply to most recent sent receipt
      const queueEntry = sentEntries[0];

      const { data: receipt } = await supabase
        .from('receipts')
        .select('vendor')
        .eq('id', queueEntry.receipt_id)
        .single();

      const suggestions = (queueEntry.suggested_purposes as string[]) || [];
      const purposeText = parsed[0] || body.trim();
      const purposeSummary = await summarizePurpose(purposeText, receipt?.vendor || '', suggestions);

      await supabase.from('receipts').update({
        purpose_text: purposeSummary,
        purpose_source: 'client',
        purpose_updated_at: new Date().toISOString(),
      }).eq('id', queueEntry.receipt_id);

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