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

export async function triggerSms(
  receiptId: string,
  clientId: string,
  firmId: string,
  source: 'upload' | 'email' | 'camera' = 'upload',
  batchId?: string,
  batchIndex: number = 1,
  batchTotal: number = 1
) {
  try {
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

    const nameParts = client.name.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : client.name;
    const amount = receipt.total_cents ? `$${(receipt.total_cents / 100).toFixed(2)}` : 'unknown amount';
    const vendor = receipt.vendor || 'unknown vendor';

    // For single receipts — keep original format
    const now = new Date();
    const greeting = getGreeting(now.getHours());
    const timeStr = new Date(receipt.created_at).toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: client.timezone || 'America/Toronto',
    });
    const suggestionText = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const sourceText = source === 'email' ? 'via email' : source === 'camera' ? 'via camera' : 'uploaded';

    const message = batchTotal === 1
      ? (client.sms_timing === 'end_of_day'
          ? `${greeting}, ${lastName}. You submitted a receipt ${sourceText} from ${vendor} for ${amount}. What was the purpose? Reply with a number or type your own:\n${suggestionText}`
          : `${greeting}, ${lastName}. We received your receipt ${sourceText} from ${vendor} at ${timeStr} for ${amount}. What was the purpose?\n\n${suggestionText}\n\nReply with a number or describe in your own words.`)
      : `queued`; // batch receipts — message will be sent as one combined SMS by sendBatchSms()

    // Queue the SMS
    const isFirstInBatch = batchIndex === 1;
    const status = batchTotal > 1 ? 'pending_batch' : 'pending';

    const { data: queueEntry, error: queueError } = await supabase
      .from('sms_queue')
      .insert({
        client_id: clientId,
        firm_id: firmId,
        receipt_id: receiptId,
        message,
        suggested_purposes: suggestions,
        status,
        scheduled_for: scheduledFor.toISOString(),
        batch_id: batchId || null,
        batch_index: batchIndex,
        batch_total: batchTotal,
      })
      .select()
      .single();

    if (queueError) throw queueError;

    console.log(`📱 SMS queued (${batchIndex}/${batchTotal}):`, queueEntry.id);

    // For single receipts — send immediately if instant
    if (batchTotal === 1 && client.sms_timing === 'instant') {
      const twilio = await import('twilio');
      const client_twilio = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const formattedPhone = formatPhone(client.phone_number);
      await client_twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: formattedPhone,
      });

      await supabase
        .from('sms_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', queueEntry.id);

      console.log('📱 Single SMS sent successfully');
      return { success: true, sent: true, queueId: queueEntry.id };
    }

// For batches — wait for all receipts to be queued then send combined SMS
    if (batchTotal > 1 && client.sms_timing === 'instant') {
      // Wait a moment for other uploads to finish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check how many batch entries are now queued
      const { data: batchEntries } = await supabase
        .from('sms_queue')
        .select('id')
        .eq('client_id', clientId)
        .eq('batch_id', batchId!)
        .eq('status', 'pending_batch');

      // Only send if we have all entries OR this is the last expected one
      if (batchEntries && (batchEntries.length >= batchTotal || batchIndex === batchTotal)) {
        await sendBatchSms(clientId, batchId!, firmId);
      }
    }

    return { success: true, sent: false, scheduledFor, queueId: queueEntry.id };
  } catch (error: any) {
    console.error('📱 SMS trigger error:', error.message);
    return { error: error.message };
  }
}

// Send one combined SMS listing all receipts in the batch
export async function sendBatchSms(clientId: string, batchId: string, firmId: string) {
  try {
    // Check if batch SMS already sent (prevent duplicate sends)
    const { data: alreadySent } = await supabase
      .from('sms_queue')
      .select('id')
      .eq('client_id', clientId)
      .eq('batch_id', batchId)
      .eq('status', 'sent')
      .limit(1);

    if (alreadySent && alreadySent.length > 0) {
      console.log('📱 Batch SMS already sent, skipping');
      return null;
    }

    // Get all queued receipts for this batch
    const { data: batchEntries } = await supabase
      .from('sms_queue')
      .select('*, receipts:receipt_id(vendor, total_cents)')
      .eq('client_id', clientId)
      .eq('batch_id', batchId)
      .eq('status', 'pending_batch')
      .order('batch_index', { ascending: true });

    if (!batchEntries || batchEntries.length === 0) return null;
        const { data: client } = await supabase
      .from('clients')
      .select('name, phone_number, timezone')
      .eq('id', clientId)
      .single();

    if (!client?.phone_number) return null;

    const nameParts = client.name.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : client.name;
    const now = new Date();
    const greeting = getGreeting(now.getHours());
    const total = batchEntries.length;

    // Build receipt list
    const receiptLines = batchEntries.map((entry: any) => {
      const vendor = entry.receipts?.vendor || 'Unknown vendor';
      const amount = entry.receipts?.total_cents
        ? `$${(entry.receipts.total_cents / 100).toFixed(2)}`
        : 'unknown amount';
      return `${entry.batch_index}. ${vendor} — ${amount}`;
    }).join('\n');

    const message = `${greeting}, ${lastName}. We received ${total} receipts:\n\n${receiptLines}\n\nReply with the number and purpose for each:\n"1: purpose" or all at once:\n"1: purpose 2: purpose 3: purpose"`;

    // Send the combined SMS
    const twilio = await import('twilio');
    const client_twilio = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const formattedPhone = formatPhone(client.phone_number);
    await client_twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: formattedPhone,
    });

    // Mark all batch entries as sent with the combined message
    const ids = batchEntries.map((e: any) => e.id);
    await supabase
      .from('sms_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString(), message })
      .in('id', ids);

    console.log(`📱 Batch SMS sent for ${total} receipts`);
    return { success: true, count: total };
  } catch (error: any) {
    console.error('📱 sendBatchSms error:', error.message);
    return null;
  }
}

// Called after a client replies to a single receipt — sends next if sequential mode
export async function sendNextBatchSms(clientId: string, batchId: string) {
  try {
    const { data: nextEntry } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('client_id', clientId)
      .eq('batch_id', batchId)
      .eq('status', 'pending_batch')
      .order('batch_index', { ascending: true })
      .limit(1)
      .single();

    if (!nextEntry) {
      console.log('📱 No more receipts in batch');
      return null;
    }

    const { data: client } = await supabase
      .from('clients')
      .select('phone_number')
      .eq('id', clientId)
      .single();

    if (!client?.phone_number) return null;

    const twilio = await import('twilio');
    const client_twilio = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    await client_twilio.messages.create({
      body: nextEntry.message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: formatPhone(client.phone_number),
    });

    await supabase
      .from('sms_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', nextEntry.id);

    console.log(`📱 Sent next batch SMS ${nextEntry.batch_index}/${nextEntry.batch_total}`);
    return nextEntry;
  } catch (error: any) {
    console.error('📱 sendNextBatchSms error:', error.message);
    return null;
  }
}