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
        messages: [
          {
            role: 'user',
            content: `A client replied to a question about the purpose of a receipt from "${vendor}". Their reply was: "${rawReply}". Please write a clean, professional 1-sentence summary of the purpose suitable for a tax record. Be concise and factual. Reply with only the summary sentence, nothing else.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text?.trim();
    return summary || rawReply;
  } catch (error) {
    console.error('Failed to summarize purpose:', error);
    return rawReply;
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

    if (!clients || clients.length === 0) {
      console.log('No client found for phone:', from);
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Sorry, we could not find your account. Please contact your accountant.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const client = clients[0];

    // Find most recent sent SMS for this client
    const { data: queueEntry } = await supabase
      .from('sms_queue')
      .select('id, receipt_id, suggested_purposes, firm_id, batch_id, batch_index, batch_total')
      .eq('client_id', client.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (!queueEntry) {
      console.log('No pending SMS found for client:', client.id);
      return new NextResponse(
        '<?xml version="1.0"?><Response><Message>Thanks for your reply! We could not find a matching receipt. Please contact your accountant if you need help.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const { data: receipt } = await supabase
      .from('receipts')
      .select('vendor')
      .eq('id', queueEntry.receipt_id)
      .single();

    const suggestions = (queueEntry.suggested_purposes as string[]) || [];

    const purposeSummary = await summarizePurpose(
      body.trim(),
      receipt?.vendor || '',
      suggestions
    );

    // Save purpose to receipt
    await supabase
      .from('receipts')
      .update({
        purpose_text: purposeSummary,
        purpose_source: 'client',
        purpose_updated_at: new Date().toISOString(),
      })
      .eq('id', queueEntry.receipt_id);

    // Mark as replied
    await supabase
      .from('sms_queue')
      .update({
        status: 'replied',
        reply_text: body.trim(),
        reply_received_at: new Date().toISOString(),
      })
      .eq('id', queueEntry.id);

    // Notify accountant
    await supabase.from('notifications').insert({
      firm_id: client.firm_id,
      client_id: client.id,
      type: 'receipt_uploaded',
      title: 'Receipt purpose received',
      message: `${client.name} replied with purpose: "${purposeSummary}"`,
      receipt_id: queueEntry.receipt_id,
      read: false,
    });

    console.log('✅ Purpose saved:', queueEntry.receipt_id, '-', purposeSummary);

    // Check if more receipts in this batch
    const batchId = queueEntry.batch_id;
    const batchIndex = queueEntry.batch_index || 1;
    const batchTotal = queueEntry.batch_total || 1;
    const hasMoreInBatch = batchId && batchIndex < batchTotal;

    let confirmMessage = `Got it! We've saved the purpose as: "${purposeSummary}". Thank you!`;

    if (hasMoreInBatch) {
      const { sendNextBatchSms } = await import('@/lib/triggerSms');
      const nextEntry = await sendNextBatchSms(client.id, batchId);

      if (nextEntry) {
        confirmMessage = `Got it! Purpose saved for receipt ${batchIndex} of ${batchTotal}. Sending receipt ${batchIndex + 1} of ${batchTotal} now...`;
      }
    }

    return new NextResponse(
      `<?xml version="1.0"?><Response><Message>${confirmMessage}</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error: any) {
    console.error('Inbound SMS error:', error);
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}