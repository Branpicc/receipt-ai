"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    loadClientInfo();
  }, []);

  async function loadClientInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (firmUser?.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", firmUser.client_id)
          .single();

        if (client) {
          setClientName(client.name);
        }
      }
    } catch (error) {
      console.error("Failed to load client info:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Welcome, {clientName || "Client"}!
      </h1>

      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
        <p className="text-gray-600 dark:text-gray-400">
          Client dashboard coming soon! For now, you can:
        </p>
        <ul className="mt-4 space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300">
          <li>Upload receipts using the + button</li>
          <li>View your receipts in the Receipts page</li>
          <li>Set budgets in Spending Budget</li>
        </ul>
      </div>
    </div>
  );
}