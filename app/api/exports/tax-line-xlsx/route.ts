// app/api/exports/tax-line-xlsx/route.ts
//
// Per-CRA-line Excel export. Called from the "📥 Excel" button on each
// summary card of /dashboard/tax-codes. Produces a real .xlsx file with
// a styled header block (client + date range + totals) and a per-receipt
// table with tax-prep columns the accountant cares about.
//
// Server-side because we use the exceljs library — keeps it off the
// client bundle. Authenticated and firm-scoped.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFirmMember } from "@/lib/apiAuth";
import { computeReceiptDeductible, type DeductibleLineItem } from "@/lib/computeReceiptDeductible";
import { getTaxCodeForCategory, getFormLabel, type TaxForm } from "@/lib/taxCodes";
import { getProvinceTax } from "@/lib/taxRates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  let body: {
    firmId?: string;
    clientId?: string | null;
    form?: TaxForm;
    code?: string;
    startDate?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmId, clientId, form, code, startDate } = body;
  if (!firmId || !form || !code) {
    return NextResponse.json({ error: "Missing firmId, form or code" }, { status: 400 });
  }

  const auth = await requireFirmMember(request, firmId);
  if (auth instanceof NextResponse) return auth;

  // Load the client's tax profile so we can compute the same deductible
  // numbers the in-page report shows. Also pull a human name for the
  // header block.
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

  // Resolve the tax code for the requested form + code so we know which
  // categories map to it (and the deductible_percent for the math).
  const allCodes = await import("@/lib/taxCodes").then(m => m.CRA_TAX_CODES);
  const taxCode = allCodes.find(c => c.form === form && c.code === code);
  if (!taxCode) {
    return NextResponse.json({ error: "Unknown tax code" }, { status: 404 });
  }

  let q = supabase
    .from("receipts")
    .select("id, vendor, receipt_date, total_cents, approved_category, suggested_category, expense_type, business_percentage, is_capital_asset, payment_method, card_brand, card_last_four, purpose_text")
    .eq("firm_id", firmId)
    .not("approved_category", "is", null);
  if (clientId) q = q.eq("client_id", clientId);
  if (startDate) q = q.gte("receipt_date", startDate);
  const { data: receipts, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter receipts to those that map to this tax code, excluding
  // personal + capital assets (handled elsewhere).
  const matching = (receipts || []).filter(r => {
    if (r.expense_type === "personal" || r.is_capital_asset) return false;
    const cat = r.approved_category || r.suggested_category;
    if (!cat) return false;
    const tc = getTaxCodeForCategory(cat, form);
    return tc?.code === code;
  });

  // Load line items for the matching receipts so the business-percentage
  // math uses the per-line splits when present.
  const ids = matching.map(r => r.id);
  const itemMap = new Map<string, DeductibleLineItem[]>();
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("receipt_items")
      .select("receipt_id, total_cents, expense_type")
      .in("receipt_id", ids);
    (items || []).forEach((li: any) => {
      const arr = itemMap.get(li.receipt_id) || [];
      arr.push({ total_cents: li.total_cents, expense_type: li.expense_type });
      itemMap.set(li.receipt_id, arr);
    });
  }

  // Load active flags so we can mark flagged rows red.
  let flaggedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: flags } = await supabase
      .from("receipt_flags")
      .select("receipt_id")
      .in("receipt_id", ids)
      .is("resolved_at", null);
    flaggedSet = new Set((flags || []).map((f: any) => f.receipt_id));
  }

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Receipture";
  wb.created = new Date();

  const sheet = wb.addWorksheet(taxCode.name.slice(0, 31));

  // ── Header block ─────────────────────────────────────────────────────
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `${taxCode.line} — ${taxCode.name}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 24;

  const meta: [string, string][] = [
    ["Client", clientName],
    ["Form", getFormLabel(form)],
    ["Province", `${profile.province} (${getProvinceTax(profile.province).label})`],
    ["GST/HST registered", profile.gst_hst_registered ? "Yes (ITCs claimed)" : "No"],
    ["Date range", startDate ? `From ${startDate.split("T")[0]}` : "All time"],
    ["Generated", new Date().toLocaleString()],
  ];
  let row = 2;
  for (const [k, v] of meta) {
    sheet.getCell(`A${row}`).value = k;
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.mergeCells(`B${row}:K${row}`);
    sheet.getCell(`B${row}`).value = v;
    row += 1;
  }

  row += 1; // blank spacer
  const headerRowIdx = row;
  const headers = [
    "Date",
    "Vendor",
    "Category",
    "Total ($)",
    "Business %",
    "Pre-tax business ($)",
    "Recoverable tax ($)",
    "Deductible ($)",
    "Payment",
    "Card",
    "Purpose",
  ];
  const headerRow = sheet.getRow(headerRowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "left" };
  });
  headerRow.height = 18;
  sheet.views = [{ state: "frozen", ySplit: headerRowIdx }];

  // ── Receipt rows ─────────────────────────────────────────────────────
  let totalCents = 0;
  let totalTax = 0;
  let totalDeductible = 0;
  let dataRowIdx = headerRowIdx + 1;
  for (const r of matching) {
    const result = computeReceiptDeductible(r, itemMap.get(r.id) || [], profile, taxCode);
    if (result.business_cents <= 0) continue;
    totalCents += result.business_cents;
    totalTax += result.recoverable_tax_cents;
    totalDeductible += result.deductible_cents;

    const cardLabel = r.card_brand && r.card_last_four
      ? `${r.card_brand} ****${r.card_last_four}`
      : "";

    const rowVals = [
      r.receipt_date || "",
      r.vendor || "",
      r.approved_category || r.suggested_category || "",
      r.total_cents ? r.total_cents / 100 : 0,
      result.effective_business_pct,
      result.business_cents / 100,
      result.recoverable_tax_cents / 100,
      result.deductible_cents / 100,
      r.payment_method || "",
      cardLabel,
      r.purpose_text || "",
    ];
    const dataRow = sheet.getRow(dataRowIdx);
    rowVals.forEach((v, i) => {
      const cell = dataRow.getCell(i + 1);
      cell.value = v as any;
      if (typeof v === "number" && i >= 3 && i !== 4) {
        cell.numFmt = '"$"#,##0.00';
      }
      if (i === 4) cell.numFmt = '0"%"';
    });
    if (flaggedSet.has(r.id)) {
      dataRow.eachCell(c => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      });
    }
    dataRowIdx += 1;
  }

  // ── Totals row ───────────────────────────────────────────────────────
  if (dataRowIdx > headerRowIdx + 1) {
    const totalsRow = sheet.getRow(dataRowIdx);
    totalsRow.getCell(1).value = "TOTAL";
    totalsRow.getCell(1).font = { bold: true };
    totalsRow.getCell(4).value = totalCents / 100;
    totalsRow.getCell(4).numFmt = '"$"#,##0.00';
    totalsRow.getCell(7).value = totalTax / 100;
    totalsRow.getCell(7).numFmt = '"$"#,##0.00';
    totalsRow.getCell(8).value = totalDeductible / 100;
    totalsRow.getCell(8).numFmt = '"$"#,##0.00';
    totalsRow.eachCell(c => { c.font = { ...(c.font || {}), bold: true }; });
  }

  // Column widths — chosen by hand to fit typical content.
  sheet.columns.forEach((col, i) => {
    const widths = [12, 32, 24, 12, 10, 16, 16, 14, 14, 18, 40];
    col.width = widths[i] || 14;
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Line${taxCode.line.replace("Line ", "")}-${taxCode.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
