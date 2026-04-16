"use client";

import { JSX, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import { categorizeReceipt } from "@/lib/categorizeReceipt";
import { detectLineItemMismatches } from "@/lib/detectLineItemMismatches";
import { getUserRole } from "@/lib/getUserRole";
import RequestChangesModal from "@/components/RequestChangesModal";
import ReceiptEditSection from "@/components/ReceiptEditSection";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  status: string;
  created_at: string;
  purpose_text?: string | null;
  purpose_source?: string | null;
  purpose_updated_at?: string | null;
  firm_id: string;
  client_id: string;
  suggested_category: string | null;
  category_confidence: number | null;
  approved_category: string | null;
  category_reasoning: string | null;
  file_path: string | null;
  folder_id: string | null;
  payment_method?: string | null;
  card_brand?: string | null;
  card_last_four?: string | null;
  card_entry_method?: string | null;
};

type Folder = {
  id: string;
  name: string;
};

type ReceiptFile = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  created_at?: string;
};
type ReceiptItem = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit_price_cents: number | null;
  total_cents: number | null;
};
type ReceiptTax = {
  id: string;
  tax_type: string;
  rate: number | null;
  amount_cents: number | null;
};
type ReceiptFlag = {
  id: string;
  flag_type: string;
  severity: "info" | "warn" | "high";
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export default function ReceiptDetailPage(): JSX.Element {
  const params = useParams();
  const receiptId = (params?.id as string) || "";

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [taxes, setTaxes] = useState<ReceiptTax[]>([]);
  const [purposeDraft, setPurposeDraft] = useState("");
  const [savingPurpose, setSavingPurpose] = useState(false);
  const [flags, setFlags] = useState<ReceiptFlag[]>([]);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingFlag, setResolvingFlag] = useState<ReceiptFlag | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [selectedResolveReason, setSelectedResolveReason] = useState(""); 

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activePreviewType, setActivePreviewType] = useState<'image' | 'pdf'>('image');
  const [splitPdfUrl, setSplitPdfUrl] = useState<string | null>(null);
  const [lineItemsView, setLineItemsView] = useState<'table' | 'card'>('card');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editHistory, setEditHistory] = useState<any[]>([]);

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderSaved, setFolderSaved] = useState(false);

  function purposeLooksLikeMeal(purpose: string) {
    const p = purpose.toLowerCase();
    const mealWords = ["lunch","dinner","breakfast","coffee","meal","restaurant","client meal","food","snack","catering","tim hortons","starbucks"];
    return mealWords.some((w) => p.includes(w));
  }

  function vendorLooksNonFood(vendor: string) {
    const v = vendor.toLowerCase();
    const nonFood = ["staples","canadian tire","home depot","best buy","apple","amazon","walmart","costco","ikea","uber","shell","esso","petro","chevron"];
    return nonFood.some((w) => v.includes(w));
  }

  async function loadEditHistory() {
  const { data } = await supabase
    .from("receipt_edits")
    .select("id, edit_reason, changes, created_at, firm_users(display_name, role)")
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: false });
  setEditHistory(data || []);
}

  async function loadFlags() {
    if (!receiptId) return;
    const { data, error } = await supabase
      .from("receipt_flags")
      .select("id,flag_type,severity,message,created_at,resolved_at")
      .eq("receipt_id", receiptId)
      .order("created_at", { ascending: false });
if (error) { console.warn("Failed to load flags", error.message); return; }
    setFlags((data as ReceiptFlag[]) || []);
  }

  async function loadFolders(firmId: string, clientId: string, role: string) {
    let query = supabase
      .from("receipt_folders")
      .select("id, name")
      .eq("firm_id", firmId)
      .order("created_at", { ascending: true });

    if (role === "client") {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (!error) setFolders((data as Folder[]) || []);
  }

  async function assignFolder() {
    if (!receipt) return;
    setSavingFolder(true);
    setFolderSaved(false);
    try {
      const newFolderId = selectedFolderId === "none" ? null : selectedFolderId || null;
      const { error } = await supabase
        .from("receipts")
        .update({ folder_id: newFolderId })
        .eq("id", receiptId);
      if (error) throw error;
      setReceipt((prev) => prev ? { ...prev, folder_id: newFolderId } : prev);
      setFolderSaved(true);
      setTimeout(() => setFolderSaved(false), 2000);
    } catch (e: any) {
      alert("Failed to assign folder: " + e.message);
    } finally {
      setSavingFolder(false);
    }
  }

  async function ensureMismatchFlag(purposeText: string, vendorText: string) {
    if (!purposeText?.trim() || !vendorText?.trim()) return;
    if (!receipt) return;
    const mismatch = purposeLooksLikeMeal(purposeText) && vendorLooksNonFood(vendorText);
    if (!mismatch) return;
    const { data: existing, error: exErr } = await supabase
      .from("receipt_flags")
      .select("id")
      .eq("receipt_id", receiptId)
      .eq("flag_type", "purpose_vendor_mismatch")
      .is("resolved_at", null)
      .maybeSingle();
    if (exErr && exErr.code !== "PGRST116") throw exErr;
    if (existing?.id) return;
    const message = `Purpose mentions a meal, but vendor looks non-food (${vendorText}). Please confirm category/purpose.`;
    const { error } = await supabase.from("receipt_flags").insert([{
      receipt_id: receiptId,
      firm_id: (receipt as any).firm_id ?? undefined,
      flag_type: "purpose_vendor_mismatch",
      severity: "warn",
      message,
    }]);
    if (error) throw error;
    await loadFlags();
  }

  async function checkRole() {
    const role = await getUserRole();
    setUserRole(role);
  }

  async function checkLineItemMismatches() {
    if (!receipt?.approved_category || items.length === 0) return;
    const validItems = items.filter(item => item.description !== null).map(item => ({ description: item.description as string }));
    if (validItems.length === 0) return;
    const mismatchResult = detectLineItemMismatches(receipt.approved_category, validItems);
    if (mismatchResult.hasMismatch && mismatchResult.flagMessage) {
      const { data: existing } = await supabase.from("receipt_flags").select("id").eq("receipt_id", receiptId).eq("flag_type", "line_item_mismatch").is("resolved_at", null).maybeSingle();
      if (existing?.id) return;
      const { error } = await supabase.from("receipt_flags").insert([{
        receipt_id: receiptId,
        firm_id: receipt.firm_id,
        flag_type: "line_item_mismatch",
        severity: "warn",
        message: mismatchResult.flagMessage,
      }]);
      if (!error) {
        await loadFlags();
        try {
          await supabase.from("notifications").insert([{
            firm_id: receipt.firm_id,
            type: "receipt_flagged",
            title: "Receipt flagged",
            message: `${receipt.vendor || "Receipt"} has mismatched line items`,
            receipt_id: receiptId,
            read: false,
          }]);
        } catch (notifError) {
          console.error("Failed to create notification:", notifError);
        }
      }
    }
  }

  async function splitMismatchedItems(flagId: string) {
    if (!receipt) return;
    try {
      const flag = flags.find(f => f.id === flagId);
      if (!flag || flag.flag_type !== 'line_item_mismatch') return;
      const confirmed = confirm("Split mismatched items into a new receipt?\n\nThis will:\n• Create a new receipt with the mismatched items\n• Update this receipt to exclude those items\n• Recalculate totals and taxes proportionally\n• Auto-categorize the new receipt appropriately\n• Generate a PDF report for CRA documentation");
      if (!confirmed) return;
      const validItems = items.filter(item => item.description !== null);
      const mismatchResult = detectLineItemMismatches(receipt.approved_category || '', validItems.map(item => ({ description: item.description as string })));
      if (!mismatchResult.hasMismatch) { alert("No mismatched items found"); return; }
      const mismatchedDescriptions = mismatchResult.mismatchedItems.map(m => m.description);
      const mismatchedItems = items.filter(item => item.description && mismatchedDescriptions.includes(item.description));
      const remainingItems = items.filter(item => item.description && !mismatchedDescriptions.includes(item.description));
      if (mismatchedItems.length === 0) { alert("No mismatched items to split"); return; }
      const mismatchedSubtotal = mismatchedItems.reduce((sum, item) => sum + (item.total_cents || 0), 0);
      const remainingSubtotal = remainingItems.reduce((sum, item) => sum + (item.total_cents || 0), 0);
      const currentSubtotal = mismatchedSubtotal + remainingSubtotal;
      const totalTax = taxes.reduce((sum, t) => sum + (t.amount_cents || 0), 0);
      const mismatchedTax = currentSubtotal > 0 ? Math.round((mismatchedSubtotal / currentSubtotal) * totalTax) : 0;
      const remainingTax = totalTax - mismatchedTax;
      const mismatchType = mismatchResult.mismatchedItems[0].detectedCategory;
      let newCategory = mismatchType === 'food' ? 'Meals & Entertainment' : mismatchType === 'personal' ? 'Personal (Non-Deductible)' : 'Other Expenses';
      const { data: newReceipt, error: newReceiptError } = await supabase.from("receipts").insert([{
        firm_id: receipt.firm_id,
        client_id: receipt.client_id,
        vendor: receipt.vendor,
        receipt_date: receipt.receipt_date,
        total_cents: mismatchedSubtotal + mismatchedTax,
        currency: 'CAD',
        status: 'needs_review',
        source: 'split',
        file_path: receipt.file_path,
        suggested_category: newCategory,
        category_confidence: 85,
        category_reasoning: `Auto-split from receipt ${receipt.id} due to category mismatch`,
        purpose_text: `Split from ${receipt.vendor} - ${mismatchResult.mismatchedItems.map(m => m.description).join(', ')}`,
      }]).select('id').single();
      if (newReceiptError) throw newReceiptError;
      await supabase.from("receipt_items").insert(mismatchedItems.map((item, index) => ({ receipt_id: newReceipt.id, description: item.description, quantity: item.quantity, unit_price_cents: item.unit_price_cents, total_cents: item.total_cents, line_index: index + 1 })));
      if (mismatchedTax > 0 && taxes.length > 0) {
        await supabase.from("receipt_taxes").insert([{ receipt_id: newReceipt.id, firm_id: receipt.firm_id, tax_type: taxes[0].tax_type, rate: taxes[0].rate, amount_cents: mismatchedTax }]);
      }
      await supabase.from("receipts").update({ total_cents: remainingSubtotal + remainingTax, purpose_text: (receipt.purpose_text || '') + ` (Split: ${mismatchedItems.map(i => i.description).join(', ')} moved to separate receipt)` }).eq("id", receiptId);
      const mismatchedItemIds = mismatchedItems.map(i => i.id).filter(id => !id.startsWith('temp-'));
      if (mismatchedItemIds.length > 0) await supabase.from("receipt_items").delete().in("id", mismatchedItemIds);
      if (remainingItems.length > 0) {
        await supabase.from("receipt_items").delete().eq("receipt_id", receiptId);
        await supabase.from("receipt_items").insert(remainingItems.map((item, index) => ({ receipt_id: receiptId, description: item.description, quantity: item.quantity, unit_price_cents: item.unit_price_cents, total_cents: item.total_cents, line_index: index + 1 })));
      }
      if (remainingTax > 0 && taxes.length > 0) await supabase.from("receipt_taxes").update({ amount_cents: remainingTax }).eq("receipt_id", receiptId);
      try {
        const pdfResponse = await fetch('/api/generate-split-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalReceiptId: receiptId, newReceiptId: newReceipt.id }) });
        if (pdfResponse.ok) {
          const { filePath } = await pdfResponse.json();
          await supabase.from("receipts").update({ purpose_text: (receipt.purpose_text || '') + ` [Split documentation: ${filePath}]` }).eq("id", receiptId);
          await supabase.from("receipts").update({ purpose_text: `Split from ${receipt.vendor} - ${mismatchResult.mismatchedItems.map(m => m.description).join(', ')} [Documentation: ${filePath}]` }).eq("id", newReceipt.id);
        }
      } catch (pdfError) { console.error('PDF generation failed:', pdfError); }
      await supabase.from("receipt_flags").update({ resolved_at: new Date().toISOString() }).eq("id", flagId);
      alert(`✅ Receipt split successfully!\n\nOriginal receipt: $${((remainingSubtotal + remainingTax) / 100).toFixed(2)}\nNew receipt: $${((mismatchedSubtotal + mismatchedTax) / 100).toFixed(2)}\n\nPDF documentation has been generated.\nRedirecting to new receipt...`);
      window.location.href = `/dashboard/receipts/${newReceipt.id}`;
    } catch (error: any) {
      console.error('Split error:', error);
      alert('Failed to split receipt: ' + error.message);
    }
  }

function handleResolveClick(flag: ReceiptFlag) {
  if (flag.flag_type === "personal_card_used" || flag.flag_type === "unrecognized_card") {
    setResolvingFlag(flag);
    setShowResolveModal(true);
    setSelectedResolveReason("");
    setResolveNote("");
  } else {
    resolveFlag(flag.id, "");
  }
}

async function resolveFlag(flagId: string, note: string) {
  try {
    setResolvingFlagId(flagId);
    const { error } = await supabase
      .from("receipt_flags")
      .update({ 
        resolved_at: new Date().toISOString(),
        resolution_note: note || null,
      })
      .eq("id", flagId);
    if (error) {
      console.error("Failed to resolve flag:", error);
      alert("Failed to resolve: " + error.message);
      return;
    }
    await loadFlags();
    setShowResolveModal(false);
    setResolvingFlag(null);
  } finally {
    setResolvingFlagId(null);
  }
}

  const activeFile = useMemo(() => {
    if (!files.length) return null;
    if (!activeFileId) return files[0];
    return files.find((f) => f.id === activeFileId) ?? files[0];
  }, [files, activeFileId]);

useEffect(() => {
    if (!receiptId) return;
        const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select(`id, firm_id, client_id, vendor, receipt_date, total_cents, status, created_at, purpose_text, purpose_source, purpose_updated_at, suggested_category, category_confidence, approved_category, category_reasoning, file_path, folder_id, payment_method, card_brand, card_last_four, card_entry_method`)
          .eq("id", receiptId)
          .single();
        if (rErr) throw rErr;
        setReceipt(r as Receipt);
        setPurposeDraft(r?.purpose_text ?? "");
        setSelectedFolderId(r?.folder_id ?? "none");
        await loadFlags();
        await loadEditHistory();

        const { data: itemRows, error: itemErr } = await supabase.from("receipt_items").select("id,description,quantity,unit_price_cents,total_cents").eq("receipt_id", receiptId).order("id", { ascending: true });
        if (itemErr) throw itemErr;
        setItems((itemRows as ReceiptItem[]) || []);

        const { data: taxRows, error: taxErr } = await supabase.from("receipt_taxes").select("id,tax_type,rate,amount_cents").eq("receipt_id", receiptId).order("id", { ascending: true });
        if (taxErr) throw taxErr;
        setTaxes((taxRows as ReceiptTax[]) || []);

        const { data: fRows, error: fErr } = await supabase.from("receipt_files").select("id,storage_bucket,storage_path,original_filename,mime_type,created_at").eq("receipt_id", receiptId).order("created_at", { ascending: true });
        if (fErr) throw fErr;
        const safeFiles = (fRows || []) as ReceiptFile[];
        setFiles(safeFiles);
        setActiveFileId(safeFiles[0]?.id ?? null);

        if (r?.file_path) {
          setPreviewLoading(true);
          try {
            const { data: signedData, error: signedErr } = await supabase.storage.from("receipt-files").createSignedUrl(r.file_path, 3600);
            if (signedErr) throw signedErr;
            setFileUrl(signedData.signedUrl);
          } catch (imgErr: any) {
            console.error("❌ Failed to load image:", imgErr);
            setErr(imgErr?.message || "Failed to load receipt preview");
          } finally {
            setPreviewLoading(false);
          }
        }

        await checkRole();

        // Load folders after we have firm_id and client_id
        const role = await getUserRole();
        await loadFolders(r.firm_id, r.client_id, role || "");
      } catch (e: any) {
        setErr(e?.message || "Failed to load receipt");
        setReceipt(null);
        setFiles([]);
        setActiveFileId(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [receiptId]);

const isFirmAdmin = userRole === "firm_admin";
  const canEdit = userRole === "accountant" || userRole === "owner" || userRole === "client";

  function exportReceiptCSV() {
    if (!receipt) return;
    const taxTotal = taxes.reduce((sum, t) => sum + (t.amount_cents ?? 0), 0);
    const subtotal = (receipt.total_cents ?? 0) - taxTotal;
    const rows = [
      ["Field", "Value"],
      ["Date", receipt.receipt_date || ""],
      ["Vendor", receipt.vendor || ""],
      ["Description", receipt.purpose_text || ""],
      ["Account", receipt.approved_category || receipt.suggested_category || "Uncategorized"],
      ["Amount", ((receipt.total_cents ?? 0) / 100).toFixed(2)],
      ["Tax Amount", (taxTotal / 100).toFixed(2)],
      ["Subtotal", (subtotal / 100).toFixed(2)],
      ["Payment Method", receipt.payment_method || ""],
      ["Card", receipt.card_brand ? `${receipt.card_brand} ****${receipt.card_last_four}` : ""],
      ["Status", receipt.status || ""],
      ["Receipt ID", receipt.id],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt-${receipt.vendor?.replace(/\s+/g, "-")}-${receipt.receipt_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!receipt?.purpose_text) return;
        if (!receipt?.purpose_text) return;
    const pdfMatch = receipt.purpose_text.match(/\[(?:Split documentation|Documentation): ([^\]]+)\]/);
    if (pdfMatch && pdfMatch[1]) {
      const pdfPath = pdfMatch[1];
      supabase.storage.from('receipt-files').createSignedUrl(pdfPath, 3600).then(({ data, error }) => {
        if (!error && data) setSplitPdfUrl(data.signedUrl);
      });
    }
  }, [receipt?.purpose_text]);

  if (!receiptId) return <div className="p-8 text-red-600">Missing receipt id in URL.</div>;
  if (loading) return <div className="p-8">Loading receipt…</div>;
  if (err && !receipt) return <div className="p-8 text-red-600">{err}</div>;
  if (!receipt) return <div className="p-8 text-red-600">Receipt not found.</div>;

  const amountText = receipt.total_cents != null ? `$${(receipt.total_cents / 100).toFixed(2)} CAD` : "—";
  const taxTotalCents = taxes.reduce((sum, t) => sum + (t.amount_cents ?? 0), 0);
  const taxText = taxes.length === 0 ? "—" : `$${(taxTotalCents / 100).toFixed(2)} CAD`;
  const subtotalCents = receipt.total_cents != null ? receipt.total_cents - taxTotalCents : null;
  const subtotalText = subtotalCents == null ? "—" : `$${(subtotalCents / 100).toFixed(2)} CAD`;

const currentFolderName = folders.find(f => f.id === receipt.folder_id)?.name;
  console.log("Current role:", userRole, "isFirmAdmin:", isFirmAdmin);

  return (
        <main className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-5xl mx-auto">
        <a href="/dashboard/receipts" className="text-sm underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          ← Back to receipts
        </a>

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {receipt.vendor || "Unknown vendor"}
              {isFirmAdmin && (
                <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">(View Only)</span>
              )}
            </h1>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Date: {receipt.receipt_date || "—"} • Status: {receipt.status} • Amount:{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">{amountText}</span>
              {currentFolderName && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 text-xs rounded-full border border-accent-200 dark:border-accent-700">
                  📁 {currentFolderName}
                </span>
              )}
            </div>
          </div>
<div className="flex items-center gap-3">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Created: {new Date(receipt.created_at).toLocaleString()}
            </div>
            <button
              onClick={exportReceiptCSV}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              📥 Export CSV
            </button>
          </div>
                  </div>

        {flags.filter(f => !f.resolved_at).length > 0 && (
          <div className="mt-4 space-y-2">
            {flags.filter(f => !f.resolved_at).map((flag) => (
              <div
                key={flag.id}
                className={`rounded-lg border p-4 ${flag.severity === "high" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : flag.severity === "warn" ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {flag.flag_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{flag.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(flag.created_at).toLocaleString()}</p>
                  </div>
                  <div className="ml-4 flex gap-2">
                    {flag.flag_type === 'line_item_mismatch' && (
                      <button onClick={() => splitMismatchedItems(flag.id)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">
                        Split Items
                      </button>
                    )}
                    
<button onClick={() => handleResolveClick(flag)}
  disabled={resolvingFlagId === flag.id} 
  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 underline"
>
  {resolvingFlagId === flag.id ? "..." : "Resolve"}
</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isFirmAdmin && (
          <div className="mt-4">
            <button onClick={() => setShowRequestModal(true)} className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 font-medium transition-colors">
              📝 Request Changes
            </button>
          </div>
        )}

        {receipt.purpose_text && (
          <div className="mt-4 rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">Purpose</div>
            <div className="mt-1 text-base">{receipt.purpose_text}</div>
            {(receipt.purpose_source || receipt.purpose_updated_at) && (
              <div className="mt-2 text-xs text-gray-400">
                {receipt.purpose_source ? `Source: ${receipt.purpose_source}` : ""}
                {receipt.purpose_source && receipt.purpose_updated_at ? " • " : ""}
                {receipt.purpose_updated_at ? `Updated: ${new Date(receipt.purpose_updated_at).toLocaleString()}` : ""}
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Receipt preview panel — unchanged */}
          <div className="lg:col-span-2 rounded-2xl border overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Receipt preview</div>
                <button
                  onClick={() => {
                    const url = activePreviewType === 'pdf' ? splitPdfUrl : fileUrl;
                    if (url) {
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = activePreviewType === 'pdf'
                        ? `Split-Receipt-${receipt?.vendor?.replace(/\s+/g, '-')}-${receipt?.receipt_date}.pdf`
                        : `Receipt-${receipt?.vendor?.replace(/\s+/g, '-')}-${receipt?.receipt_date}.jpg`;
                      link.click();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                  disabled={!fileUrl && !splitPdfUrl}
                >
                  ⬇ Download
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePreviewType('image')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-gray-900 dark:text-white transition-colors ${activePreviewType === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'}`}
                >
                  Receipt Image
                </button>
                {splitPdfUrl && (
                  <button
                    onClick={() => setActivePreviewType('pdf')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-gray-900 dark:text-white transition-colors ${activePreviewType === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'}`}
                  >
                    📄 Split Documentation
                  </button>
                )}
              </div>
                  {files.length > 0 && activePreviewType === 'image' && (
                  <select className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" value={activeFile?.id ?? ""} onChange={(e) => setActiveFileId(e.target.value)}>
                  {files.map((f, idx) => (
                    <option key={f.id} value={f.id}>{idx + 1}. {f.original_filename || "file"}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="p-4">
              {previewLoading ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading preview...</div>
              ) : activePreviewType === 'pdf' && splitPdfUrl ? (
                <div className="w-full">
                  <iframe src={splitPdfUrl} className="w-full h-[780px] rounded-lg border" title="Split Receipt Documentation" />
                  <div className="mt-3">
                    <a className="text-sm underline text-blue-600 hover:text-blue-800" href={splitPdfUrl} target="_blank" rel="noreferrer">Open PDF in new tab</a>
                  </div>
                </div>
              ) : activePreviewType === 'image' && fileUrl ? (
                <div>
                  <div className="overflow-auto max-h-[780px]">
                    <img src={fileUrl} alt="Receipt" className="w-full object-contain rounded-lg" />
                  </div>
                  <div className="mt-3">
                    <a className="text-sm underline text-blue-600 hover:text-blue-800" href={fileUrl} target="_blank" rel="noreferrer">Open image in new tab</a>
                  </div>
                </div>
              ) : !receipt.file_path && !files.length && !splitPdfUrl ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">No file attached yet (this can happen with sample rows).</div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">No preview available.</div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Details card */}
            <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border font-medium text-gray-900 dark:text-white bg-white dark:bg-dark-surface">Details</div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Vendor</span>
                  <span className="font-medium text-gray-900 dark:text-white">{receipt.vendor || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Receipt date</span>
                  <span className="font-medium text-gray-900 dark:text-white">{receipt.receipt_date || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total</span>
                  <span className="font-medium text-gray-900 dark:text-white">{amountText}</span>
                </div>
<div className="flex items-center justify-between">
  <span className="text-gray-500 dark:text-gray-400">Status</span>
  <span className="font-medium text-gray-900 dark:text-white">{receipt.status}</span>
</div>

{receipt.payment_method && (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 dark:text-gray-400">Payment</span>
    <span className="font-medium text-gray-900 dark:text-white">
      {receipt.card_brand ? `${receipt.card_brand} ` : ""}
      {receipt.payment_method}
      {receipt.card_last_four ? ` ****${receipt.card_last_four}` : ""}
      {receipt.card_entry_method ? ` · ${receipt.card_entry_method}` : ""}
    </span>
  </div>
)}

{/* ── FOLDER ASSIGNMENT ── */}
                <div className="pt-3 border-t border-gray-100 dark:border-dark-border">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📁 Project Folder</div>
                  {folders.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      No folders yet.{" "}
                      <a href="/dashboard/receipts" className="underline text-accent-600 dark:text-accent-400">
                        Create one in Receipts
                      </a>
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                        disabled={isFirmAdmin}
                        className="flex-1 text-xs border border-gray-300 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="none">— No folder —</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>{folder.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={assignFolder}
                        disabled={savingFolder || isFirmAdmin || selectedFolderId === (receipt.folder_id ?? "none")}
                        className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {savingFolder ? "..." : folderSaved ? "✓" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
                {/* ── END FOLDER ASSIGNMENT ── */}

              </div>
            </div>

            {/* Digital receipt card */}
            <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border font-medium text-gray-900 dark:text-white bg-white dark:bg-dark-surface">Digital receipt</div>
              <div className="p-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-gray-500 dark:text-gray-400">Subtotal</div>
                  <div className="text-right text-gray-900 dark:text-white">{subtotalText}</div>
                  <div className="text-gray-500 dark:text-gray-400">Taxes</div>
                  <div className="text-right text-gray-900 dark:text-white">{taxText}</div>
                  <div className="font-medium text-gray-900 dark:text-white">Total</div>
                  <div className="text-right font-medium text-gray-900 dark:text-white">{amountText}</div>
                </div>

                <div className="border-b pb-6">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Expense Category</div>
                  {receipt.approved_category ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800">
                          ✓ Approved: {receipt.approved_category}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (isFirmAdmin) { alert("🔒 Firm admins cannot edit categories."); return; }
                          const { error } = await supabase.from("receipts").update({ approved_category: null, category_approved_by: null, category_approved_at: null }).eq("id", receiptId);
                          if (error) { setErr(error.message); } else { setReceipt((prev) => prev ? { ...prev, approved_category: null } : prev); }
                        }}
                        disabled={isFirmAdmin}
                        className={`text-sm text-gray-600 dark:text-gray-400 underline hover:text-gray-800 ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Change category
                      </button>
                    </div>
) : receipt.suggested_category && receipt.category_confidence ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                          🏷️ Is this the right category?
                        </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${receipt.category_confidence >= 80 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                          {receipt.category_confidence >= 80 ? '✓' : '⚠'} {receipt.suggested_category}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{receipt.category_confidence}% confidence</span>
                      </div>
                                            {receipt.category_reasoning && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
                          <span className="font-medium text-gray-900 dark:text-white">Reasoning:</span> {receipt.category_reasoning}
                        </div>
                      )}
<div className="flex gap-2 mt-3">
                        <button
                          onClick={async () => {
                            if (isFirmAdmin) { alert("🔒 Firm admins cannot approve categories."); return; }
                            try {
                              const { error } = await supabase.from("receipts").update({ approved_category: receipt.suggested_category, category_approved_at: new Date().toISOString() }).eq("id", receiptId);
                              if (error) throw error;
                              setReceipt((prev) => prev ? { ...prev, approved_category: receipt.suggested_category } : prev);
                            } catch (e: any) { setErr(e.message || "Failed to approve category"); }
                          }}
                          disabled={isFirmAdmin}
                          className={`rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          ✓ Approve Category
                        </button>
                        <button
                          onClick={() => {
                            if (isFirmAdmin) { alert("🔒 Firm admins cannot change categories."); return; }
                            const newCategory = prompt("Enter category name:");
                            if (!newCategory) return;
                            supabase.from("receipts").update({ approved_category: newCategory, category_approved_at: new Date().toISOString() }).eq("id", receiptId).then(({ error }) => {
                              if (error) { setErr(error.message); } else { setReceipt((prev) => prev ? { ...prev, approved_category: newCategory } : prev); }
                            });
                          }}
                          disabled={isFirmAdmin}
                          className={`rounded-lg border border-gray-300 dark:border-dark-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:bg-dark-hover ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          ✏️ Change
                        </button>
                      </div>
                      </div>
                    </div>
                  ) : (
                                        <div className="space-y-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        ⚠ Unable to auto-categorize. Please add vendor and purpose information.
                      </div>
                      <button
                        onClick={() => {
                          if (isFirmAdmin) { alert("🔒 Firm admins cannot set categories."); return; }
                          const newCategory = prompt("Enter category name:");
                          if (!newCategory) return;
                          supabase.from("receipts").update({ approved_category: newCategory, category_approved_at: new Date().toISOString() }).eq("id", receiptId).then(({ error }) => {
                            if (error) { setErr(error.message); } else { setReceipt((prev) => prev ? { ...prev, approved_category: newCategory } : prev); }
                          });
                        }}
                        disabled={isFirmAdmin}
                        className={`rounded-lg bg-accent-500 text-white px-4 py-2 text-sm font-medium hover:bg-accent-600 ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Manually Set Category
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const result = categorizeReceipt(receipt.vendor || "", receipt.purpose_text || "");
                            const { error } = await supabase.from("receipts").update({ suggested_category: result.suggested_category, category_confidence: result.category_confidence, category_reasoning: result.category_reasoning }).eq("id", receiptId);
                            if (error) throw error;
                            window.location.reload();
                          } catch (e: any) { setErr(e.message); }
                        }}
                        className="mt-3 text-xs text-gray-500 dark:text-gray-400 underline"
                      >
                        🔄 Re-run categorization (test)
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">Line Items</div>
                    <div className="flex gap-2">
                      {items.length > 0 && (
                        <div className="flex rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
                          <button onClick={() => setLineItemsView('table')} className={`px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white transition-colors ${lineItemsView === 'table' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-dark-hover'}`}>📋 Table</button>
                          <button onClick={() => setLineItemsView('card')} className={`px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white transition-colors ${lineItemsView === 'card' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-dark-hover'}`}>📄 Cards</button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (isFirmAdmin) { alert("🔒 Firm admins cannot edit line items."); return; }
                          setItems([...items, { id: `temp-${Date.now()}`, description: "", quantity: 1, unit_price_cents: 0, total_cents: 0 }]);
                          setLineItemsView('table');
                        }}
                        disabled={isFirmAdmin}
                        className={`text-sm rounded-lg border border-gray-300 dark:border-dark-border px-4 py-2 hover:bg-gray-50 dark:bg-dark-hover font-medium ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-hover rounded-lg p-4 text-center">No line items yet. Click "Add Item" to add one.</div>
                  ) : lineItemsView === 'card' ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {items.map((item, idx) => (
                          <div key={`${item.id}-${idx}`} className="border rounded-lg p-4 bg-white dark:bg-dark-surface hover:bg-gray-50 dark:bg-dark-hover transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white mb-1">{item.description || "Untitled Item"}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity || 1} × ${((item.unit_price_cents || 0) / 100).toFixed(2)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900 dark:text-white">${((item.total_cents || 0) / 100).toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Items Subtotal:</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">${(items.reduce((sum, item) => sum + (item.total_cents || 0), 0) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                      <button onClick={() => setLineItemsView('table')} className="w-full mt-2 rounded-lg border border-gray-300 dark:border-dark-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:bg-dark-hover">✏️ Edit Items</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full">
                          <thead className="bg-gray-100 dark:bg-dark-border border-b-2">
                            <tr>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white text-base">Description</th>
                              <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white text-base w-32">Qty</th>
                              <th className="text-right py-4 px-4 font-semibold text-gray-900 dark:text-white text-base w-40">Unit Price</th>
                              <th className="text-right py-4 px-4 font-semibold text-gray-900 dark:text-white text-base w-40">Total</th>
                              <th className="w-20"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                            {items.map((item, idx) => (
                              <tr key={`${item.id}-${idx}`}>
                                <td className="py-4 px-4">
                                  <input type="text" className="w-full rounded-lg border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3 text-lg text-gray-900 dark:text-white font-medium" value={item.description || ""} onChange={(e) => { const updated = [...items]; updated[idx].description = e.target.value; setItems(updated); }} placeholder="Item description" />
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => { const updated = [...items]; const newQty = Math.max(1, (updated[idx].quantity ?? 1) - 1); updated[idx].quantity = newQty; updated[idx].total_cents = newQty * (updated[idx].unit_price_cents ?? 0); setItems(updated); }} className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">−</button>
                                    <span className="text-xl font-bold text-gray-900 dark:text-white w-12 text-center">{item.quantity ?? 1}</span>
                                    <button onClick={() => { const updated = [...items]; const newQty = (updated[idx].quantity ?? 1) + 1; updated[idx].quantity = newQty; updated[idx].total_cents = newQty * (updated[idx].unit_price_cents ?? 0); setItems(updated); }} className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">+</button>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-900 dark:text-white text-xl font-bold">$</span>
                                    <input type="text" className="flex-1 rounded-lg border-2 border-gray-300 dark:border-dark-border px-4 py-3 text-xl text-right text-gray-900 dark:text-white font-bold" defaultValue={((item.unit_price_cents ?? 0) / 100).toFixed(2)} onBlur={(e) => { const updated = [...items]; const value = e.target.value.replace(/[^0-9.]/g, ''); const cents = Math.round(parseFloat(value || "0") * 100); updated[idx].unit_price_cents = cents; updated[idx].total_cents = (updated[idx].quantity ?? 0) * cents; setItems(updated); }} placeholder="0.00" />
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-right"><span className="text-2xl font-bold text-gray-900 dark:text-white">${((item.total_cents ?? 0) / 100).toFixed(2)}</span></td>
                                <td className="py-4 px-4 text-center"><button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-800 font-bold text-2xl px-3" title="Delete">✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={async () => {
                          if (isFirmAdmin) { alert("🔒 Firm admins cannot save line items."); return; }
                          try {
                            setErr("");
                            await supabase.from("receipt_items").delete().eq("receipt_id", receiptId);
                            const itemsToSave = items.filter((it) => it.description?.trim()).map((it, index) => ({ receipt_id: receiptId, description: it.description, quantity: it.quantity, unit_price_cents: it.unit_price_cents, total_cents: it.total_cents, line_index: index + 1 }));
                            if (itemsToSave.length > 0) { const { error } = await supabase.from("receipt_items").insert(itemsToSave); if (error) throw error; }
                            const { data: reloaded } = await supabase.from("receipt_items").select("id,description,quantity,unit_price_cents,total_cents").eq("receipt_id", receiptId).order("id", { ascending: true });
                            setItems((reloaded as ReceiptItem[]) || []);
                            await checkLineItemMismatches();
                            alert("Line items saved!");
                          } catch (e: any) { setErr(e.message || "Failed to save items"); }
                        }}
                        disabled={isFirmAdmin}
                        className={`rounded-lg bg-accent-500 text-white px-6 py-2 font-medium text-sm hover:bg-accent-600 ${isFirmAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Save Items
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Purpose of expense</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">Source: {receipt.purpose_source || "—"}</div>
                  </div>
                  <textarea className="w-full rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-white p-3 text-sm" rows={3} placeholder="Example: Lunch meeting with client to discuss project scope." value={purposeDraft} onChange={(e) => !isFirmAdmin && setPurposeDraft(e.target.value)} disabled={isFirmAdmin} />
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={savingPurpose || isFirmAdmin}
                      className={`rounded-xl bg-accent-500 text-white px-4 py-2 text-sm disabled:opacity-60 ${isFirmAdmin ? 'cursor-not-allowed' : ''}`}
                      onClick={async () => {
                        if (isFirmAdmin) { alert("🔒 Firm admins cannot edit purpose."); return; }
                        try {
                          setSavingPurpose(true);
                          setErr("");
                          const { error } = await supabase.from("receipts").update({ purpose_text: purposeDraft.trim() || null, purpose_source: "accountant", purpose_updated_at: new Date().toISOString() }).eq("id", receipt.id);
                          if (error) throw error;
                          setReceipt((prev) => prev ? { ...prev, purpose_text: purposeDraft.trim() || null, purpose_source: "accountant", purpose_updated_at: new Date().toISOString() } : prev);
                          await ensureMismatchFlag(purposeDraft.trim(), receipt.vendor || "");
                          const categorization = categorizeReceipt(receipt.vendor || "", purposeDraft.trim() || "");
                          await supabase.from("receipts").update({ suggested_category: categorization.suggested_category, category_confidence: categorization.category_confidence, category_reasoning: categorization.category_reasoning }).eq("id", receipt.id);
                          setReceipt((prev) => prev ? { ...prev, suggested_category: categorization.suggested_category, category_confidence: categorization.category_confidence, category_reasoning: categorization.category_reasoning } : prev);
                        } catch (e: any) { setErr(e.message || "Failed to save purpose"); } finally { setSavingPurpose(false); }
                      }}
                    >
                      {isFirmAdmin ? "View Only" : "Save purpose"}
                    </button>
                    <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => setPurposeDraft(receipt.purpose_text || "")}>Reset</button>
                  </div>
                  {receipt.purpose_updated_at && (
                    <div className="mt-2 text-xs text-gray-400">Updated: {new Date(receipt.purpose_updated_at).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-6 rounded-2xl border overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border font-medium text-gray-900 dark:text-white bg-white dark:bg-dark-surface">Attached files ({files.length})</div>
            <div className="divide-y divide-gray-200 dark:divide-dark-border">
              {files.map((f) => (
                <button key={f.id} onClick={() => setActiveFileId(f.id)} className={`w-full text-left p-4 text-sm hover:bg-gray-50 dark:hover:bg-dark-hover ${activeFile?.id === f.id ? "bg-gray-50 dark:bg-dark-hover" : ""}`}>
                  <div className="font-medium">{f.original_filename || "file"}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{f.mime_type || "unknown type"}{f.created_at ? ` • ${new Date(f.created_at).toLocaleString()}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

<ReceiptEditSection
          receipt={receipt}
          taxes={taxes}
          onSaved={() => window.location.reload()}
        />

        {editHistory.length > 0 && (
          <div className="mt-4 rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border font-medium text-gray-900 dark:text-white">
              📝 Edit History ({editHistory.length})
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {editHistory.map((edit) => (
                <div key={edit.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {edit.edit_reason}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(edit.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(edit.changes || {}).map(([field, val]: [string, any]) => (
                      <div key={field} className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium capitalize">{field.replace("_", " ")}:</span>{" "}
                        <span className="text-red-500 line-through">{val.before}</span>{" "}
                        <span className="text-green-600">→ {val.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
{showResolveModal && resolvingFlag && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Resolve Flag
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {resolvingFlag.flag_type === "personal_card_used"
          ? "Why was a personal card used for this business expense?"
          : "Why is this unrecognized card acceptable for this expense?"}
      </p>

      <div className="space-y-2 mb-4">
        {[
          "Client reimbursement — will be paid back",
          "Business card was unavailable",
          "Mixed purchase — partially personal",
          "This is a business card — adding it to my cards",
          "One-time exception",
          "Other",
        ].map((reason) => (
          <button
            key={reason}
            onClick={() => setSelectedResolveReason(reason)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
              selectedResolveReason === reason
                ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300"
                : "border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover"
            }`}
          >
            {reason}
          </button>
        ))}
      </div>

      {selectedResolveReason === "Other" && (
        <textarea
          value={resolveNote}
          onChange={(e) => setResolveNote(e.target.value)}
          placeholder="Describe the reason..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white mb-4"
        />
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => {
            setShowResolveModal(false);
            setResolvingFlag(null);
          }}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const note = selectedResolveReason === "Other" ? resolveNote : selectedResolveReason;
            if (!note.trim()) { alert("Please select a reason."); return; }
            resolveFlag(resolvingFlag.id, note);
          }}
          disabled={!selectedResolveReason || (selectedResolveReason === "Other" && !resolveNote.trim())}
          className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Confirm & Resolve
        </button>
      </div>
    </div>
  </div>
)}

      {showRequestModal && (
                <RequestChangesModal receiptId={receiptId} onClose={() => setShowRequestModal(false)} onSuccess={() => { setShowRequestModal(false); alert("✅ Change request sent to accountant!"); }} />
      )}
    </main>
  );
}