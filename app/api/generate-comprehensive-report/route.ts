import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { clientId, firmId, month } = await request.json();
    if (!clientId || !firmId) {
      return NextResponse.json({ error: 'Missing clientId or firmId' }, { status: 400 });
    }

let reportMonth: string;
    if (month) {
      // Use the month string directly — strip any time component
      reportMonth = month.substring(0, 7) + '-01';
    } else {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      reportMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
    const reportDate = new Date(reportMonth + 'T12:00:00');
        console.log('📅 Generating report for month:', reportMonth, 'from input month:', month);
const [year, monthNum] = reportMonth.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
        console.log('🔍 Querying receipts for client:', clientId, 'firm:', firmId, 'month:', reportMonth, 'to:', endDate.toISOString().split('T')[0]);

    // Get client info
    const { data: client } = await supabase
      .from('clients')
      .select('name, email')
      .eq('id', clientId)
      .single();

// Get receipts
    const { data: receipts, error: receiptsError } = await supabase
          .from('receipts')
.select('id, vendor, total_cents, approved_category, suggested_category, receipt_date, payment_method')
      .eq('firm_id', firmId)
      .eq('client_id', clientId)
      .gte('receipt_date', reportMonth)
      .lte('receipt_date', endDate.toISOString().split('T')[0]);
console.log('📋 Found receipts:', receipts?.length, 'total cents:', receipts?.reduce((s, r) => s + (r.total_cents || 0), 0));
    if (receiptsError) console.error('❌ Receipts query error:', receiptsError);
    console.log('📋 Found receipts:', receipts?.length, 'endDate:', endDate.toISOString().split('T')[0]);
// Get taxes
    const receiptIds = receipts?.map(r => r.id) || [];
    let totalTaxCents = 0;
    if (receiptIds.length > 0) {
      const { data: taxes } = await supabase
        .from('receipt_taxes')
        .select('amount_cents')
        .in('receipt_id', receiptIds);
      totalTaxCents = taxes?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0;
    }

    // Get flags
    let flaggedCount = 0;
    if (receiptIds.length > 0) {
      const { data: flags } = await supabase
        .from('receipt_flags')
        .select('receipt_id')
        .in('receipt_id', receiptIds)
        .is('resolved_at', null);
      flaggedCount = new Set(flags?.map(f => f.receipt_id) || []).size;
    }

    // Get budgets
const { data: budgets } = await supabase
      .from('category_budgets')
      .select('category, monthly_budget_cents')
      .eq('firm_id', firmId);
      
    // Build category breakdown
    const categoryMap = new Map<string, { count: number; total_cents: number }>();
    receipts?.forEach(r => {
      const category = r.approved_category || r.suggested_category || 'Uncategorized';
      const existing = categoryMap.get(category) || { count: 0, total_cents: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        total_cents: existing.total_cents + (r.total_cents || 0),
      });
    });
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total_cents - a.total_cents);

    const totalSpendCents = receipts?.reduce((sum, r) => sum + (r.total_cents || 0), 0) || 0;
    const categorizedCount = receipts?.filter(r => r.approved_category).length || 0;

    // Budget comparison
    const budgetComparison = (budgets || []).map(budget => {
      const spent = categoryMap.get(budget.category)?.total_cents || 0;
      return {
        category: budget.category,
        budget_cents: budget.monthly_budget_cents,
        spent_cents: spent,
        percentage: budget.monthly_budget_cents > 0 ? Math.round((spent / budget.monthly_budget_cents) * 100) : 0,
        is_over_budget: spent > budget.monthly_budget_cents,
      };
    });

// Get firm name
    const { data: firm } = await supabase
      .from('firms')
      .select('name')
      .eq('id', firmId)
      .single();

    // Generate AI summary
    const monthName = new Date(year, monthNum - 1, 1).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' });
    const aiPrompt = `You are a professional accountant writing a monthly expense report summary for a client. Write in clear, professional language. Be concise but informative.

Client: ${client?.name || 'Unknown Client'}
Firm: ${firm?.name || 'Your Accounting Firm'}
Month: ${monthName}
Total Receipts: ${receipts?.length || 0}
Total Spend: $${(totalSpendCents / 100).toFixed(2)} CAD
Total Tax: $${(totalTaxCents / 100).toFixed(2)} CAD
Categorized: ${categorizedCount} of ${receipts?.length || 0} receipts
Flagged Issues: ${flaggedCount}

Category Breakdown:
${categoryBreakdown.map(c => `- ${c.category}: $${(c.total_cents / 100).toFixed(2)} (${c.count} receipts)`).join('\n')}

Budget Status:
${budgetComparison.map(b => `- ${b.category}: spent $${(b.spent_cents / 100).toFixed(2)} of $${(b.budget_cents / 100).toFixed(2)} budget (${b.percentage}%)${b.is_over_budget ? ' ⚠️ OVER BUDGET' : ''}`).join('\n')}

Write a comprehensive report with these sections:
1. Executive Summary (2-3 sentences)
2. Spending Analysis (2-3 sentences about spending patterns)
3. Category Highlights (1-2 sentences about top categories)
4. Budget Status (mention any over-budget categories)
5. Recommendations (2-3 actionable recommendations for the client)

Keep each section brief and professional. Do not use placeholder text like [Client Name] or [Accountant Name] - use the actual values provided above.`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: aiPrompt }],
      }),
    });
    const aiData = await aiResponse.json();
    const aiSummary = aiData.content?.[0]?.text || '';

    // Save to database
    const { data: report, error: upsertError } = await supabase
      .from('client_reports')
      .upsert({
        firm_id: firmId,
        client_id: clientId,
        report_month: reportMonth,
        total_spend_cents: totalSpendCents,
        total_tax_cents: totalTaxCents,
        total_receipts: receipts?.length || 0,
        total_emails: 0,
        total_flagged: flaggedCount,
        category_breakdown: categoryBreakdown,
        budget_comparison: budgetComparison,
        ai_summary: aiSummary,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id,report_month',
      })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('Comprehensive report generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
