"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import InviteUserModal from "@/components/InviteUserModal";
import { restartOnboarding } from "@/lib/useOnboarding";

type UserInfo = {
  email: string;
  role: string;
  firmId: string;
  fullName?: string;
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [replayingTour, setReplayingTour] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      console.log("🔍 Loading user in settings...");
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("📊 Session:", { hasSession: !!session, error: sessionError });
      
      if (!session?.user) {
        console.error("❌ No session");
        setLoading(false);
        return;
      }

      const { data: firmUser, error: firmUserError } = await supabase
        .from("firm_users")
        .select("role, firm_id")
        .eq("auth_user_id", session.user.id)
        .single();

      console.log("📊 Firm user:", { firmUser, error: firmUserError });

      if (firmUserError || !firmUser) {
        console.error("❌ No firm user found");
        setLoading(false);
        return;
      }

      setUser({
        email: session.user.email!,
        role: firmUser.role,
        firmId: firmUser.firm_id,
      });
    } catch (error) {
      console.error("❌ Failed to load user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplayTour = async () => {
    if (!confirm("This will restart the onboarding tour. Continue?")) {
      return;
    }

    try {
      setReplayingTour(true);
      await restartOnboarding();
      
      // Reload the page to trigger onboarding
      window.location.reload();
    } catch (error) {
      console.error("Failed to restart onboarding:", error);
      alert("Failed to restart tour. Please try again.");
    } finally {
      setReplayingTour(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          Not authenticated. Please check the browser console for errors.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      {/* User Info */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-transparent dark:border-dark-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Email:</span>
            <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Role:</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {user.role.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Onboarding */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-transparent dark:border-dark-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Onboarding Tour</h2>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Replay the onboarding tour to learn about ReceiptAI features again.
        </p>
        
        <button
          onClick={handleReplayTour}
          disabled={replayingTour}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {replayingTour ? "Restarting..." : "🎯 Replay Tour"}
        </button>
      </div>

      {/* User Management (Firm Admins Only) */}
      {user.role === "firm_admin" && (
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Management</h2>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Invite accountants and clients to your firm.
          </p>
          
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600"
          >
            + Invite User
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="bg-white dark:bg-dark-surface rounded-2xl border border-transparent dark:border-dark-border p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Actions</h2>
        
        <LogoutButton className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700" />
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}