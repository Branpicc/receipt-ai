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
        .select("id, firm_id, email, role, status, expires_at")
        .eq("token", token)
        .single();

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

      const { data: firm } = await supabase
        .from("firms")
        .select("name")
        .eq("id", invite.firm_id)
        .single();

      setInvitation({
        ...invite,
        firm_name: firm?.name || "Unknown Firm",
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

      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
      });

      if (signupError) throw signupError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      const { error: firmUserError } = await supabase
        .from("firm_users")
        .insert([
          {
            firm_id: invitation.firm_id,
            auth_user_id: authData.user.id,
            role: invitation.role,
            display_name: displayName.trim(),
          },
        ]);

      if (firmUserError) {
        console.error("Failed to add to firm:", firmUserError);
        throw new Error("Failed to join firm");
      }

      const { error: updateError } = await supabase
        .from("invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Failed to update invitation:", updateError);
      }

      alert(`✅ Welcome to ${invitation.firm_name}! You can now log in.`);
      router.push("/login");
    } catch (err: any) {
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