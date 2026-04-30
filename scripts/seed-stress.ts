/**
 * scripts/seed-stress.ts
 *
 * Populate Supabase with realistic stress-test data for Receipture.
 *
 * Usage:
 *   npm run seed:stress -- --yes
 *   npm run seed:stress -- --yes --volume=medium
 *   npm run seed:stress -- --yes --volume=heavy
 *
 * Without --yes, prints a dry-run plan and exits.
 *
 * Everything created is tagged with `STRESS_TEST_` in firm names and
 * `@stresstest.local` in emails. Teardown via:
 *   npm run seed:stress:teardown -- --yes
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ---------- CLI ----------
type Volume = "light" | "medium" | "heavy";
const args = process.argv.slice(2);
const volume = (args.find(a => a.startsWith("--volume="))?.split("=")[1] || "light") as Volume;
const confirmed = args.includes("--yes");

const VOLUMES: Record<Volume, {
  firms: number;
  clientsPerFirm: number;
  accountantsPerFirm: number;
  months: number;
  receiptsPerClientPerMonth: number;
}> = {
  light:  { firms: 3, clientsPerFirm: 5,  accountantsPerFirm: 2, months: 12, receiptsPerClientPerMonth: 30 },
  medium: { firms: 5, clientsPerFirm: 10, accountantsPerFirm: 3, months: 24, receiptsPerClientPerMonth: 50 },
  heavy:  { firms: 5, clientsPerFirm: 10, accountantsPerFirm: 3, months: 24, receiptsPerClientPerMonth: 200 },
};
const config = VOLUMES[volume];
if (!config) {
  console.error(`Unknown volume "${volume}". Use --volume=light|medium|heavy`);
  process.exit(1);
}

// ---------- Env ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------- Constants ----------
const STRESS_TAG = "STRESS_TEST_";
const STRESS_EMAIL_DOMAIN = "stresstest.local";
const STRESS_PASSWORD = "StressTest123!";

const FIRST_NAMES = ["Aiden", "Olivia", "Noah", "Emma", "Liam", "Sophia", "Lucas", "Ava", "Ethan", "Mia", "Mason", "Charlotte", "Logan", "Amelia", "James"];
const LAST_NAMES = ["Smith", "Tremblay", "Roy", "Singh", "Patel", "Brown", "Wilson", "Lee", "Martin", "MacDonald", "Nguyen", "Bouchard", "Thompson", "Wong", "Khan"];
const BUSINESS_SUFFIXES = ["Inc.", "Ltd.", "Co.", "Group", "Holdings", "Services", "Consulting", "Solutions", "Enterprises", "Partners"];

const VENDORS: Array<{ name: string; category: string; avgCents: number; isMeal?: boolean }> = [
  // Meals & Entertainment
  { name: "Tim Hortons", category: "Meals & Entertainment", avgCents: 1500, isMeal: true },
  { name: "Starbucks", category: "Meals & Entertainment", avgCents: 800, isMeal: true },
  { name: "A&W", category: "Meals & Entertainment", avgCents: 1800, isMeal: true },
  { name: "Boston Pizza", category: "Meals & Entertainment", avgCents: 4500, isMeal: true },
  { name: "The Keg", category: "Meals & Entertainment", avgCents: 9000, isMeal: true },
  { name: "Subway", category: "Meals & Entertainment", avgCents: 1200, isMeal: true },
  // Vehicle Expenses & Fuel
  { name: "Esso", category: "Vehicle Expenses & Fuel", avgCents: 6500 },
  { name: "Petro-Canada", category: "Vehicle Expenses & Fuel", avgCents: 7000 },
  { name: "Shell", category: "Vehicle Expenses & Fuel", avgCents: 6800 },
  { name: "Canadian Tire Auto", category: "Vehicle Expenses & Fuel", avgCents: 12000 },
  // Office Supplies & Expenses
  { name: "Staples", category: "Office Supplies & Expenses", avgCents: 4000 },
  { name: "Costco Wholesale", category: "Office Supplies & Expenses", avgCents: 9500 },
  { name: "Walmart", category: "Office Supplies & Expenses", avgCents: 5500 },
  // Software & Subscriptions
  { name: "Adobe Creative Cloud", category: "Software & Subscriptions", avgCents: 5000 },
  { name: "Microsoft 365", category: "Software & Subscriptions", avgCents: 1500 },
  { name: "Google Workspace", category: "Software & Subscriptions", avgCents: 2000 },
  { name: "Slack", category: "Software & Subscriptions", avgCents: 850 },
  { name: "GitHub", category: "Software & Subscriptions", avgCents: 600 },
  // Telephone & Internet
  { name: "Bell Canada", category: "Telephone & Internet", avgCents: 8500 },
  { name: "Rogers", category: "Telephone & Internet", avgCents: 9200 },
  { name: "Telus", category: "Telephone & Internet", avgCents: 7800 },
  // Utilities
  { name: "Hydro One", category: "Utilities", avgCents: 12000 },
  { name: "Enbridge Gas", category: "Utilities", avgCents: 8000 },
  // Equipment & Tools
  { name: "Best Buy", category: "Equipment & Tools", avgCents: 25000 },
  { name: "Home Depot", category: "Equipment & Tools", avgCents: 8500 },
  // Advertising & Promotion
  { name: "Indeed", category: "Advertising & Promotion", avgCents: 8000 },
  { name: "Facebook Ads", category: "Advertising & Promotion", avgCents: 12000 },
  { name: "Google Ads", category: "Advertising & Promotion", avgCents: 15000 },
  // Professional Fees
  { name: "Legal Services LLP", category: "Professional Fees", avgCents: 35000 },
  { name: "KPMG Audit Fee", category: "Professional Fees", avgCents: 65000 },
  // Travel
  { name: "WestJet", category: "Travel Expenses", avgCents: 35000 },
  { name: "Air Canada", category: "Travel Expenses", avgCents: 40000 },
  { name: "Marriott", category: "Travel Expenses", avgCents: 18000 },
  { name: "Uber", category: "Travel Expenses", avgCents: 2500 },
  // Rent & Lease
  { name: "Office Rent — 401 Bay St", category: "Rent & Lease", avgCents: 250000 },
];

const FLAG_TYPES: Array<{ type: string; severity: string; message: string }> = [
  { type: "personal_card_used", severity: "high", message: "Personal card detected. Please verify if this is a business expense." },
  { type: "unrecognized_card", severity: "warn", message: "Card not in registered cards list." },
  { type: "duplicate_suspected", severity: "warn", message: "Possible duplicate of an earlier receipt." },
  { type: "amount_mismatch", severity: "warn", message: "Line items don't sum to total." },
  { type: "needs_purpose", severity: "warn", message: "No purpose attached to this receipt." },
];

const PURPOSES = [
  "Client meeting at downtown office",
  "Team lunch — Q3 planning",
  "Travel to Toronto branch",
  "Office supplies for new hire",
  "Conference registration",
  "Software licence renewal",
  "Vendor demo coffee",
  "Quarterly team offsite",
  "Continuing education materials",
  "Equipment for remote setup",
];

// ---------- Helpers ----------
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const chance = (p: number) => Math.random() < p;
const jitter = (cents: number) => Math.max(100, Math.round(cents * (0.5 + Math.random() * 1.5)));

function fullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function clientCompanyName() {
  return `${pick(LAST_NAMES)} ${pick(BUSINESS_SUFFIXES)}`;
}
function emailFor(prefix: string, firmIndex: number, n: number) {
  return `stress-${prefix}-f${firmIndex}-${n}@${STRESS_EMAIL_DOMAIN}`;
}

/**
 * Build a date inside `monthsAgo` months ago, jittered across the month.
 * If clusterMinute is set, the time-of-day clusters around that minute
 * (used for burst windows).
 */
function dateInMonthsAgo(monthsAgo: number, clusterMinute?: number): Date {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = rand(1, daysInMonth);
  if (clusterMinute !== undefined) {
    return new Date(target.getFullYear(), target.getMonth(), day, rand(8, 19), clusterMinute, rand(0, 59));
  }
  return new Date(target.getFullYear(), target.getMonth(), day, rand(8, 21), rand(0, 59), rand(0, 59));
}

// ---------- Plan ----------
const totalReceipts = config.firms * config.clientsPerFirm * config.months * config.receiptsPerClientPerMonth;
const totalUsers = config.firms * (1 /*owner*/ + 1 /*firm_admin*/ + config.accountantsPerFirm + config.clientsPerFirm /*client users*/);

console.log("=== Receipture stress seed ===");
console.log(`Volume:     ${volume}`);
console.log(`Firms:      ${config.firms}`);
console.log(`Per firm:   1 owner, 1 firm_admin, ${config.accountantsPerFirm} accountants, ${config.clientsPerFirm} clients`);
console.log(`Months:     ${config.months}`);
console.log(`Receipts:   ~${totalReceipts.toLocaleString()} total`);
console.log(`Auth users: ~${totalUsers} (logins: any of them with password "${STRESS_PASSWORD}")`);
console.log(`Target:     ${SUPABASE_URL}`);
console.log("");

if (!confirmed) {
  console.log('Dry run. Re-run with --yes to actually seed.');
  process.exit(0);
}

// ---------- Main ----------
async function main() {
  const startedAt = Date.now();
  console.log(`Starting at ${new Date().toISOString()}\n`);

  for (let f = 1; f <= config.firms; f++) {
    await seedFirm(f);
  }

  console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  console.log(`Tear down with:  npm run seed:stress:teardown -- --yes`);
}

async function seedFirm(firmIndex: number) {
  const firmName = `${STRESS_TAG}Firm ${firmIndex} — ${pick(BUSINESS_SUFFIXES)} Accounting`;
  console.log(`[Firm ${firmIndex}] Creating "${firmName}"`);

  const { data: firm, error: firmErr } = await supabase
    .from("firms")
    .insert([{ name: firmName }])
    .select("id")
    .single();
  if (firmErr || !firm) throw firmErr || new Error("firm insert returned no row");
  const firmId: string = firm.id;

  // 1 owner + 1 firm_admin + N accountants + M client-users
  const owner = await createUserAndLink(firmId, "owner", firmIndex, 1, "Owner");
  await createUserAndLink(firmId, "firm_admin", firmIndex, 1, "Firm Admin");

  const accountants: Array<{ firmUserId: string; name: string }> = [];
  for (let i = 1; i <= config.accountantsPerFirm; i++) {
    const acc = await createUserAndLink(firmId, "accountant", firmIndex, i, fullName());
    accountants.push({ firmUserId: acc.firmUserId, name: acc.name });
  }
  console.log(`  ${accountants.length} accountants created`);

  // Clients (the customers, not auth users)
  const clientRows = Array.from({ length: config.clientsPerFirm }, () => ({
    firm_id: firmId,
    name: clientCompanyName(),
    is_active: true,
    assigned_accountant_id: pick(accountants).firmUserId,
  }));
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .insert(clientRows)
    .select("id, name, assigned_accountant_id");
  if (clientsErr || !clients) throw clientsErr || new Error("clients insert returned no rows");
  console.log(`  ${clients.length} clients created`);

  // Per-client auth user (role 'client') linked to that client_id
  for (let i = 0; i < clients.length; i++) {
    await createUserAndLink(firmId, "client", firmIndex, i + 1, clients[i].name, clients[i].id);
  }

  // Per-client budgets (4-8 random categories)
  const allCategories = Array.from(new Set(VENDORS.map(v => v.category)));
  const budgetRows: any[] = [];
  for (const c of clients) {
    const numCats = rand(4, 8);
    const cats = [...allCategories].sort(() => Math.random() - 0.5).slice(0, numCats);
    for (const cat of cats) {
      budgetRows.push({
        firm_id: firmId,
        client_id: c.id,
        category: cat,
        monthly_budget_cents: rand(2000, 200000),
      });
    }
  }
  if (budgetRows.length > 0) {
    const { error: budErr } = await supabase.from("category_budgets").insert(budgetRows);
    if (budErr) throw budErr;
    console.log(`  ${budgetRows.length} per-client budgets`);
  }

  // Receipts — big batch
  console.log(`  Generating receipts...`);
  let totalInserted = 0;
  for (const c of clients) {
    const inserted = await seedReceiptsForClient(firmId, c.id, owner.firmUserId);
    totalInserted += inserted;
  }
  console.log(`  ${totalInserted.toLocaleString()} receipts inserted (with taxes/flags)`);
}

async function createUserAndLink(
  firmId: string,
  role: "owner" | "firm_admin" | "accountant" | "client",
  firmIndex: number,
  n: number,
  displayName: string,
  clientId?: string,
) {
  const email = emailFor(role, firmIndex, n);
  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: STRESS_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName, stress_test: true },
  });
  if (userErr || !created?.user) throw userErr || new Error("auth.admin.createUser returned nothing");

  const link: any = {
    firm_id: firmId,
    auth_user_id: created.user.id,
    role,
    display_name: displayName,
  };
  if (clientId) link.client_id = clientId;

  const { data: fu, error: fuErr } = await supabase
    .from("firm_users")
    .insert([link])
    .select("id")
    .single();
  if (fuErr || !fu) throw fuErr || new Error("firm_users insert returned nothing");

  return { authUserId: created.user.id, firmUserId: fu.id, name: displayName, email };
}

async function seedReceiptsForClient(firmId: string, clientId: string, uploaderFirmUserId: string) {
  const receiptRows: any[] = [];

  for (let monthsAgo = 0; monthsAgo < config.months; monthsAgo++) {
    // Burst windows: pick 3 random days where 5-10 receipts arrive within minutes
    const burstDays = new Set<number>([rand(2, 9), rand(10, 19), rand(20, 28)]);

    for (let r = 0; r < config.receiptsPerClientPerMonth; r++) {
      const vendor = pick(VENDORS);
      const totalCents = jitter(vendor.avgCents);
      // 13% HST on most things
      const taxCents = Math.round((totalCents * 0.13) / 1.13);
      // Gratuity ~10-18% on meals
      const gratuityCents = vendor.isMeal && chance(0.6)
        ? Math.round(totalCents * (0.1 + Math.random() * 0.08))
        : null;

      // Date logic — burst on certain days
      const isBurst = chance(0.15);
      const burstDay = Array.from(burstDays)[rand(0, burstDays.size - 1)];
      const date = isBurst
        ? new Date(new Date().getFullYear(), new Date().getMonth() - monthsAgo, burstDay, rand(8, 19), rand(0, 5), rand(0, 59))
        : dateInMonthsAgo(monthsAgo);

      // 80% categorized (approved), 15% uncategorized, 5% suggested but not approved
      const categorized = Math.random();
      const approvedCategory = categorized < 0.8 ? vendor.category : null;
      const suggestedCategory = approvedCategory ? null : (categorized < 0.95 ? vendor.category : null);

      // 60% have purpose attached
      const purpose = chance(0.6) ? pick(PURPOSES) : null;

      receiptRows.push({
        firm_id: firmId,
        client_id: clientId,
        uploaded_by: uploaderFirmUserId,
        source: chance(0.7) ? "upload" : "email",
        status: approvedCategory ? "approved" : "needs_review",
        currency: "CAD",
        extraction_status: "completed",
        vendor: vendor.name,
        receipt_date: date.toISOString().slice(0, 10),
        total_cents: totalCents,
        gratuity_cents: gratuityCents,
        approved_category: approvedCategory,
        suggested_category: suggestedCategory,
        purpose_text: purpose,
        payment_method: chance(0.6) ? "card" : (chance(0.5) ? "cash" : null),
        card_brand: chance(0.7) ? pick(["VISA", "MASTERCARD", "AMEX"]) : null,
        card_last_four: chance(0.7) ? String(rand(1000, 9999)) : null,
        card_entry_method: chance(0.7) ? pick(["chip", "tap", "swipe"]) : null,
        ocr_raw_text: `${vendor.name}\n${date.toLocaleDateString()}\nTOTAL $${(totalCents / 100).toFixed(2)}\nHST $${(taxCents / 100).toFixed(2)}`,
        created_at: date.toISOString(),
        // We'll attach taxes/flags after we have receipt IDs
        _meta: { taxCents, vendor },
      });
    }
  }

  // Strip _meta before insert; remember it for taxes/flags
  const metas = receiptRows.map(r => r._meta);
  receiptRows.forEach(r => delete r._meta);

  // Batch insert in chunks of 500 to keep Supabase happy
  const inserted: any[] = [];
  for (let i = 0; i < receiptRows.length; i += 500) {
    const batch = receiptRows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("receipts")
      .insert(batch)
      .select("id");
    if (error) throw error;
    if (data) inserted.push(...data);
  }

  // Taxes
  const taxRows = inserted.map((row, idx) => ({
    receipt_id: row.id,
    firm_id: firmId,
    tax_type: "HST",
    rate: 0.13,
    amount_cents: metas[idx].taxCents,
  }));
  for (let i = 0; i < taxRows.length; i += 500) {
    const { error } = await supabase.from("receipt_taxes").insert(taxRows.slice(i, i + 500));
    if (error) throw error;
  }

  // Flags — 8% of receipts get a random flag, half resolved
  const flagRows: any[] = [];
  for (const row of inserted) {
    if (chance(0.08)) {
      const flag = pick(FLAG_TYPES);
      flagRows.push({
        receipt_id: row.id,
        firm_id: firmId,
        flag_type: flag.type,
        severity: flag.severity,
        message: flag.message,
        resolved_at: chance(0.5) ? new Date().toISOString() : null,
      });
    }
  }
  for (let i = 0; i < flagRows.length; i += 500) {
    const { error } = await supabase.from("receipt_flags").insert(flagRows.slice(i, i + 500));
    if (error) throw error;
  }

  return inserted.length;
}

main().catch(err => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
