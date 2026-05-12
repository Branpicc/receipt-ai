// app/api/exports/master-xlsx/route.ts
//
// Master Excel export. Produces a real .xlsx workbook with multiple
// sheets so the accountant can hand a single file to the tax preparer:
//
//   • Summary           — header block + grand totals + per-form totals
//   • All Receipts      — every receipt with tax-prep columns
//   • One sheet per CRA line (only lines with data)
//   • Personal          — receipts marked personal (excluded from CRA)
//   • Capital Assets    — items the client must depreciate via CCA
//
// Authenticated and firm-scoped. exceljs is dynamically imported so it
// stays out of the client bundle.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFirmMember } from "@/lib/apiAuth";
import { computeReceiptDeductible, type DeductibleLineItem } from "@/lib/computeReceiptDeductible";
import { CRA_TAX_CODES, getTaxCodeForCategory, getFormLabel } from "@/lib/taxCodes";
import { getProvinceTax } from "@/lib/taxRates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEADER_FILL = "FF2563EB";
const FLAG_FILL = "FFFEE2E2";
const TOTAL_FILL = "FFF3F4F6";

export async function POST(request: NextRequest) {
  let body: {
    firmId?: string;
    clientId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmId, clientId, dateFrom, dateTo } = body;
  if (!firmId) {
    return NextResponse.json({ error: "Missing firmId" }, { status: 400 });
  }

  const auth = await requireFirmMember(request, firmId);
  if (auth instanceof NextResponse) return auth;

  // Resolve client profile + human name. When clientId is null we still
  // produce the workbook but with default tax assumptions — the
  // accountant has chosen a multi-client view on purpose.
  let clientName = "(All clients)";
  let profile = { province: "ON", gst_hst_registered: false };
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("name, province, gst_hst_registered")
      .eq("id", clientId)
      .single();
    if (client) {
      clientName = client.name;
      profile = {
        province: client.province || "ON",
        gst_hst_registered: !!client.gst_hst_registered,
      };
    }
  }

  let q = supabase
    .from("receipts")
    .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, expense_type, business_percentage, is_capital_asset, payment_method, card_brand, card_last_four, purpose_text, status, client_id")
    .eq("firm_id", firmId)
    .order("receipt_date", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  if (dateFrom) q = q.gte("receipt_date", dateFrom);
  if (dateTo) q = q.lte("receipt_date", dateTo);
  const { data: receipts, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = receipts || [];

  // Map client_id → name (used when "all clients" is selected so the
  // All Receipts sheet still labels each row).
  const clientIds = Array.from(new Set(all.map(r => r.client_id).filter(Boolean)));
  const clientNameMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: cs } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds as string[]);
    (cs || []).forEach((c: any) => clientNameMap.set(c.id, c.name));
  }

  // Bulk-load line items and active flags so the per-receipt math and
  // red-row highlights match the in-app reports.
  const ids = all.map(r => r.id);
  const itemMap = new Map<string, DeductibleLineItem[]>();
  let flaggedSet = new Set<string>();
  if (ids.length > 0) {
    const [{ data: items }, { data: flags }] = await Promise.all([
      supabase.from("receipt_items")
        .select("receipt_id, total_cents, expense_type")
        .in("receipt_id", ids),
      supabase.from("receipt_flags")
        .select("receipt_id")
        .in("receipt_id", ids)
        .is("resolved_at", null),
    ]);
    (items || []).forEach((li: any) => {
      const arr = itemMap.get(li.receipt_id) || [];
      arr.push({ total_cents: li.total_cents, expense_type: li.expense_type });
      itemMap.set(li.receipt_id, arr);
    });
    flaggedSet = new Set((flags || []).map((f: any) => f.receipt_id));
  }

  // Bucket receipts: personal, capital, and per CRA line for business.
  const personal: typeof all = [];
  const capital: typeof all = [];
  type LineBucket = {
    code: string;
    line: string;
    form: string;
    name: string;
    rows: Array<{
      receipt: typeof all[number];
      business_cents: number;
      tax_cents: number;
      deductible_cents: number;
      pct: number;
    }>;
    total_cents: number;
    tax_cents: number;
    deductible_cents: number;
  };
  const lineBuckets = new Map<string, LineBucket>();

  for (const r of all) {
    if (r.expense_type === "personal") { personal.push(r); continue; }
    if (r.is_capital_asset) { capital.push(r); continue; }
    const cat = r.approved_category || r.suggested_category;
    // Try T2125 first (most common), then fall back to any form match.
    const tc = (cat && (getTaxCodeForCategory(cat, "T2125") || getTaxCodeForCategory(cat))) || null;
    if (!tc) continue;
    const result = computeReceiptDeductible(r, itemMap.get(r.id) || [], profile, tc);
    if (result.business_cents <= 0) continue;
    const key = `${tc.form}::${tc.code}`;
    let bucket = lineBuckets.get(key);
    if (!bucket) {
      bucket = {
        code: tc.code, line: tc.line, form: tc.form, name: tc.name,
        rows: [],
        total_cents: 0, tax_cents: 0, deductible_cents: 0,
      };
      lineBuckets.set(key, bucket);
    }
    bucket.rows.push({
      receipt: r,
      business_cents: result.business_cents,
      tax_cents: result.recoverable_tax_cents,
      deductible_cents: result.deductible_cents,
      pct: result.effective_business_pct,
    });
    bucket.total_cents += result.business_cents;
    bucket.tax_cents += result.recoverable_tax_cents;
    bucket.deductible_cents += result.deductible_cents;
  }

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Receipture";
  wb.created = new Date();

  // ── Helpers ─────────────────────────────────────────────────────────
  const writeHeader = (sheet: any, headers: string[]) => {
    const headerRow = sheet.getRow(sheet.lastRow ? sheet.lastRow.number + 1 : 1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });
    headerRow.height = 18;
    sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
    return headerRow.number;
  };

  const money = '"$"#,##0.00';
  const pct = '0"%"';

  // ── Sheet: Summary ──────────────────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  summary.mergeCells("A1:F1");
  const t = summary.getCell("A1");
  t.value = "Master Tax Report";
  t.font = { size: 18, bold: true };
  summary.getRow(1).height = 26;
  const meta: [string, string][] = [
    ["Client", clientName],
    ["Province", `${profile.province} (${getProvinceTax(profile.province).label})`],
    ["GST/HST registered", profile.gst_hst_registered ? "Yes (ITCs claimed)" : "No"],
    ["Date range", `${dateFrom || "Beginning"} → ${dateTo || "Today"}`],
    ["Generated", new Date().toLocaleString()],
    ["Receipts in range", String(all.length)],
  ];
  let r = 2;
  for (const [k, v] of meta) {
    summary.getCell(`A${r}`).value = k;
    summary.getCell(`A${r}`).font = { bold: true };
    summary.mergeCells(`B${r}:F${r}`);
    summary.getCell(`B${r}`).value = v;
    r += 1;
  }
  r += 1;

  // Per-form totals
  const formTotals = new Map<string, { business: number; tax: number; deductible: number; lines: number }>();
  for (const b of lineBuckets.values()) {
    const f = formTotals.get(b.form) || { business: 0, tax: 0, deductible: 0, lines: 0 };
    f.business += b.total_cents;
    f.tax += b.tax_cents;
    f.deductible += b.deductible_cents;
    f.lines += 1;
    formTotals.set(b.form, f);
  }

  const sumHeader = summary.getRow(r);
  ["Form", "CRA lines used", "Business spend", "Recoverable tax", "Deductible"].forEach((h, i) => {
    const c = sumHeader.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });
  r += 1;
  let grandBusiness = 0, grandTax = 0, grandDeductible = 0;
  for (const [form, totals] of formTotals.entries()) {
    const row = summary.getRow(r);
    row.getCell(1).value = `${form} — ${getFormLabel(form as any)}`;
    row.getCell(2).value = totals.lines;
    row.getCell(3).value = totals.business / 100; row.getCell(3).numFmt = money;
    row.getCell(4).value = totals.tax / 100; row.getCell(4).numFmt = money;
    row.getCell(5).value = totals.deductible / 100; row.getCell(5).numFmt = money;
    grandBusiness += totals.business;
    grandTax += totals.tax;
    grandDeductible += totals.deductible;
    r += 1;
  }
  const totalsRow = summary.getRow(r);
  totalsRow.getCell(1).value = "GRAND TOTAL";
  totalsRow.getCell(3).value = grandBusiness / 100; totalsRow.getCell(3).numFmt = money;
  totalsRow.getCell(4).value = grandTax / 100; totalsRow.getCell(4).numFmt = money;
  totalsRow.getCell(5).value = grandDeductible / 100; totalsRow.getCell(5).numFmt = money;
  totalsRow.eachCell((c: any) => {
    c.font = { ...(c.font || {}), bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  });
  summary.columns.forEach((col: any, i: number) => {
    col.width = [40, 16, 18, 18, 18, 18][i] || 16;
  });

  // ── Sheet: All Receipts ─────────────────────────────────────────────
  const allSheet = wb.addWorksheet("All Receipts");
  const allHeaders = [
    "Date", "Vendor", "Client", "Category", "Total ($)", "Type",
    "Business %", "Deductible ($)", "Payment", "Card", "Purpose", "Status",
  ];
  const allHeaderRowIdx = writeHeader(allSheet, allHeaders);
  let allRowIdx = allHeaderRowIdx + 1;
  for (const rec of all) {
    const lineItems = itemMap.get(rec.id) || [];
    const cat = rec.approved_category || rec.suggested_category;
    const tc = cat ? (getTaxCodeForCategory(cat, "T2125") || getTaxCodeForCategory(cat)) : null;
    const result = computeReceiptDeductible(rec, lineItems, profile, tc);
    const cardLabel = rec.card_brand && rec.card_last_four ? `${rec.card_brand} ****${rec.card_last_four}` : "";
    const typeLabel = rec.is_capital_asset ? "Capital asset" : (rec.expense_type === "personal" ? "Personal" : "Business");
    const row = allSheet.getRow(allRowIdx);
    const values: any[] = [
      rec.receipt_date || "",
      rec.vendor || "",
      rec.client_id ? (clientNameMap.get(rec.client_id) || "") : "",
      cat || "",
      rec.total_cents ? rec.total_cents / 100 : 0,
      typeLabel,
      result.effective_business_pct,
      result.deductible_cents / 100,
      rec.payment_method || "",
      cardLabel,
      rec.purpose_text || "",
      rec.status || "",
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      if (i === 4 || i === 7) cell.numFmt = money;
      if (i === 6) cell.numFmt = pct;
    });
    if (flaggedSet.has(rec.id)) {
      row.eachCell((c: any) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FLAG_FILL } }; });
    }
    allRowIdx += 1;
  }
  allSheet.columns.forEach((col: any, i: number) => {
    col.width = [12, 28, 20, 22, 12, 14, 10, 14, 14, 18, 36, 12][i] || 14;
  });

  // ── One sheet per CRA line that has data ────────────────────────────
  // Order: by form (T2125, T776, T2200, T1), then by deductible desc.
  const sortedBuckets = Array.from(lineBuckets.values()).sort((a, b) => {
    if (a.form !== b.form) return a.form.localeCompare(b.form);
    return b.deductible_cents - a.deductible_cents;
  });
  for (const b of sortedBuckets) {
    // Excel sheet names: max 31 chars, no special chars / / : ? * [ ].
    const safeName = `${b.line.replace("Line ", "L")} ${b.name}`
      .replace(/[\\/:?*\[\]]/g, " ")
      .slice(0, 31);
    const sheet = wb.addWorksheet(safeName);
    sheet.mergeCells("A1:H1");
    const title = sheet.getCell("A1");
    title.value = `${b.line} — ${b.name} (${b.form})`;
    title.font = { size: 14, bold: true };
    sheet.getRow(1).height = 22;
    const lineHeaders = [
      "Date", "Vendor", "Client", "Total ($)", "Business %",
      "Pre-tax business ($)", "Recoverable tax ($)", "Deductible ($)",
    ];
    const lineHeaderRow = sheet.getRow(3);
    lineHeaders.forEach((h, i) => {
      const c = lineHeaderRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    let rowIdx = 4;
    for (const item of b.rows) {
      const rec = item.receipt;
      const row = sheet.getRow(rowIdx);
      row.getCell(1).value = rec.receipt_date || "";
      row.getCell(2).value = rec.vendor || "";
      row.getCell(3).value = rec.client_id ? (clientNameMap.get(rec.client_id) || "") : "";
      row.getCell(4).value = rec.total_cents ? rec.total_cents / 100 : 0; row.getCell(4).numFmt = money;
      row.getCell(5).value = item.pct; row.getCell(5).numFmt = pct;
      row.getCell(6).value = item.business_cents / 100; row.getCell(6).numFmt = money;
      row.getCell(7).value = item.tax_cents / 100; row.getCell(7).numFmt = money;
      row.getCell(8).value = item.deductible_cents / 100; row.getCell(8).numFmt = money;
      if (flaggedSet.has(rec.id)) {
        row.eachCell((c: any) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FLAG_FILL } }; });
      }
      rowIdx += 1;
    }
    const tRow = sheet.getRow(rowIdx);
    tRow.getCell(1).value = "TOTAL";
    tRow.getCell(6).value = b.total_cents / 100; tRow.getCell(6).numFmt = money;
    tRow.getCell(7).value = b.tax_cents / 100; tRow.getCell(7).numFmt = money;
    tRow.getCell(8).value = b.deductible_cents / 100; tRow.getCell(8).numFmt = money;
    tRow.eachCell((c: any) => {
      c.font = { ...(c.font || {}), bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    });
    sheet.columns.forEach((col: any, i: number) => {
      col.width = [12, 30, 20, 12, 12, 18, 18, 16][i] || 14;
    });
  }

  // ── Sheet: Personal ─────────────────────────────────────────────────
  if (personal.length > 0) {
    const sheet = wb.addWorksheet("Personal");
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "Personal receipts (excluded from CRA deductible totals)";
    sheet.getCell("A1").font = { size: 14, bold: true };
    sheet.getRow(1).height = 22;
    const headers = ["Date", "Vendor", "Client", "Category", "Total ($)", "Payment"];
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    let i = 4;
    let total = 0;
    for (const rec of personal) {
      total += rec.total_cents || 0;
      const row = sheet.getRow(i);
      row.getCell(1).value = rec.receipt_date || "";
      row.getCell(2).value = rec.vendor || "";
      row.getCell(3).value = rec.client_id ? (clientNameMap.get(rec.client_id) || "") : "";
      row.getCell(4).value = rec.approved_category || rec.suggested_category || "";
      row.getCell(5).value = rec.total_cents ? rec.total_cents / 100 : 0; row.getCell(5).numFmt = money;
      row.getCell(6).value = rec.payment_method || "";
      i += 1;
    }
    const totalRow = sheet.getRow(i);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(5).value = total / 100;
    totalRow.getCell(5).numFmt = money;
    totalRow.eachCell((c: any) => {
      c.font = { ...(c.font || {}), bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    });
    sheet.columns.forEach((col: any, i: number) => {
      col.width = [12, 30, 20, 22, 12, 14][i] || 14;
    });
  }

  // ── Sheet: Capital Assets ───────────────────────────────────────────
  if (capital.length > 0) {
    const sheet = wb.addWorksheet("Capital Assets");
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "Capital assets — depreciate via CCA";
    sheet.getCell("A1").font = { size: 14, bold: true };
    sheet.getRow(1).height = 22;
    const headers = ["Date", "Vendor", "Client", "Category", "Total ($)", "Payment"];
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    let i = 4;
    let total = 0;
    for (const rec of capital) {
      total += rec.total_cents || 0;
      const row = sheet.getRow(i);
      row.getCell(1).value = rec.receipt_date || "";
      row.getCell(2).value = rec.vendor || "";
      row.getCell(3).value = rec.client_id ? (clientNameMap.get(rec.client_id) || "") : "";
      row.getCell(4).value = rec.approved_category || rec.suggested_category || "";
      row.getCell(5).value = rec.total_cents ? rec.total_cents / 100 : 0; row.getCell(5).numFmt = money;
      row.getCell(6).value = rec.payment_method || "";
      i += 1;
    }
    const totalRow = sheet.getRow(i);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(5).value = total / 100;
    totalRow.getCell(5).numFmt = money;
    totalRow.eachCell((c: any) => {
      c.font = { ...(c.font || {}), bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    });
    sheet.columns.forEach((col: any, i: number) => {
      col.width = [12, 30, 20, 22, 12, 14][i] || 14;
    });
  }

  // Touch unused import so the linter doesn't complain (kept for parity
  // with the per-line endpoint and future use).
  void CRA_TAX_CODES;

  const buf = await wb.xlsx.writeBuffer();
  const fname = `Master-Report-${clientName.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
