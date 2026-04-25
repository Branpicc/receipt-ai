// app/api/generate-monthly-report/route.ts
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

// Use month string directly to avoid timezone issues
    let reportMonth: string;
    if (month) {
      reportMonth = month.substring(0, 7) + '-01';
    } else {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      reportMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
    console.log('📅 Generating report for month:', reportMonth, 'from input:', month);
const [yearNum, monthNum] = reportMonth.split('-').map(Number);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
        
    // Load all receipts for this client in this month
const { data: receipts, error: receiptsError } = await supabase
  .from('receipts')
  .select('id, total_cents, approved_category, suggested_category, created_at, receipt_date')
  .eq('firm_id', firmId)
  .eq('client_id', clientId)
  .gte('receipt_date', reportMonth)
  .lte('receipt_date', endDate.toISOString().split('T')[0]);
  
console.log('📋 Receipts query - month:', reportMonth, 'end:', endDate.toISOString().split('T')[0], 'found:', receipts?.length, 'error:', receiptsError?.message);
    if (receiptsError) throw receiptsError;

    // Load taxes for these receipts
    const receiptIds = receipts?.map(r => r.id) || [];
    let totalTaxCents = 0;
    if (receiptIds.length > 0) {
      const { data: taxes } = await supabase
        .from('receipt_taxes')
        .select('amount_cents')
        .in('receipt_id', receiptIds);
      totalTaxCents = taxes?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0;
    }

    // Load flagged receipts
    let flaggedCount = 0;
    if (receiptIds.length > 0) {
      const { data: flags } = await supabase
        .from('receipt_flags')
        .select('receipt_id')
        .in('receipt_id', receiptIds)
        .is('resolved_at', null);
      flaggedCount = new Set(flags?.map(f => f.receipt_id) || []).size;
    }

    // Load email receipts for this client in this month
    const { data: clientRecord } = await supabase
      .from('clients')
      .select('email_alias, client_code')
      .eq('id', clientId)
      .single();

    let emailCount = 0;
    if (clientRecord) {
      const { count } = await supabase
        .from('email_receipts')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      emailCount = count || 0;
    }

    // Load budgets for comparison
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

    // Build budget comparison
    const budgetComparison = (budgets || []).map(budget => {
      const spent = categoryMap.get(budget.category)?.total_cents || 0;
      return {
        category: budget.category,
        budget_cents: budget.monthly_budget_cents,
        spent_cents: spent,
        percentage: budget.monthly_budget_cents > 0
          ? Math.round((spent / budget.monthly_budget_cents) * 100)
          : 0,
        is_over_budget: spent > budget.monthly_budget_cents,
      };
    });

    const totalSpendCents = receipts?.reduce((sum, r) => sum + (r.total_cents || 0), 0) || 0;

    // Upsert report
    const { data: report, error: upsertError } = await supabase
      .from('client_reports')
      .upsert({
        firm_id: firmId,
        client_id: clientId,
        report_month: reportMonth,
        total_spend_cents: totalSpendCents,
        total_tax_cents: totalTaxCents,
        total_receipts: receipts?.length || 0,
        total_emails: emailCount,
        total_flagged: flaggedCount,
        category_breakdown: categoryBreakdown,
        budget_comparison: budgetComparison,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id,report_month',
      })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}