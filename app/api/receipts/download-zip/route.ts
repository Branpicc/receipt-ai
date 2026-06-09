// app/api/receipts/download-zip/route.ts
//
// Bulk-download receipt images (and PDFs) as a single ZIP. Accepts
// either an explicit list of receipt IDs or a date range. Files inside
// the ZIP are named YYYY-MM-DD_Vendor_$Total.ext so sorting by filename
// matches chronological order.
//
// Auth: uses requireFirmMember so only users in the firm can pull its
// receipts. Accountants are further scoped to their assigned clients.
// Personal users (firm_admin on a firm-of-one) naturally only see their
// own receipts since all their receipts live under their single client.
//
// Memory: jszip is in-memory. For typical use (≤ a few hundred receipts
// at a couple MB each) this is fine; if power-users hit the wall we'll
// switch to archiver's streaming mode. v1 keeps the code simple.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFirmMember } from "@/lib/apiAuth";
import JSZip from "jszip";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cap to prevent runaway requests (someone selecting "All time" on an
// account with thousands of receipts). 500 receipts × ~2MB average is
// roughly 1GB — at that point they should ask for a custom export.
const MAX_RECEIPTS = 500;

function safeFileSegment(s: string): string {
  // Strip filesystem-unsafe characters and trim length so the ZIP entry
  // names stay portable across Windows/macOS/Linux.
  return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 60);
}

function extFromUrl(url: string, contentType: string | null): string {
  // Prefer the URL's extension; fall back to content-type sniffing.
  const m = url.split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes("pdf")) return "pdf";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("heic")) return "heic";
  return "jpg";
}

export async function POST(request: NextRequest) {
  let body: {
    firmId?: string;
    clientId?: string | null;
    receiptIds?: string[];
    startDate?: string | null;
    endDate?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firmId, clientId, receiptIds, startDate, endDate } = body;
  if (!firmId) {
    return NextResponse.json({ error: "Missing firmId" }, { status: 400 });
  }
  const hasIds = Array.isArray(receiptIds) && receiptIds.length > 0;
  const hasRange = !!startDate || !!endDate;
  if (!hasIds && !hasRange) {
    return NextResponse.json(
      { error: "Either receiptIds or a date range (startDate/endDate) is required." },
      { status: 400 }
    );
  }

  const auth = await requireFirmMember(request, firmId);
  if (auth instanceof NextResponse) return auth;

  // Build the receipt query. Always firm-scoped; optionally client-
  // scoped; either ID set or date range.
  let q = supabase
    .from("receipts")
    .select("id, vendor, receipt_date, total_cents, image_url")
    .eq("firm_id", firmId)
    .not("image_url", "is", null);
  if (clientId) q = q.eq("client_id", clientId);
  if (hasIds) {
    // Slice defensively in case the caller sent an oversized list.
    q = q.in("id", receiptIds!.slice(0, MAX_RECEIPTS));
  } else {
    if (startDate) q = q.gte("receipt_date", startDate);
    if (endDate) q = q.lte("receipt_date", endDate);
    q = q.limit(MAX_RECEIPTS);
  }
  q = q.order("receipt_date", { ascending: true, nullsFirst: false });

  const { data: receipts, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list = (receipts || []).filter(r => r.image_url);
  if (list.length === 0) {
    return NextResponse.json(
      { error: "No receipts with attached images in that range." },
      { status: 404 }
    );
  }

  // Build the ZIP. We fetch each file by its stored public URL — they
  // already live in Supabase Storage's receipt-files bucket which is
  // configured public, so no signed-URL ceremony needed here.
  const zip = new JSZip();
  const seen = new Map<string, number>(); // collision counter for duplicate filenames
  let added = 0;
  const failed: { id: string; reason: string }[] = [];

  for (const r of list) {
    try {
      const res = await fetch(r.image_url as string);
      if (!res.ok) {
        failed.push({ id: r.id, reason: `HTTP ${res.status}` });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = extFromUrl(r.image_url as string, res.headers.get("content-type"));
      const dateSeg = r.receipt_date || "no-date";
      const vendorSeg = safeFileSegment(r.vendor || "Unknown");
      const totalSeg = r.total_cents
        ? `$${(r.total_cents / 100).toFixed(2)}`
        : "";
      let base = [dateSeg, vendorSeg, totalSeg].filter(Boolean).join("_");
      // Disambiguate duplicate basenames (two receipts on the same
      // date from the same vendor at the same total — happens with
      // gift cards or split bills).
      const collisions = seen.get(base) || 0;
      seen.set(base, collisions + 1);
      const filename = collisions === 0 ? `${base}.${ext}` : `${base}_${collisions + 1}.${ext}`;
      zip.file(filename, buf);
      added += 1;
    } catch (err: any) {
      failed.push({ id: r.id, reason: err?.message || "unknown" });
    }
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "Could not fetch any of the receipt images.", failed },
      { status: 502 }
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  // STORE (no compression) — receipt images (JPEG/PNG/PDF) are already
  // compressed; CPU-spending on re-deflating them is wasted. Saves
  // server time without growing the output.

  const filename = hasRange
    ? `Receipts-${(startDate || "all").split("T")[0]}-to-${(endDate || "now").split("T")[0]}.zip`
    : `Receipts-${added}-selected.zip`;

  return new NextResponse(zipBuffer as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuffer.length),
      "X-Receipts-Included": String(added),
      "X-Receipts-Failed": String(failed.length),
    },
  });
}
