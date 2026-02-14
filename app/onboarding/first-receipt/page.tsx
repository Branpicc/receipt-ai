"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

export default function FirstReceiptPage() {
  const router = useRouter();
  const [firmId, setFirmId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const id = await getMyFirmId();
      setFirmId(id);

      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("firm_id", id)
        .limit(1);

      if (clients && clients.length > 0) {
        setClientId(clients[0].id);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }

  function skipToast() {
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Step 3 of 3</span>
            <span>100%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div className="h-2 bg-black rounded-full" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            You're All Set! 🎉
          </h1>
          <p className="text-gray-600 mb-8">
            Your firm is ready. Here's how to start processing receipts:
          </p>

          <div className="space-y-6 mb-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Upload Receipts</h3>
                <p className="text-sm text-gray-600">
                  Drag and drop or click to upload receipt images
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Email Receipts</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Or email receipts directly to your unique address:
                </p>
                {clientId && (
                  <code className="px-3 py-2 bg-gray-100 rounded text-sm">
                    receipts-{clientId}@yourapp.com
                  </code>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">AI Does the Work</h3>
                <p className="text-sm text-gray-600">
                  Our AI extracts data, categorizes expenses, and prepares for export
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={skipToast}
            className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}