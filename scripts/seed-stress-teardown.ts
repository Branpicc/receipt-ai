/**
 * scripts/seed-stress-teardown.ts
 *
 * Delete everything created by scripts/seed-stress.ts:
 *   - All firms with names starting with `STRESS_TEST_`
 *   - All auth users with email ending in `@stresstest.local`
 *
 * Relies on ON DELETE CASCADE for child rows (firm_users, clients,
 * receipts, etc.). If any of your tables don't cascade off firm_id,
 * they'll need manual cleanup.
 *
 * Usage:
 *   npm run seed:stress:teardown -- --yes
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const STRESS_TAG = "STRESS_TEST_";
const STRESS_EMAIL_DOMAIN = "stresstest.local";

async function main() {
  // 1. Find stress firms
  const { data: firms, error: firmsErr } = await supabase
    .from("firms")
    .select("id, name")
    .like("name", `${STRESS_TAG}%`);
  if (firmsErr) throw firmsErr;

  // 2. Find stress auth users
  const { data: usersList, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) throw usersErr;
  const stressUsers = usersList.users.filter(u => u.email?.endsWith(`@${STRESS_EMAIL_DOMAIN}`));

  console.log("=== Receipture stress teardown ===");
  console.log(`Firms to delete:      ${firms?.length ?? 0}`);
  console.log(`Auth users to delete: ${stressUsers.length}`);
  console.log(`Target:               ${SUPABASE_URL}`);
  console.log("");

  if (!confirmed) {
    console.log('Dry run. Re-run with --yes to actually delete.');
    if (firms && firms.length > 0) {
      console.log("\nFirms that would be deleted:");
      for (const f of firms.slice(0, 10)) console.log(`  - ${f.name}`);
      if (firms.length > 10) console.log(`  ...and ${firms.length - 10} more`);
    }
    process.exit(0);
  }

  // 3. Delete firms (CASCADE removes firm_users, clients, receipts, taxes, flags, budgets)
  if (firms && firms.length > 0) {
    const ids = firms.map(f => f.id);
    const { error: delErr } = await supabase.from("firms").delete().in("id", ids);
    if (delErr) throw delErr;
    console.log(`Deleted ${firms.length} firms (cascade)`);
  }

  // 4. Delete auth users
  let deleted = 0;
  for (const u of stressUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.error(`  Failed to delete ${u.email}: ${error.message}`);
    } else {
      deleted++;
    }
  }
  console.log(`Deleted ${deleted}/${stressUsers.length} auth users`);

  console.log("\nTeardown complete.");
}

main().catch(err => {
  console.error("\nTeardown failed:", err);
  process.exit(1);
});
