"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  status: string;
  created_at: string;
  approved_category: string | null;
  suggested_category: string | null;
  folder_id: string | null;
  has_flags?: boolean;
};

type Folder = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  receipt_count?: number;
};

type StatusFilter = "all" | "needs_review" | "categorized" | "uncategorized" | "flagged";
type DateFilter = "any" | "this_week" | "this_month" | "this_year" | "custom";
type MainView = "receipts" | "folders";

function getDateRange(filter: DateFilter, customStart?: string, customEnd?: string) {
  const now = new Date();
  switch (filter) {
    case "this_week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "custom":
      return {
        start: customStart ? new Date(customStart).toISOString() : undefined,
        end: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined,
      };
    default:
      return { start: undefined, end: undefined };
  }
}

export default function ReceiptsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Main view: receipt list vs folder list
  const [mainView, setMainView] = useState<MainView>("receipts");

  // When inside a folder
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderName, setActiveFolderName] = useState<string>("");

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Date filter
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [dateSearchType, setDateSearchType] = useState<"receipt_date" | "created_at">("receipt_date");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Folder management
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // Read status from URL on mount
  useEffect(() => {
    const status = searchParams.get("status") as StatusFilter | null;
    if (status) setStatusFilter(status);
  }, [searchParams]);

  // Load user profile once
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("firm_users")
        .select("firm_id, client_id, role")
        .eq("auth_user_id", user.id)
        .single();

      if (profile?.firm_id) {
        setFirmId(profile.firm_id);
        setClientId(profile.client_id ?? null);
        setUserRole(profile.role);
      }
    }
    loadProfile();
  }, []);

  // Reload receipts when filters change
  useEffect(() => {
    if (firmId) loadReceipts();
  }, [firmId, statusFilter, dateFilter, customStart, customEnd, dateSearchType, activeFolderId]);

  // Load folders when switching to folder view
  useEffect(() => {
    if (firmId && mainView === "folders" && !activeFolderId) loadFolders();
  }, [firmId, mainView, activeFolderId]);

  async function loadReceipts() {
    setLoading(true);
    try {
      if (!firmId) return;

      let query = supabase
        .from("receipts")
        .select("id, vendor, receipt_date, total_cents, status, created_at, approved_category, suggested_category, folder_id")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      if (userRole === "client" && clientId) {
        query = query.eq("client_id", clientId);
      }

      // Filter to folder if inside one
      if (activeFolderId) {
        query = query.eq("folder_id", activeFolderId);
      }

      // Date filter
      const { start, end } = getDateRange(dateFilter, customStart, customEnd);
      if (start) query = query.gte(dateSearchType, start);
      if (end) query = query.lte(dateSearchType, end);

      const { data: receiptsData, error } = await query;
      if (error) throw error;

      // Flags
      const { data: flagsData } = await supabase
        .from("receipt_flags")
        .select("receipt_id")
        .eq("firm_id", firmId)
        .is("resolved_at", null);

      const flaggedIds = new Set(flagsData?.map((f) => f.receipt_id) || []);
      const withFlags = (receiptsData || []).map((r) => ({
        ...r,
        has_flags: flaggedIds.has(r.id),
      }));

      // Status filter
      let filtered = withFlags;
      switch (statusFilter) {
        case "needs_review": filtered = withFlags.filter((r) => !r.approved_category || r.has_flags); break;
        case "categorized": filtered = withFlags.filter((r) => r.approved_category); break;
        case "uncategorized": filtered = withFlags.filter((r) => !r.approved_category); break;
        case "flagged": filtered = withFlags.filter((r) => r.has_flags); break;
      }

      setReceipts(filtered);
    } catch (err) {
      console.error("Load receipts error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders() {
    if (!firmId) return;
    try {
      let query = supabase
        .from("receipt_folders")
        .select("id, name, description, created_at")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: true });

      if (userRole === "client" && clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Count receipts per folder
      const withCounts = await Promise.all(
        (data || []).map(async (folder) => {
          let countQuery = supabase
            .from("receipts")
            .select("*", { count: "exact", head: true })
            .eq("firm_id", firmId)
            .eq("folder_id", folder.id);
          if (userRole === "client" && clientId) {
            countQuery = countQuery.eq("client_id", clientId);
          }
          const { count } = await countQuery;
          return { ...folder, receipt_count: count || 0 };
        })
      );

      setFolders(withCounts);
    } catch (err) {
      console.error("Load folders error:", err);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim() || !firmId) return;
    setSavingFolder(true);
    try {
      const insertData: any = {
        name: newFolderName.trim(),
        description: newFolderDesc.trim() || null,
        firm_id: firmId,
      };
      if (userRole === "client" && clientId) {
        insertData.client_id = clientId;
      }
      const { error } = await supabase.from("receipt_folders").insert(insertData);
      if (error) throw error;
      setNewFolderName("");
      setNewFolderDesc("");
      setShowNewFolderModal(false);
      await loadFolders();
    } catch (err: any) {
      alert("Failed to create folder: " + err.message);
    } finally {
      setSavingFolder(false);
    }
  }

  async function updateFolder() {
    if (!editingFolder || !editingFolder.name.trim()) return;
    setSavingFolder(true);
    try {
      const { error } = await supabase
        .from("receipt_folders")
        .update({ name: editingFolder.name.trim(), description: editingFolder.description || null })
        .eq("id", editingFolder.id);
      if (error) throw error;
      setEditingFolder(null);
      await loadFolders();
    } catch (err: any) {
      alert("Failed to update folder: " + err.message);
    } finally {
      setSavingFolder(false);
    }
  }

  async function deleteFolder(folderId: string) {
    if (!confirm("Delete this folder? Receipts inside will not be deleted — they'll become unassigned.")) return;
    setDeletingFolderId(folderId);
    try {
      await supabase.from("receipts").update({ folder_id: null }).eq("folder_id", folderId);
      const { error } = await supabase.from("receipt_folders").delete().eq("id", folderId);
      if (error) throw error;
      await loadFolders();
    } catch (err: any) {
      alert("Failed to delete folder: " + err.message);
    } finally {
      setDeletingFolderId(null);
    }
  }

  function openFolder(folder: Folder) {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.name);
    setStatusFilter("all");
    setDateFilter("any");
  }

  function exitFolder() {
    setActiveFolderId(null);
    setActiveFolderName("");
    setStatusFilter("all");
    setDateFilter("any");
  }

  function handleDateFilterChange(value: DateFilter) {
    setDateFilter(value);
    setShowCustomRange(value === "custom");
    if (value !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
  }

  const statusButtons: { label: string; value: StatusFilter; icon: string }[] = [
    { label: "All", value: "all", icon: "📋" },
    { label: "Needs Review", value: "needs_review", icon: "⚠️" },
    { label: "Categorized", value: "categorized", icon: "✅" },
    { label: "Uncategorized", value: "uncategorized", icon: "❓" },
    { label: "Flagged", value: "flagged", icon: "🚩" },
  ];

  const dateButtons: { label: string; value: DateFilter }[] = [
    { label: "Any Time", value: "any" },
    { label: "This Week", value: "this_week" },
    { label: "This Month", value: "this_month" },
    { label: "This Year", value: "this_year" },
    { label: "Custom", value: "custom" },
  ];

  // Shared filters bar — used in receipt list view AND inside folders
  const FiltersBar = () => (
    <div className="space-y-3 mb-6">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Date:</span>
        {dateButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => handleDateFilterChange(btn.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              dateFilter === btn.value
                ? "bg-accent-500 text-white"
                : "bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover border border-transparent dark:border-dark-border"
            }`}
          >
            {btn.label}
          </button>
        ))}

        {/* Receipt date vs submitted date toggle */}
        {dateFilter !== "any" && (
          <div className="ml-2 flex items-center gap-1 bg-gray-100 dark:bg-dark-surface rounded-lg p-1 border dark:border-dark-border">
            <button
              onClick={() => setDateSearchType("receipt_date")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                dateSearchType === "receipt_date"
                  ? "bg-white dark:bg-dark-hover shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Receipt Date
            </button>
            <button
              onClick={() => setDateSearchType("created_at")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                dateSearchType === "created_at"
                  ? "bg-white dark:bg-dark-hover shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Date Submitted
            </button>
          </div>
        )}
      </div>

      {/* Custom date range pickers */}
      {showCustomRange && (
        <div className="flex flex-wrap items-center gap-3 pl-1">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs border border-gray-300 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs border border-gray-300 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Status:</span>
        {statusButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setStatusFilter(btn.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === btn.value
                ? "bg-accent-500 text-white"
                : "bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover border border-transparent dark:border-dark-border"
            }`}
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Shared receipt grid
  const ReceiptGrid = () => (
    <>
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading receipts...</div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border">
          <p className="text-gray-500 dark:text-gray-400">
            {activeFolderId
              ? "No receipts in this folder yet."
              : dateFilter !== "any"
              ? "No receipts found for the selected date range."
              : statusFilter === "all"
              ? "No receipts yet. Upload your first receipt to get started!"
              : `No ${statusFilter.replace("_", " ")} receipts found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receipts.map((receipt) => (
            <Link
              key={receipt.id}
              href={`/dashboard/receipts/${receipt.id}`}
              className="block p-4 rounded-xl border border-gray-200 dark:border-dark-border hover:shadow-md dark:hover:shadow-xl transition-all bg-white dark:bg-dark-surface hover:border-accent-500 dark:hover:border-accent-500"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {receipt.vendor || "Unknown vendor"}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {receipt.receipt_date || "No date"}
                  </div>
                </div>
                {receipt.has_flags && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full font-medium">
                    🚩 Flagged
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${((receipt.total_cents || 0) / 100).toFixed(2)}
                </div>
                {receipt.approved_category ? (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full font-medium">
                    ✓ {receipt.approved_category}
                  </span>
                ) : receipt.suggested_category ? (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                    → {receipt.suggested_category}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full font-medium">
                    Uncategorized
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Receipts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activeFolderId
                ? `${receipts.length} receipt${receipts.length !== 1 ? "s" : ""} in "${activeFolderName}"`
                : mainView === "receipts"
                ? `${receipts.length} ${statusFilter === "all" ? "total" : statusFilter.replace("_", " ")} receipt${receipts.length !== 1 ? "s" : ""}`
                : `${folders.length} folder${folders.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Main view tabs — hidden when inside a folder */}
        {!activeFolderId && (
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-dark-surface p-1 rounded-xl w-fit border dark:border-dark-border">
            <button
              onClick={() => setMainView("receipts")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                mainView === "receipts"
                  ? "bg-white dark:bg-dark-hover shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              📋 All Receipts
            </button>
            <button
              onClick={() => { setMainView("folders"); loadFolders(); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                mainView === "folders"
                  ? "bg-white dark:bg-dark-hover shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              📁 Folders
            </button>
          </div>
        )}

        {/* ── ALL RECEIPTS VIEW ── */}
        {mainView === "receipts" && !activeFolderId && (
          <>
            <FiltersBar />
            <ReceiptGrid />
          </>
        )}

        {/* ── FOLDERS LIST VIEW ── */}
        {mainView === "folders" && !activeFolderId && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Organize receipts into project folders
              </p>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + New Folder
              </button>
            </div>

            {folders.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-border">
                <div className="text-5xl mb-4">📁</div>
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No folders yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  Create a folder to organize receipts by project or category
                </p>
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  + Create First Folder
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 hover:border-accent-500 dark:hover:border-accent-500 hover:shadow-md transition-all group"
                  >
                    <div className="cursor-pointer" onClick={() => openFolder(folder)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-3xl">📁</div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-hover px-2 py-1 rounded-full">
                          {folder.receipt_count} receipt{folder.receipt_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                        {folder.name}
                      </h3>
                      {folder.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {folder.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-dark-border">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingFolder({ ...folder }); }}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        ✏️ Rename
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                        disabled={deletingFolderId === folder.id}
                        className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors ml-auto"
                      >
                        {deletingFolderId === folder.id ? "Deleting..." : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── INSIDE A FOLDER ── */}
        {activeFolderId && (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5 text-sm">
              <button
                onClick={exitFolder}
                className="text-accent-600 dark:text-accent-400 hover:underline font-medium"
              >
                📁 Folders
              </button>
              <span className="text-gray-400 dark:text-gray-500">/</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{activeFolderName}</span>
            </div>
            <FiltersBar />
            <ReceiptGrid />
          </>
        )}

        {/* ── NEW FOLDER MODAL ── */}
        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Folder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Folder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Bathroom Reno, Office Supplies Q1"
                    className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    placeholder="Brief description of this folder"
                    className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowNewFolderModal(false); setNewFolderName(""); setNewFolderDesc(""); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  disabled={savingFolder || !newFolderName.trim()}
                  className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingFolder ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT FOLDER MODAL ── */}
        {editingFolder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Folder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={editingFolder.name}
                    onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                    className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingFolder.description || ""}
                    onChange={(e) => setEditingFolder({ ...editingFolder, description: e.target.value })}
                    className="w-full border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingFolder(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateFolder}
                  disabled={savingFolder || !editingFolder.name.trim()}
                  className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingFolder ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}