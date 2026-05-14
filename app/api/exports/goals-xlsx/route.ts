// app/api/exports/goals-xlsx/route.ts
//
// Server-side .xlsx export for the personal Goals contribution report.
// Three sheets:
//   • Summary       — header block (date range, totals, goal count)
//   • By Goal       — per-goal totals + remaining-to-target
//   • Contributions — every contribution row in the window
//
// Authenticated + firm-scoped. exceljs is dynamically imported to keep
// it off the client bundle.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFirmMember } from "@/lib/apiAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEADER_FILL = "FF2563EB";
const TOTAL_FILL = "FFF3F4F6";

export async function POST(request: NextRequest) {
  let body: {
    firmId?: string;
    clientId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    periodLabel?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmId, clientId, startDate, endDate, periodLabel } = body;
  if (!firmId || !clientId) {
    return NextResponse.json({ error: "Missing firmId or clientId" }, { status: 400 });
  }

  const auth = await requireFirmMember(request, firmId);
  if (auth instanceof NextResponse) return auth;

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  const clientName = client?.name || "Personal";

  // Load goals + contributions in the window.
  const { data: goals } = await supabase
    .from("personal_goals")
    .select("id, name, icon, emoji, category, is_important, target_cents, target_date, reset_frequency, archived_at, created_at")
    .eq("client_id", clientId);

  const goalsById = new Map((goals || []).map((g: any) => [g.id, g]));

  let q = supabase
    .from("goal_contributions")
    .select("id, goal_id, amount_cents, note, source, contributed_at")
    .in("goal_id", (goals || []).map((g: any) => g.id))
    .order("contributed_at", { ascending: false });
  if (startDate) q = q.gte("contributed_at", startDate);
  if (endDate) q = q.lte("contributed_at", endDate);
  const { data: contribs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (contribs || []).map((c: any) => ({
    ...c,
    goal: goalsById.get(c.goal_id),
  })).filter(r => r.goal);

  const totalCents = rows.reduce((s, r) => s + r.amount_cents, 0);

  // Per-goal aggregation.
  const perGoal = new Map<string, { goal: any; cents: number; count: number }>();
  rows.forEach(r => {
    const e = perGoal.get(r.goal.id) || { goal: r.goal, cents: 0, count: 0 };
    e.cents += r.amount_cents;
    e.count += 1;
    perGoal.set(r.goal.id, e);
  });

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Receipture";
  wb.created = new Date();

  const money = '"$"#,##0.00';

  // ── Summary sheet ─────────────────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  summary.mergeCells("A1:E1");
  const title = summary.getCell("A1");
  title.value = "Goal Contributions Report";
  title.font = { size: 18, bold: true };
  summary.getRow(1).height = 26;
  const meta: [string, string][] = [
    ["Account", clientName],
    ["Period", periodLabel || "Custom"],
    ["From", startDate ? new Date(startDate).toLocaleDateString("en-CA") : "Beginning"],
    ["To", endDate ? new Date(endDate).toLocaleDateString("en-CA") : "Today"],
    ["Generated", new Date().toLocaleString()],
    ["Total contributed", `$${(totalCents / 100).toFixed(2)}`],
    ["Contributions", String(rows.length)],
    ["Goals with activity", String(perGoal.size)],
  ];
  let r = 2;
  for (const [k, v] of meta) {
    summary.getCell(`A${r}`).value = k;
    summary.getCell(`A${r}`).font = { bold: true };
    summary.mergeCells(`B${r}:E${r}`);
    summary.getCell(`B${r}`).value = v;
    r += 1;
  }
  summary.columns.forEach((col: any, i: number) => {
    col.width = [22, 28, 18, 18, 18][i] || 16;
  });

  // ── By Goal sheet ─────────────────────────────────────────────────
  const byGoal = wb.addWorksheet("By Goal");
  const headers = ["Goal", "Category", "Important", "Target ($)", "Contributed in window ($)", "Contributions"];
  const head = byGoal.getRow(1);
  headers.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });
  byGoal.views = [{ state: "frozen", ySplit: 1 }];
  let row = 2;
  const sorted = Array.from(perGoal.values()).sort((a, b) => b.cents - a.cents);
  for (const g of sorted) {
    const r = byGoal.getRow(row);
    r.getCell(1).value = g.goal.name;
    r.getCell(2).value = g.goal.category;
    r.getCell(3).value = g.goal.is_important ? "Yes" : "";
    r.getCell(4).value = g.goal.target_cents ? g.goal.target_cents / 100 : 0;
    r.getCell(4).numFmt = money;
    r.getCell(5).value = g.cents / 100;
    r.getCell(5).numFmt = money;
    r.getCell(6).value = g.count;
    row += 1;
  }
  const totalsRow = byGoal.getRow(row);
  totalsRow.getCell(1).value = "TOTAL";
  totalsRow.getCell(5).value = totalCents / 100;
  totalsRow.getCell(5).numFmt = money;
  totalsRow.getCell(6).value = rows.length;
  totalsRow.eachCell((c: any) => {
    c.font = { ...(c.font || {}), bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  });
  byGoal.columns.forEach((col: any, i: number) => {
    col.width = [30, 16, 12, 16, 22, 16][i] || 14;
  });

  // ── Contributions sheet ───────────────────────────────────────────
  const sheet = wb.addWorksheet("Contributions");
  const cHeaders = ["Date", "Goal", "Category", "Amount ($)", "Source", "Note"];
  const cHead = sheet.getRow(1);
  cHeaders.forEach((h, i) => {
    const cell = cHead.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  let cRow = 2;
  for (const c of rows) {
    const r = sheet.getRow(cRow);
    r.getCell(1).value = new Date(c.contributed_at).toLocaleDateString("en-CA");
    r.getCell(2).value = c.goal.name;
    r.getCell(3).value = c.goal.category;
    r.getCell(4).value = c.amount_cents / 100;
    r.getCell(4).numFmt = money;
    r.getCell(5).value = c.source;
    r.getCell(6).value = c.note || "";
    cRow += 1;
  }
  const cTotal = sheet.getRow(cRow);
  cTotal.getCell(1).value = "TOTAL";
  cTotal.getCell(4).value = totalCents / 100;
  cTotal.getCell(4).numFmt = money;
  cTotal.eachCell((c: any) => {
    c.font = { ...(c.font || {}), bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  });
  sheet.columns.forEach((col: any, i: number) => {
    col.width = [14, 30, 16, 14, 16, 32][i] || 14;
  });

  const buf = await wb.xlsx.writeBuffer();
  const fname = `Goals-${periodLabel || "report"}-${new Date().toISOString().split("T")[0]}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
