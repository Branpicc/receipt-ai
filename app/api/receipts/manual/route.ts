// app/api/receipts/manual/route.ts
//
// Manual receipt entry — for purchases the user didn't get a real
// receipt for, but wants to record from their bank statement. Takes
// vendor / date / amount / category (optional) and an optional
// bank-statement screenshot. The screenshot is uploaded to the same
// receipt-files bucket the regular upload uses, so it's reachable from
// the same receipt-detail page.
//
// Sets source='manual' + extraction_status='manual' so the rest of
// the app can distinguish these from OCR-extracted receipts.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFirmMember } from "@/lib/apiAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const firmId = String(form.get("firmId") || "");
    const clientId = String(form.get("clientId") || "");
    const vendor = String(form.get("vendor") || "").trim();
    const receiptDate = String(form.get("receiptDate") || "").trim();
    const subtotalDollars = parseFloat(String(form.get("subtotalDollars") || "0"));
    const taxDollars = parseFloat(String(form.get("taxDollars") || "0"));
    const totalDollars = parseFloat(String(form.get("totalDollars") || "0"));
    const category = String(form.get("category") || "").trim() || null;
    const note = String(form.get("note") || "").trim() || null;
    const file = form.get("file") as File | null;

    if (!firmId || !clientId) {
      return NextResponse.json({ error: "Missing firmId or clientId." }, { status: 400 });
    }
    const auth = await requireFirmMember(request, firmId);
    if (auth instanceof NextResponse) return auth;

    if (!vendor) return NextResponse.json({ error: "Vendor is required." }, { status: 400 });
    if (!receiptDate) return NextResponse.json({ error: "Date is required." }, { status: 400 });
    if (!totalDollars || !Number.isFinite(totalDollars) || totalDollars <= 0) {
      return NextResponse.json({ error: "Total must be a positive number." }, { status: 400 });
    }
    // Subtotal + tax are accepted as separate fields so the user can
    // mirror what's on their bank statement. We validate that subtotal +
    // tax matches the total within a 1-cent tolerance (rounding); the
    // total field is the source of truth on the receipts row, and the
    // tax portion is stored in receipt_taxes so the deductible-math
    // helpers see it the same way they would for an OCR'd receipt.
    const subtotalCents = Number.isFinite(subtotalDollars) && subtotalDollars > 0
      ? Math.round(subtotalDollars * 100) : 0;
    const taxCents = Number.isFinite(taxDollars) && taxDollars > 0
      ? Math.round(taxDollars * 100) : 0;
    const totalCents = Math.round(totalDollars * 100);
    if (subtotalCents > 0 && Math.abs(subtotalCents + taxCents - totalCents) > 1) {
      return NextResponse.json(
        { error: `Subtotal ($${(subtotalCents/100).toFixed(2)}) + tax ($${(taxCents/100).toFixed(2)}) should equal total ($${(totalCents/100).toFixed(2)}). Re-check the numbers.` },
        { status: 400 }
      );
    }

    // Resolve who is uploading. requireFirmMember already validated the
    // bearer token, but we need the firm_users.id for uploaded_by.
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.replace(/^Bearer /i, "");
    let firmUserId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      if (user) {
        const { data: fu } = await supabase
          .from("firm_users")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("firm_id", firmId)
          .single();
        firmUserId = fu?.id || null;
      }
    } catch { /* uploaded_by is nullable */ }

    // 1) Insert the receipt row. source='manual' so the rest of the
    //    app can show a "manually entered" badge and skip
    //    OCR-extraction retries.
    const { data: receiptData, error: insertErr } = await supabase
      .from("receipts")
      .insert([{
        firm_id: firmId,
        client_id: clientId,
        uploaded_by: firmUserId,
        source: "manual",
        status: "needs_review",
        currency: "CAD",
        extraction_status: "manual",
        vendor,
        receipt_date: receiptDate,
        total_cents: totalCents,
        approved_category: category,
        suggested_category: category,
        purpose_text: note,
      }])
      .select("id")
      .single();
    if (insertErr || !receiptData) {
      console.error("[manual receipt] insert failed:", insertErr);
      return NextResponse.json({ error: insertErr?.message || "Could not save receipt." }, { status: 500 });
    }
    const receiptId = receiptData.id;

    // Tax row — same shape the OCR pipeline writes for the deductible
    // helpers to see. We label it 'HST' since most of Canada's a
    // single combined rate; user can re-categorize from the receipt
    // detail page later if they need a separate GST + PST split.
    if (taxCents > 0) {
      const rate = subtotalCents > 0 ? Number((taxCents / subtotalCents).toFixed(4)) : 0;
      const { error: taxErr } = await supabase
        .from("receipt_taxes")
        .insert([{
          receipt_id: receiptId,
          firm_id: firmId,
          tax_type: "HST",
          rate,
          amount_cents: taxCents,
        }]);
      if (taxErr) {
        // Non-blocking — the receipt row is saved; only the tax detail
        // is missing. Log for diagnostics.
        console.warn("[manual receipt] tax row insert failed:", taxErr);
      }
    }

    // 2) Optional bank-statement image upload. Same storage path as
    //    the regular upload route so the existing detail page can
    //    surface it via image_url without any new code.
    if (file && file.size > 0) {
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const storagePath = `${firmId}/${clientId}/${receiptId}/${Date.now()}_${safeName}`;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { error: uploadErr } = await supabase.storage
          .from("receipt-files")
          .upload(storagePath, buffer, { contentType: file.type, upsert: false });
        if (uploadErr) {
          console.warn("[manual receipt] image upload failed (non-blocking):", uploadErr);
        } else {
          const { data: publicUrl } = supabase.storage.from("receipt-files").getPublicUrl(storagePath);
          if (publicUrl?.publicUrl) {
            await supabase.from("receipts").update({ image_url: publicUrl.publicUrl }).eq("id", receiptId);
          }
        }
      } catch (e) {
        console.warn("[manual receipt] image upload exception:", e);
      }
    }

    return NextResponse.json({ success: true, receiptId });
  } catch (err: any) {
    console.error("[manual receipt] unexpected:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
