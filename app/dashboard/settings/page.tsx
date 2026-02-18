"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import InviteUserModal from "@/components/InviteUserModal";

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

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      console.log("🔍 Loading user in settings...");
      
      // Get auth user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("📊 Session:", { hasSession: !!session, error: sessionError });
      
      if (!session?.user) {
        console.error("❌ No session");
        setLoading(false);
        return;
      }

      // Get firm_user record
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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Not authenticated. Please check the browser console for errors.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* User Info */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email:</span>
            <span className="font-medium">{user.email}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Role:</span>
            <span className="font-medium capitalize">
              {user.role.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* User Management (Firm Admins Only) */}
      {user.role === "firm_admin" && (
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">User Management</h2>
          
          <p className="text-sm text-gray-600 mb-4">
            Invite accountants and clients to your firm.
          </p>
          
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            + Invite User
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Account Actions</h2>
        
        <LogoutButton className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700" />
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
