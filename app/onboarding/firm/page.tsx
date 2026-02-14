"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FirmSetupPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!firmName.trim()) {
      setError("Firm name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create firm
      const { data: firm, error: firmError } = await supabase
        .from("firms")
        .insert([{ name: firmName.trim() }])
        .select()
        .single();

      if (firmError) throw firmError;

      // Link user to firm
      const { error: linkError } = await supabase
        .from("firm_users")
        .insert([{
          firm_id: firm.id,
          user_id: user.id,
          role: "owner",
        }]);

      if (linkError) throw linkError;

      // Move to next step
      router.push("/onboarding/client");
    } catch (err: any) {
      setError(err.message || "Failed to create firm");
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
            <span>Step 1 of 3</span>
            <span>33%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div className="h-2 bg-black rounded-full" style={{ width: "33%" }} />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to ReceiptAI! 👋
          </h1>
          <p className="text-gray-600 mb-8">
            Let's get your accounting firm set up. First, what's your firm name?
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Firm Name
              </label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="e.g., Smith & Associates"
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
              disabled={loading || !firmName.trim()}
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