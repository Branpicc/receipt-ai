"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.push("/dashboard");
    };
    checkSession();
  }, [router]);

  const signIn = async () => {
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Success ✅ Redirecting...");
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Receipt AI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sign in to your accounting firm dashboard
        </p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border px-4 py-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl border px-4 py-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={signIn}
            className="w-full rounded-xl bg-black text-white py-3 font-medium"
          >
            Sign In
          </button>

          {status && (
            <p className="text-sm text-gray-600 mt-2 break-words">{status}</p>
          )}
        </div>
      </div>
    </main>
  );
}
