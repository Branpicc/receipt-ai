// app/api/cron/monthly-reports/route.ts
// Called by Vercel Cron on the last day of each month
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/monthly-reports",
//     "schedule": "0 2 28-31 * *"
//   }]
// }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron or an authorized source
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run on the actual last day of the month
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getDate() === 1;

  if (!isLastDayOfMonth) {
    return NextResponse.json({
      skipped: true,
      message: `Not the last day of month (day ${now.getDate()})`,
    });
  }

  try {
    // Get all active clients across all firms
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, firm_id, name')
      .eq('is_active', true);

    if (error) throw error;

    const results = {
      total: clients?.length || 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Generate report for each client
    for (const client of clients || []) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/generate-monthly-report`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: client.id,
              firmId: client.firm_id,
              // Current month (cron runs on last day, so this month)
              month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
            }),
          }
        );

        if (response.ok) {
          results.succeeded++;
          console.log(`✅ Report generated for client: ${client.name}`);
        } else {
          results.failed++;
          results.errors.push(`${client.name}: HTTP ${response.status}`);
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${client.name}: ${err.message}`);
        console.error(`❌ Failed for client ${client.name}:`, err);
      }
    }

    console.log('Monthly reports summary:', results);
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}