"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Invitation = {
  id: string;
  firm_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  firm_name: string;
  client_id?: string;
  assigned_accountant_id?: string; 
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  async function loadInvitation() {
    try {
      setLoading(true);

const { data: invite, error: inviteError } = await supabase
  .from("invitations")
.select(`
    id, 
    firm_id, 
    email, 
    role, 
    status, 
    expires_at, 
    client_id, 
    assigned_accountant_id,
    firm_name
  `)
    .eq("token", token)
  .single();

  console.log('🔍 Invite data:', invite);

      if (inviteError || !invite) {
        setError("Invalid or expired invitation");
        setLoading(false);
        return;
      }

      if (invite.status === "accepted") {
        setError("This invitation has already been accepted");
        setLoading(false);
        return;
      }

      if (new Date(invite.expires_at) < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

setInvitation({
  ...invite,
  firm_name: (invite as any).firm_name || "Your Accounting Firm",
});
    } catch (err: any) {
      setError("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  }

async function handleAccept(e: React.FormEvent) {
  e.preventDefault();
  
  if (!invitation) return;

  if (password.length < 6) {
    setError("Password must be at least 6 characters");
    return;
  }

  if (password !== confirmPassword) {
    setError("Passwords do not match");
    return;
  }

  if (!displayName.trim()) {
    setError("Display name is required");
    return;
  }

  try {
    setAccepting(true);
    setError("");

    // Call API route to accept invitation
    const response = await fetch("/api/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        email: invitation.email,
        password: password,
        displayName: displayName.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to accept invitation");
    }

    alert(`✅ Welcome to ${invitation.firm_name}! You can now log in.`);
    router.push("/login");
  } catch (err: any) {
    console.error("Accept error:", err);
    setError(err.message || "Failed to accept invitation");
  } finally {
    setAccepting(false);
  }
}

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <p className="text-gray-500 dark:text-gray-400">Loading invitation...</p>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-surface rounded-xl shadow-lg p-8 border border-transparent dark:border-dark-border text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Invitation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 font-medium transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-surface rounded-xl shadow-lg p-8 border border-transparent dark:border-dark-border">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You&apos;re Invited!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Join <strong>{invitation?.firm_name}</strong> as a{" "}
            <strong>{invitation?.role}</strong>
          </p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={invitation?.email || ""}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={accepting}
            className="w-full px-6 py-3 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 font-medium transition-colors"
          >
            {accepting ? "Creating Account..." : "Accept Invitation"}
          </button>
        </form>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
          This invitation expires on{" "}
          {invitation && new Date(invitation.expires_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}