// app/api/cron/process-sms-queue/route.ts
// Runs every 5 minutes via Vercel Cron
// Add to vercel.json:
// { "path": "/api/cron/process-sms-queue", "schedule": "*/5 * * * *" }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { twilioClient, TWILIO_FROM, formatPhone } from '@/lib/twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // Find all pending SMS that are due to be sent
    const { data: dueMessages, error } = await supabase
      .from('sms_queue')
      .select(`
        id,
        client_id,
        receipt_id,
        message,
        suggested_purposes,
        clients (
          name,
          phone_number,
          sms_timing,
          timezone
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50);

    if (error) throw error;

    const results = { total: dueMessages?.length || 0, sent: 0, failed: 0 };

    for (const entry of dueMessages || []) {
      const client = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;

      if (!client?.phone_number) {
        await supabase.from('sms_queue').update({ status: 'failed' }).eq('id', entry.id);
        results.failed++;
        continue;
      }

      try {
        // For end_of_day, check if there are multiple receipts to batch
        if (client.sms_timing === 'end_of_day') {
          // Get all pending receipts for today for this client
          const { data: allPending } = await supabase
            .from('sms_queue')
            .select('id, receipt_id, message')
            .eq('client_id', entry.client_id)
            .eq('status', 'pending')
            .lte('scheduled_for', now);

          if (allPending && allPending.length > 1) {
            // Build batch message
            const receiptIds = allPending.map(p => p.receipt_id);
            const { data: receipts } = await supabase
              .from('receipts')
              .select('id, vendor, total_cents')
              .in('id', receiptIds);

            const nameParts = client.name.trim().split(' ');
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : client.name;

            let batchMessage = `Good evening, ${lastName}. Here's a summary of today's receipts:\n\n`;
            receipts?.forEach((r, i) => {
              const amount = r.total_cents ? `$${(r.total_cents / 100).toFixed(2)}` : 'unknown amount';
              batchMessage += `${i + 1}. ${r.vendor || 'Unknown vendor'} — ${amount}\n`;
            });
            batchMessage += `\nPlease reply with the purpose for each (e.g. "1. Client meeting, 2. Office supplies")`;

            await twilioClient.messages.create({
              body: batchMessage,
              from: TWILIO_FROM,
              to: formatPhone(client.phone_number),
            });

            // Mark all as sent
            const sentAt = new Date().toISOString();
            for (const pending of allPending) {
              await supabase
                .from('sms_queue')
                .update({ status: 'sent', sent_at: sentAt })
                .eq('id', pending.id);
            }

            results.sent++;
            continue;
          }
        }

        // Single message send
        await twilioClient.messages.create({
          body: entry.message,
          from: TWILIO_FROM,
          to: formatPhone(client.phone_number),
        });

        await supabase
          .from('sms_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', entry.id);

        results.sent++;
      } catch (sendError: any) {
        console.error(`Failed to send SMS for queue entry ${entry.id}:`, sendError);
        await supabase
          .from('sms_queue')
          .update({ status: 'failed' })
          .eq('id', entry.id);
        results.failed++;
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('SMS queue cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}