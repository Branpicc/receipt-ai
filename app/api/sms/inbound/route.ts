// app/api/sms/inbound/route.ts
// Twilio webhook — called when a client replies to an SMS
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use Claude to clean up and summarize the client's reply
async function summarizePurpose(
  rawReply: string,
  vendor: string,
  suggestions: string[]
): Promise<string> {
  try {
    // If they replied with a number, map it to the suggestion
    const trimmed = rawReply.trim();
    const num = parseInt(trimmed);
    if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
      return suggestions[num - 1];
    }

    // Otherwise use Claude to clean up the free-text response
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
            content: `A client replied to a question about the purpose of a receipt from "${vendor}". Their reply was: "${rawReply}". 
            
Please write a clean, professional 1-sentence summary of the purpose suitable for a tax record. Be concise and factual. Reply with only the summary sentence, nothing else.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text?.trim();
    return summary || rawReply;
  } catch (error) {
    console.error('Failed to summarize purpose:', error);
    return rawReply; // Fall back to raw reply
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse Twilio webhook body (form-encoded)
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    console.log('📱 Inbound SMS from:', from, 'Body:', body);

    if (!from || !body) {
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Normalize phone number for lookup
    const normalizedPhone = from.replace(/\D/g, '');

    // Find client by phone number
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

    // Find the most recent pending SMS queue entry for this client
    const { data: queueEntry } = await supabase
      .from('sms_queue')
      .select('id, receipt_id, suggested_purposes, firm_id')
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

    // Get receipt details for context
    const { data: receipt } = await supabase
      .from('receipts')
      .select('vendor')
      .eq('id', queueEntry.receipt_id)
      .single();

    const suggestions = (queueEntry.suggested_purposes as string[]) || [];

    // Summarize the purpose using AI
    const purposeSummary = await summarizePurpose(
      body.trim(),
      receipt?.vendor || '',
      suggestions
    );

    // Save purpose to receipt
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        purpose_text: purposeSummary,
        purpose_source: 'client',
        purpose_updated_at: new Date().toISOString(),
      })
      .eq('id', queueEntry.receipt_id);

    if (updateError) {
      console.error('Failed to update receipt purpose:', updateError);
    }

    // Mark SMS queue entry as replied
    await supabase
      .from('sms_queue')
      .update({
        status: 'replied',
        reply_text: body.trim(),
        reply_received_at: new Date().toISOString(),
      })
      .eq('id', queueEntry.id);

// Create notification for accountant
await supabase.from('notifications').insert({
  firm_id: client.firm_id,
  client_id: client.id,
  type: 'receipt_uploaded',
  title: 'Receipt purpose received',
  message: `${client.name} replied with purpose: "${purposeSummary}"`,
  receipt_id: queueEntry.receipt_id,
  read: false,
});

    console.log('✅ Purpose saved for receipt:', queueEntry.receipt_id, '-', purposeSummary);

    // Reply to client confirming receipt
    return new NextResponse(
      `<?xml version="1.0"?><Response><Message>Got it! We've saved the purpose as: "${purposeSummary}". Thank you!</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error: any) {
    console.error('Inbound SMS error:', error);
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}