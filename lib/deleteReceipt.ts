import { supabase } from "./supabaseClient";

/**
 * Permanently delete a receipt and everything attached to it.
 *
 * Order matters:
 *  1. Pull every receipt_files row so we know which storage blobs to remove.
 *  2. Remove storage blobs (best-effort — a failure here doesn't block the
 *     delete; we'd rather have an orphan blob than a half-deleted DB state).
 *  3. Delete the receipt row. ON DELETE CASCADE on receipt_items /
 *     receipt_taxes / receipt_flags / receipt_edits / receipt_files /
 *     deletion_requests etc. takes care of the rest.
 */
export async function permanentlyDeleteReceipt(receiptId: string): Promise<void> {
  const { data: files } = await supabase
    .from("receipt_files")
    .select("storage_bucket, storage_path")
    .eq("receipt_id", receiptId);

  // Group by bucket so we can issue one remove() call per bucket.
  const byBucket: Record<string, string[]> = {};
  for (const f of files || []) {
    if (!f?.storage_path) continue;
    const bucket = f.storage_bucket || "receipt-files";
    (byBucket[bucket] ||= []).push(f.storage_path);
  }

  // Also include the legacy receipts.file_path blob if it exists outside
  // receipt_files.
  const { data: receiptRow } = await supabase
    .from("receipts")
    .select("file_path")
    .eq("id", receiptId)
    .maybeSingle();
  if (receiptRow?.file_path) {
    const bucket = "receipt-files";
    if (!byBucket[bucket]?.includes(receiptRow.file_path)) {
      (byBucket[bucket] ||= []).push(receiptRow.file_path);
    }
  }

  for (const [bucket, paths] of Object.entries(byBucket)) {
    if (paths.length === 0) continue;
    const { error: storageErr } = await supabase.storage.from(bucket).remove(paths);
    if (storageErr) {
      // Don't abort — orphaned blobs are recoverable, half-deleted records aren't.
      console.warn(`Storage cleanup failed for bucket ${bucket}:`, storageErr.message);
    }
  }

  const { error } = await supabase.from("receipts").delete().eq("id", receiptId);
  if (error) throw error;
}
