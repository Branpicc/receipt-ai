/**
 * Demo-data seeder for the immersive first-login tour.
 *
 * Creates a fixed-shape dataset (3 clients, 1 placeholder accountant,
 * 15 receipts, 1 [Demo] folder) so a brand-new firm has something to
 * look at instead of staring at empty tables. Every row is tagged
 * is_demo=true so it can be filtered out of exports and wiped via the
 * "Clear demo data" button.
 *
 * Idempotent: if any clients/firm_users/receipts already exist with
 * is_demo=true for this firm, seedDemoData returns early without
 * touching the DB. Safe to call from /api/seed-demo-data on every
 * tour-start without checks at the call site.
 *
 * Service-role caller required (it writes through RLS on multiple
 * tables — including the placeholder accountant whose auth user has
 * no real session).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const DEMO_CLIENTS = [
  { name: "[Demo] Smith Plumbing",   province: "ON", timezone: "America/Toronto" },
  { name: "[Demo] Jones Cafe",       province: "ON", timezone: "America/Toronto" },
  { name: "[Demo] North Hardware",   province: "ON", timezone: "America/Toronto" },
];

const DEMO_ACCOUNTANT_NAME = "[Demo] Sarah Mitchell";

const DEMO_FOLDER_NAME = "[Demo] Sample receipts";
const DEMO_FOLDER_DESCRIPTION = "Auto-created demo data so you have something to explore. Clear it any time from Settings.";

// 15 receipts split 5/5/5 across the demo clients. Vendors, dates,
// totals, and categories are deliberately varied so the tour can
// point at "look, here's a flagged one", "look, here's an
// uncategorized one", etc.
type DemoReceipt = {
  vendor: string;
  daysAgo: number;
  totalCents: number;
  approved_category: string | null;
  suggested_category: string;
  status: "approved" | "needs_review";
  payment_method: "card" | "cash" | null;
  card_brand: string | null;
  card_last_four: string | null;
  hstCents: number;
  flag?: { type: string; severity: "info" | "warn" | "high"; message: string };
};

const DEMO_RECEIPTS_PER_CLIENT: DemoReceipt[][] = [
  // Smith Plumbing — fuel, supplies, meals
  [
    { vendor: "Petro-Canada",       daysAgo: 2,  totalCents: 8745,  approved_category: "Vehicle - Fuel",        suggested_category: "Vehicle - Fuel",        status: "approved",     payment_method: "card", card_brand: "VISA",       card_last_four: "4012", hstCents: 1006 },
    { vendor: "The Home Depot",     daysAgo: 5,  totalCents: 21342, approved_category: "Office - Tools",        suggested_category: "Office - Tools",        status: "approved",     payment_method: "card", card_brand: "MASTERCARD", card_last_four: "8821", hstCents: 2455 },
    { vendor: "Tim Hortons",        daysAgo: 7,  totalCents: 1245,  approved_category: null,                    suggested_category: "Meals (50%)",           status: "needs_review", payment_method: "card", card_brand: "VISA",       card_last_four: "4012", hstCents: 143 },
    { vendor: "Canadian Tire",      daysAgo: 12, totalCents: 6789,  approved_category: null,                    suggested_category: "Office - Supplies",     status: "needs_review", payment_method: "card", card_brand: "VISA",       card_last_four: "4012", hstCents: 781 },
    { vendor: "Shell",              daysAgo: 18, totalCents: 7234,  approved_category: "Vehicle - Fuel",        suggested_category: "Vehicle - Fuel",        status: "approved",     payment_method: "card", card_brand: "VISA",       card_last_four: "4012", hstCents: 832 },
  ],
  // Jones Cafe — meals, supplies, utilities, one flagged
  [
    { vendor: "Costco Wholesale",   daysAgo: 1,  totalCents: 32145, approved_category: "Office - Supplies",     suggested_category: "Office - Supplies",     status: "approved",     payment_method: "card", card_brand: "VISA",       card_last_four: "9923", hstCents: 3697 },
    { vendor: "Bell Canada",        daysAgo: 4,  totalCents: 12500, approved_category: "Telecommunications",    suggested_category: "Telecommunications",    status: "approved",     payment_method: "card", card_brand: "AMEX",       card_last_four: "1004", hstCents: 1438 },
    { vendor: "Boston Pizza",       daysAgo: 9,  totalCents: 8920,  approved_category: null,                    suggested_category: "Meals (50%)",           status: "needs_review", payment_method: "card", card_brand: "VISA",       card_last_four: "9923", hstCents: 1026, flag: { type: "personal_card_used", severity: "warn", message: "Card ending 9923 isn't in this client's registered business cards. Verify before approving." } },
    { vendor: "Staples",            daysAgo: 14, totalCents: 4234,  approved_category: "Office - Supplies",     suggested_category: "Office - Supplies",     status: "approved",     payment_method: "card", card_brand: "VISA",       card_last_four: "9923", hstCents: 487 },
    { vendor: "Indigo Books",       daysAgo: 22, totalCents: 6789,  approved_category: null,                    suggested_category: "Subscriptions",         status: "needs_review", payment_method: "card", card_brand: "VISA",       card_last_four: "9923", hstCents: 781 },
  ],
  // North Hardware — fuel, meals, supplies
  [
    { vendor: "Walmart",            daysAgo: 3,  totalCents: 14589, approved_category: "Office - Supplies",     suggested_category: "Office - Supplies",     status: "approved",     payment_method: "card", card_brand: "MASTERCARD", card_last_four: "3344", hstCents: 1677 },
    { vendor: "Subway",             daysAgo: 6,  totalCents: 1875,  approved_category: null,                    suggested_category: "Meals (50%)",           status: "needs_review", payment_method: "cash", card_brand: null,        card_last_four: null,    hstCents: 216 },
    { vendor: "Lowes",              daysAgo: 11, totalCents: 8967,  approved_category: "Office - Tools",        suggested_category: "Office - Tools",        status: "approved",     payment_method: "card", card_brand: "MASTERCARD", card_last_four: "3344", hstCents: 1031 },
    { vendor: "Cogeco",             daysAgo: 16, totalCents: 9800,  approved_category: "Telecommunications",    suggested_category: "Telecommunications",    status: "approved",     payment_method: "card", card_brand: "MASTERCARD", card_last_four: "3344", hstCents: 1127 },
    { vendor: "Best Buy",           daysAgo: 24, totalCents: 45678, approved_category: null,                    suggested_category: "Office - Equipment",    status: "needs_review", payment_method: "card", card_brand: "MASTERCARD", card_last_four: "3344", hstCents: 5253 },
  ],
];

function makeClientCode() {
  return "c_demo_" + crypto.randomBytes(4).toString("hex");
}

function placeholderEmail(firmId: string) {
  // RFC 6761 reserves `.test` for these exact "no real mailbox" cases.
  // Supabase Auth accepts any RFC-valid email; nothing actually sends here.
  return `demo-accountant-${firmId.replace(/-/g, "").slice(0, 8)}@receipture.test`;
}

export type SeedResult =
  | { kind: "seeded"; clientCount: number; receiptCount: number }
  | { kind: "already-seeded" };

/**
 * Idempotently seed demo data into the given firm.
 *
 * For role=firm_admin, the 3 demo clients get assigned to the new
 * placeholder demo accountant. For role=accountant, the 3 demo clients
 * get assigned to the calling accountant directly.
 */
export async function seedDemoData(
  firmId: string,
  callerRole: "firm_admin" | "accountant",
  callerFirmUserId: string,
  client?: SupabaseClient,
): Promise<SeedResult> {
  const supabase = client ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Idempotency check — bail out if any demo client already exists.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_demo", true)
    .limit(1);
  if (existing && existing.length > 0) {
    return { kind: "already-seeded" };
  }

  // 1. Placeholder demo accountant (firm_admin tour only — accountants
  //    just use themselves as the assignee).
  let assigneeFirmUserId: string;
  if (callerRole === "firm_admin") {
    const fakeEmail = placeholderEmail(firmId);
    // Random password — discarded, never disclosed. The user account
    // exists because firm_users.auth_user_id is a real FK; no one can
    // sign in as them.
    const randomPassword = crypto.randomBytes(24).toString("hex");
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { display_name: DEMO_ACCOUNTANT_NAME, is_demo: true },
    });
    if (authErr || !created.user) {
      throw new Error(`Demo accountant auth user creation failed: ${authErr?.message || "unknown"}`);
    }
    const { data: fu, error: fuErr } = await supabase
      .from("firm_users")
      .insert([{
        firm_id: firmId,
        auth_user_id: created.user.id,
        role: "accountant",
        display_name: DEMO_ACCOUNTANT_NAME,
        email_verified_at: new Date().toISOString(),
        is_demo: true,
      }])
      .select("id")
      .single();
    if (fuErr || !fu) {
      // Roll back the auth user so a half-seeded firm doesn't leave an
      // orphan demo account around.
      try { await supabase.auth.admin.deleteUser(created.user.id); } catch {}
      throw new Error(`Demo accountant firm_users insert failed: ${fuErr?.message || "unknown"}`);
    }
    assigneeFirmUserId = fu.id;
  } else {
    assigneeFirmUserId = callerFirmUserId;
  }

  // 2. Three demo clients, all assigned to the demo accountant (or to
  //    the calling accountant if the caller is one).
  const clientRows = DEMO_CLIENTS.map(c => ({
    firm_id: firmId,
    name: c.name,
    client_code: makeClientCode(),
    province: c.province,
    timezone: c.timezone,
    is_active: true,
    is_demo: true,
    assigned_accountant_id: assigneeFirmUserId,
  }));
  const { data: clientInserts, error: clientErr } = await supabase
    .from("clients")
    .insert(clientRows)
    .select("id, name");
  if (clientErr || !clientInserts || clientInserts.length !== DEMO_CLIENTS.length) {
    throw new Error(`Demo clients insert failed: ${clientErr?.message || "row count mismatch"}`);
  }

  // 3. [Demo] folder, firm-wide (no client_id so all roles can see it).
  const { error: folderErr } = await supabase
    .from("receipt_folders")
    .insert([{
      firm_id: firmId,
      name: DEMO_FOLDER_NAME,
      description: DEMO_FOLDER_DESCRIPTION,
      is_demo: true,
    }]);
  if (folderErr) {
    // Non-blocking. The receipts will just live un-foldered.
    console.warn("[demoData] folder insert failed:", folderErr.message);
  }

  // 4. 15 receipts (5 per client). receipt_date is anchored to "today
  //    minus N days" so the dashboard always shows reasonably recent
  //    activity regardless of when the user signs up.
  const today = new Date();
  type ReceiptInsert = {
    firm_id: string;
    client_id: string;
    uploaded_by: string;
    source: string;
    status: string;
    currency: string;
    extraction_status: string;
    vendor: string;
    receipt_date: string;
    total_cents: number;
    approved_category: string | null;
    suggested_category: string;
    payment_method: string | null;
    card_brand: string | null;
    card_last_four: string | null;
    card_entry_method: string | null;
    purpose_text: string | null;
    is_demo: boolean;
    created_at: string;
  };
  const receiptRows: ReceiptInsert[] = [];
  const flagsToInsert: { idx: number; flag: NonNullable<DemoReceipt["flag"]> }[] = [];
  const taxesToInsert: { idx: number; amount_cents: number }[] = [];

  clientInserts.forEach((clientRow, clientIdx) => {
    DEMO_RECEIPTS_PER_CLIENT[clientIdx].forEach((rec) => {
      const date = new Date(today.getTime() - rec.daysAgo * 24 * 60 * 60 * 1000);
      receiptRows.push({
        firm_id: firmId,
        client_id: clientRow.id,
        uploaded_by: assigneeFirmUserId,
        source: "demo",
        status: rec.status,
        currency: "CAD",
        extraction_status: "completed",
        vendor: rec.vendor,
        receipt_date: date.toISOString().slice(0, 10),
        total_cents: rec.totalCents,
        approved_category: rec.approved_category,
        suggested_category: rec.suggested_category,
        payment_method: rec.payment_method,
        card_brand: rec.card_brand,
        card_last_four: rec.card_last_four,
        card_entry_method: rec.payment_method === "card" ? "tap" : null,
        purpose_text: null,
        is_demo: true,
        created_at: date.toISOString(),
      });
      const idx = receiptRows.length - 1;
      taxesToInsert.push({ idx, amount_cents: rec.hstCents });
      if (rec.flag) flagsToInsert.push({ idx, flag: rec.flag });
    });
  });

  const { data: receiptInserts, error: receiptErr } = await supabase
    .from("receipts")
    .insert(receiptRows)
    .select("id");
  if (receiptErr || !receiptInserts || receiptInserts.length !== receiptRows.length) {
    throw new Error(`Demo receipts insert failed: ${receiptErr?.message || "row count mismatch"}`);
  }

  // 5. Taxes — every receipt gets HST.
  const taxRows = taxesToInsert.map(t => ({
    receipt_id: receiptInserts[t.idx].id,
    firm_id: firmId,
    tax_type: "HST",
    rate: 0.13,
    amount_cents: t.amount_cents,
  }));
  await supabase.from("receipt_taxes").insert(taxRows);

  // 6. Flags — only for receipts that have one defined.
  if (flagsToInsert.length > 0) {
    const flagRows = flagsToInsert.map(f => ({
      receipt_id: receiptInserts[f.idx].id,
      firm_id: firmId,
      flag_type: f.flag.type,
      severity: f.flag.severity,
      message: f.flag.message,
      resolved_at: null,
    }));
    await supabase.from("receipt_flags").insert(flagRows);
  }

  return {
    kind: "seeded",
    clientCount: clientInserts.length,
    receiptCount: receiptInserts.length,
  };
}

/**
 * Wipe every demo entity in the firm. Cascade handles items/taxes/flags
 * via the receipts FK; we explicitly delete clients (which cascades
 * receipts), the demo folder, and the placeholder accountant's auth
 * user + firm_users row.
 */
export async function clearDemoData(firmId: string, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Pull the placeholder accountant's auth_user_id before deleting the
  // firm_users row so we can also nuke the auth.users record.
  const { data: demoAccountants } = await supabase
    .from("firm_users")
    .select("auth_user_id")
    .eq("firm_id", firmId)
    .eq("is_demo", true);

  // Deleting clients cascades receipts (which cascade items/taxes/flags
  // via the receipts FK).
  await supabase.from("clients").delete().eq("firm_id", firmId).eq("is_demo", true);

  // Demo folder.
  await supabase.from("receipt_folders").delete().eq("firm_id", firmId).eq("is_demo", true);

  // Demo firm_users (placeholder accountant).
  await supabase.from("firm_users").delete().eq("firm_id", firmId).eq("is_demo", true);

  // Auth users for demo accountants. Don't fail the whole cleanup if one
  // of these errors — orphaned auth users are an annoyance, not a
  // blocker.
  for (const a of demoAccountants || []) {
    if (!a.auth_user_id) continue;
    try {
      await supabase.auth.admin.deleteUser(a.auth_user_id);
    } catch (err) {
      console.warn("[demoData] auth user delete failed:", err);
    }
  }
}
