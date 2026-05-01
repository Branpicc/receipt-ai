"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getAssignedClientIds } from "@/lib/getAssignedClients";
import { convertHeicToJpg } from "@/lib/convertHeicClient";
import { Upload, X } from "lucide-react";

/**
 * Accountant-only modal for uploading a receipt on behalf of one of their
 * assigned clients. Posts to /api/upload-receipt with the chosen
 * client_id, which already broadcasts a notification to every firm user
 * except the uploader — so the client gets pinged automatically.
 */

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

type Client = { id: string; name: string };

export default function UploadOnBehalfModal({ onClose, onSuccess }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const firmId = await getMyFirmId();
        const ids = await getAssignedClientIds(firmId);
        if (ids === null) {
          // Caller isn't an accountant — modal shouldn't have been opened.
          // Fail closed.
          setError("Upload-on-behalf is for accountants only.");
          return;
        }
        if (ids.length === 0) {
          setError("You have no assigned clients yet. Ask your firm admin to assign one.");
          return;
        }
        const { data, error: clientsErr } = await supabase
          .from("clients")
          .select("id, name")
          .eq("firm_id", firmId)
          .in("id", ids)
          .order("name");
        if (clientsErr) throw clientsErr;
        setClients(data || []);
        if (data && data.length > 0) setSelectedClientId(data[0].id);
      } catch (err) {
        const msg = (err as { message?: string })?.message || "Failed to load clients.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedClientId) {
      setError("Pick a client.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();

      let uploadFile = file;
      try { uploadFile = await convertHeicToJpg(file); } catch { uploadFile = file; }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("firmId", firmId);
      formData.append("clientId", selectedClientId);
      if (user?.id) formData.append("userId", user.id);

      const res = await fetch("/api/upload-receipt", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      onSuccess();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Upload failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full p-6 border border-transparent dark:border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent-600" />
            Upload on behalf of client
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Pick one of your assigned clients and attach a receipt photo or PDF. The client will be notified.
        </p>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading clients…</p>
        ) : clients.length === 0 ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">
            {error || "No assigned clients."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Receipt file
              </label>
              <input
                type="file"
                accept="image/*,application/pdf,.heic,.heif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-700 dark:text-gray-300
                  file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-accent-50 file:text-accent-700
                  hover:file:bg-accent-100"
              />
              {file && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !file || !selectedClientId}
                className="px-6 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 disabled:opacity-50 font-medium transition-colors"
              >
                {submitting ? "Uploading…" : "Upload receipt"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
