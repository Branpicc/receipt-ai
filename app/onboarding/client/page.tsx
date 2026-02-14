"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

export default function ClientSetupPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firmId, setFirmId] = useState<string | null>(null);

  useEffect(() => {
    loadFirm();
  }, []);

  async function loadFirm() {
    try {
      const id = await getMyFirmId();
      setFirmId(id);
    } catch (err) {
      router.push("/onboarding/firm");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!clientName.trim()) {
      setError("Client name is required");
      return;
    }

    if (!firmId) {
      setError("Firm not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: clientError } = await supabase
        .from("clients")
        .insert([{
          firm_id: firmId,
          name: clientName.trim(),
        }]);

      if (clientError) throw clientError;

      router.push("/onboarding/first-receipt");
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Step 2 of 3</span>
            <span>66%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div className="h-2 bg-black rounded-full" style={{ width: "66%" }} />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Add Your First Client 👤
          </h1>
          <p className="text-gray-600 mb-8">
            You'll organize receipts by client. Add at least one to get started.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., John's Pizza Shop"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !clientName.trim()}
              className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Continue →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}