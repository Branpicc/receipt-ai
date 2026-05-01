import { supabase } from "./supabaseClient";

/**
 * Demo-data export rule.
 *
 * While a firm has only demo receipts, exports include them — the user
 * needs to be able to try the export flow with demo data. As soon as a
 * single non-demo receipt exists in the firm, exports filter out every
 * is_demo=true row so accountants don't accidentally book sample data
 * into QuickBooks.
 *
 * Returns true if demo receipts should be filtered OUT of exports.
 *
 * Server callers (API routes) should re-implement this with a
 * service-role client; this version uses the browser session and is
 * meant for the dashboard's client-side export buttons.
 */
export async function shouldExcludeDemoFromExport(firmId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", firmId)
      .eq("is_demo", false);
    return (count || 0) > 0;
  } catch {
    // On error, fail open — include everything rather than swallow real data.
    return false;
  }
}
