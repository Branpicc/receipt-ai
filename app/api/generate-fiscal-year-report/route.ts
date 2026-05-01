/**
 * POST /api/generate-fiscal-year-report
 *
 * Generates (or upserts) a fiscal-year report for a single client. The
 * client's fiscal year ends in `clients.fiscal_year_end_month` (default
 * 12 = December = Jan-Dec calendar year).
 *
 * Request body: { clientId, firmId, fiscalYearEnding }
 *   fiscalYearEnding: "YYYY-MM-01" — the year + month at which the
 *   fiscal year *ends*. The aggregate covers the 12 months ending at
 *   the LAST day of that month.
 *
 * Stored on client_reports with report_type='fiscal_year'. report_month
 * is set to the start of the fiscal year (year-end minus 11 months) so
 * sorting in the UI lines up with how users think about it.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireFirmMember } from "@/lib/apiAuth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, firmId, fiscalYearEnding } = body;

    if (!clientId || !firmId || !fiscalYearEnding) {
      return NextResponse.json(
        { error: "clientId, firmId, fiscalYearEnding required" },
        { status: 400 }
      );
    }

    // Authenticate caller and require firm membership. firm_admin / owner /
    // accountant can all generate.
    const auth = await requireFirmMember(request, firmId, {
      roles: ["firm_admin", "owner", "accountant"],
    });
    if (auth instanceof NextResponse) return auth;

    // Compute the 12-month window. fiscalYearEnding is the START date of
    // the year-end month (YYYY-MM-01). End of window = last day of that
    // month. Start of window = first day of (year-end month - 11 months).
    const [yearStr, monthStr] = (fiscalYearEnding as string).split("-");
    const endYear = Number(yearStr);
    const endMonth0 = Number(monthStr) - 1; // 0-indexed month
    if (Number.isNaN(endYear) || Number.isNaN(endMonth0)) {
      return NextResponse.json({ error: "Invalid fiscalYearEnding" }, { status: 400 });
    }

    const startDate = new Date(endYear, endMonth0 - 11, 1);
    const endDate = new Date(endYear, endMonth0 + 1, 0, 23, 59, 59, 999);
    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);
    // For the unique key we anchor report_month at the START of the
    // fiscal year so sorting still groups years sensibly.
    const reportMonth = startDate.toISOString().slice(0, 10);

    // Demo-data export rule applies here too (Sprint 5b §5): once any
    // real receipt exists in the firm, demo receipts are filtered out.
    const { count: realCount } = await supabaseAdmin
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("is_demo", false);
    const excludeDemo = (realCount || 0) > 0;

    // Pull all receipts in the window for this client.
    let receiptsQuery = supabaseAdmin
      .from("receipts")
      .select("id, total_cents, approved_category, suggested_category, receipt_date")
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .gte("receipt_date", startIso)
      .lte("receipt_date", endIso);
    if (excludeDemo) receiptsQuery = receiptsQuery.eq("is_demo", false);
    const { data: receipts, error: rErr } = await receiptsQuery;
    if (rErr) throw rErr;

    const receiptIds = (receipts || []).map(r => r.id);
    let totalTaxCents = 0;
    if (receiptIds.length > 0) {
      const { data: taxes } = await supabaseAdmin
        .from("receipt_taxes")
        .select("amount_cents")
        .in("receipt_id", receiptIds);
      totalTaxCents = (taxes || []).reduce((s, t) => s + (t.amount_cents || 0), 0);
    }

    // Flagged count for the window.
    const { count: flaggedCount } = await supabaseAdmin
      .from("receipt_flags")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .in("receipt_id", receiptIds.length > 0 ? receiptIds : ["00000000-0000-0000-0000-000000000000"]);

    // Email count for the window.
    const { count: emailCount } = await supabaseAdmin
      .from("email_receipts")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .gte("received_at", startDate.toISOString())
      .lte("received_at", endDate.toISOString());

    // Category breakdown.
    const catMap = new Map<string, { spent_cents: number; count: number }>();
    for (const r of receipts || []) {
      const cat = r.approved_category || r.suggested_category || "Uncategorized";
      const existing = catMap.get(cat) || { spent_cents: 0, count: 0 };
      existing.spent_cents += r.total_cents || 0;
      existing.count += 1;
      catMap.set(cat, existing);
    }
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.spent_cents - a.spent_cents);

    const totalSpendCents = (receipts || []).reduce((s, r) => s + (r.total_cents || 0), 0);

    const { data: report, error: upsertError } = await supabaseAdmin
      .from("client_reports")
      .upsert(
        {
          firm_id: firmId,
          client_id: clientId,
          report_month: reportMonth,
          report_type: "fiscal_year",
          total_spend_cents: totalSpendCents,
          total_tax_cents: totalTaxCents,
          total_receipts: receipts?.length || 0,
          total_emails: emailCount || 0,
          total_flagged: flaggedCount || 0,
          category_breakdown: categoryBreakdown,
          budget_comparison: [],
          generated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,report_month,report_type" }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, report });
  } catch (err) {
    const msg = (err as { message?: string })?.message || "Internal server error";
    console.error("[generate-fiscal-year-report] failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
