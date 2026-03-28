// app/api/sms/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  twilioClient,
  TWILIO_FROM,
  getGreeting,
  formatPhone,
  getScheduledTime,
  getSuggestedPurposes,
} from '@/lib/twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { receiptId, clientId, firmId } = await request.json();

    if (!receiptId || !clientId || !firmId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get client SMS preferences
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, phone_number, sms_enabled, sms_timing, sms_end_of_day_time, timezone')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Skip if SMS not enabled or no phone number
    if (!client.sms_enabled || !client.phone_number) {
      return NextResponse.json({ skipped: true, reason: 'SMS not enabled for this client' });
    }

    // Get receipt details
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('vendor, total_cents, receipt_date, created_at')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Get suggested purposes based on vendor
    const suggestions = getSuggestedPurposes(receipt.vendor || '');

    // Calculate scheduled time
    const scheduledFor = getScheduledTime(
      client.sms_timing || 'instant',
      client.sms_end_of_day_time || '20:00',
      client.timezone || 'America/Toronto'
    );

    // Build message
    const now = new Date();
    const hour = now.getHours();
    const greeting = getGreeting(hour);
    const amount = receipt.total_cents ? `$${(receipt.total_cents / 100).toFixed(2)}` : 'an unknown amount';
    const vendor = receipt.vendor || 'an unknown vendor';
    const timeStr = new Date(receipt.created_at).toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: client.timezone || 'America/Toronto',
    });

    // Get client last name for formal greeting
    const nameParts = client.name.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : client.name;

    const suggestionText = suggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');

    let message: string;

    if (client.sms_timing === 'end_of_day') {
      // End of day: we'll send a batch — this single receipt gets queued
      // The batch job will compile all receipts for the day
      message = `${greeting}, ${lastName}. You submitted a receipt from ${vendor} for ${amount}. What was the purpose? Reply with the number or type your own:\n${suggestionText}`;
    } else {
      message = `${greeting}, ${lastName}. We received your receipt from ${vendor} submitted at ${timeStr} for ${amount}. What was the purpose of this expense?\n\n${suggestionText}\n\nReply with a number or describe in your own words.`;
    }

    // Queue the SMS
    const { data: queueEntry, error: queueError } = await supabase
      .from('sms_queue')
      .insert({
        client_id: clientId,
        firm_id: firmId,
        receipt_id: receiptId,
        message,
        suggested_purposes: suggestions,
        status: 'pending',
        scheduled_for: scheduledFor.toISOString(),
      })
      .select()
      .single();

    if (queueError) throw queueError;

    // If instant, send immediately
    if (client.sms_timing === 'instant') {
      const formattedPhone = formatPhone(client.phone_number);

      await twilioClient.messages.create({
        body: message,
        from: TWILIO_FROM,
        to: formattedPhone,
      });

      // Update queue entry to sent
      await supabase
        .from('sms_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', queueEntry.id);

      return NextResponse.json({ success: true, sent: true, queueId: queueEntry.id });
    }

    // Otherwise it's queued for later — cron will pick it up
    return NextResponse.json({ success: true, sent: false, scheduledFor, queueId: queueEntry.id });

  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}