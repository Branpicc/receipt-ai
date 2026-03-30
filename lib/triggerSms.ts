// lib/triggerSms.ts
import { createClient } from '@supabase/supabase-js';
import {
  getGreeting,
  formatPhone,
  getScheduledTime,
  getSuggestedPurposes,
} from '@/lib/twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function triggerSms(receiptId: string, clientId: string, firmId: string, source: 'upload' | 'email' | 'camera' = 'upload') {
    try {
    // Get client SMS preferences
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, phone_number, sms_enabled, sms_timing, sms_end_of_day_time, timezone')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.log('📱 SMS skipped: client not found');
      return { skipped: true, reason: 'Client not found' };
    }

    if (!client.sms_enabled || !client.phone_number) {
      console.log('📱 SMS skipped: not enabled or no phone number');
      return { skipped: true, reason: 'SMS not enabled for this client' };
    }

    // Get receipt details
    const { data: receipt } = await supabase
      .from('receipts')
      .select('vendor, total_cents, receipt_date, created_at')
      .eq('id', receiptId)
      .single();

    if (!receipt) {
      console.log('📱 SMS skipped: receipt not found');
      return { skipped: true, reason: 'Receipt not found' };
    }

    const suggestions = getSuggestedPurposes(receipt.vendor || '');
    const scheduledFor = getScheduledTime(
      client.sms_timing || 'instant',
      client.sms_end_of_day_time || '20:00',
      client.timezone || 'America/Toronto'
    );

    const now = new Date();
    const greeting = getGreeting(now.getHours());
    const amount = receipt.total_cents ? `$${(receipt.total_cents / 100).toFixed(2)}` : 'an unknown amount';
    const vendor = receipt.vendor || 'an unknown vendor';
    const timeStr = new Date(receipt.created_at).toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: client.timezone || 'America/Toronto',
    });

    const nameParts = client.name.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : client.name;
    const suggestionText = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

const sourceText = source === 'email' ? 'via email' : source === 'camera' ? 'via camera' : 'uploaded';
    const message = client.sms_timing === 'end_of_day'
      ? `${greeting}, ${lastName}. You submitted a receipt ${sourceText} from ${vendor} for ${amount}. What was the purpose? Reply with the number or type your own:\n${suggestionText}`
      : `${greeting}, ${lastName}. We received your receipt ${sourceText} from ${vendor} submitted at ${timeStr} for ${amount}. What was the purpose of this expense?\n\n${suggestionText}\n\nReply with a number or describe in your own words.`;
      
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

    console.log('📱 SMS queued:', queueEntry.id);

    // If instant, send immediately
    if (client.sms_timing === 'instant') {
      const twilio = await import('twilio');
      const client_twilio = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const formattedPhone = formatPhone(client.phone_number);
      console.log('📱 Sending SMS to:', formattedPhone);

      await client_twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: formattedPhone,
      });

      await supabase
        .from('sms_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', queueEntry.id);

      console.log('📱 SMS sent successfully');
      return { success: true, sent: true, queueId: queueEntry.id };
    }

    return { success: true, sent: false, scheduledFor, queueId: queueEntry.id };
  } catch (error: any) {
    console.error('📱 SMS trigger error:', error.message);
    return { error: error.message };
  }
}