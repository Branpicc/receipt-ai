"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/");
        return;
      }

      setEmail(data.session.user.email ?? "");
    };

    load();
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>

          <button
            onClick={signOut}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 rounded-2xl border p-6">
          <p className="text-sm text-gray-500">Signed in as:</p>
          <p className="text-lg font-medium">{email}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border p-5">
            <p className="text-sm text-gray-500">Clients</p>
            <p className="text-2xl font-semibold mt-1">0</p>
            <p className="text-xs text-gray-500 mt-2">
              Next: add Firm → Clients table
            </p>
          </div>

          <div className="rounded-2xl border p-5">
            <p className="text-sm text-gray-500">Receipts (30d)</p>
            <p className="text-2xl font-semibold mt-1">0</p>
            <p className="text-xs text-gray-500 mt-2">
              Next: receipt ingestion
            </p>
          </div>

          <div className="rounded-2xl border p-5">
            <p className="text-sm text-gray-500">Needs Review</p>
            <p className="text-2xl font-semibold mt-1">0</p>
            <p className="text-xs text-gray-500 mt-2">
              Next: triage (Green/Yellow/Red)
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
