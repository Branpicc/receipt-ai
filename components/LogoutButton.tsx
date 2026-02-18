"use client";

import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Failed to log out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className || "text-sm text-gray-600 hover:text-gray-900 underline"}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
