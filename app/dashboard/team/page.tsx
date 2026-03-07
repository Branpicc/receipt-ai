"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";

type FirmUser = {
  id: string;
  auth_user_id: string;
  email: string;
  role: "accountant" | "client";
  created_at: string;
  last_seen: string | null;
};

export default function TeamManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<FirmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"accountant" | "client">("client");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const role = await getUserRole();
    setUserRole(role);

if (role !== "firm_admin" && role !== "owner") {
  alert("Access denied. Only firm admins can view team management.");
  router.push("/dashboard");
  return;
}

    loadUsers();
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      // Get firm users
      const { data: firmUsers, error: usersError } = await supabase
        .from("firm_users")
        .select("id, auth_user_id, role, created_at, last_seen")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Get auth emails
      const userIds = firmUsers?.map(u => u.auth_user_id) || [];
      
      // Fetch emails from auth.users (requires service role or custom function)
      // For now, we'll show the auth_user_id. In production, you'd need a server function.
      const usersWithEmails = firmUsers?.map(u => ({
        ...u,
        email: u.auth_user_id, // Placeholder - replace with actual email lookup
      })) as FirmUser[];

      setUsers(usersWithEmails || []);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      alert("Failed to load team members: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(userId: string, newRole: "accountant" | "client") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Prevent removing last accountant
      if (newRole === "client") {
        const accountantCount = users.filter(u => u.role === "accountant").length;
        if (accountantCount <= 1) {
          alert("Cannot change role. There must be at least one accountant in the firm.");
          return;
        }
      }

      const { error } = await supabase
        .from("firm_users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      alert(`✅ Role updated to ${newRole}`);
      loadUsers();
    } catch (error: any) {
      console.error("Failed to update role:", error);
      alert("Failed to update role: " + error.message);
    }
  }

  async function removeUser(userId: string, userAuthId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Prevent removing yourself
      if (userAuthId === user.id) {
        alert("You cannot remove yourself from the team.");
        return;
      }

      // Prevent removing last accountant
      const targetUser = users.find(u => u.id === userId);
      if (targetUser?.role === "accountant") {
        const accountantCount = users.filter(u => u.role === "accountant").length;
        if (accountantCount <= 1) {
          alert("Cannot remove the last accountant from the firm.");
          return;
        }
      }

      if (!confirm("Are you sure you want to remove this user from your team?")) {
        return;
      }

      const { error } = await supabase
        .from("firm_users")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      alert("✅ User removed from team");
      loadUsers();
    } catch (error: any) {
      console.error("Failed to remove user:", error);
      alert("Failed to remove user: " + error.message);
    }
  }

  async function inviteUser() {
    try {
      setInviting(true);
      
      // This is a placeholder - in production, you'd need:
      // 1. Send invite email with signup link
      // 2. Create pending invitation in database
      // 3. User signs up and gets added to firm
      
      alert("Invite functionality coming soon! For now, users can sign up and you can assign their role.");
      setInviteEmail("");
    } catch (error: any) {
      console.error("Failed to invite user:", error);
      alert("Failed to send invite: " + error.message);
    } finally {
      setInviting(false);
    }
  }

  if (loading || userRole !== "accountant") {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">
            {loading ? "Loading..." : "Checking access..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Team Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage team members and their access levels
          </p>
        </div>

        {/* Invite Section */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Invite Team Member
          </h2>
          
          <div className="flex gap-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
            
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "accountant" | "client")}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            >
              <option value="client">Client</option>
              <option value="accountant">Accountant</option>
            </select>
            
            <button
              onClick={inviteUser}
              disabled={!inviteEmail || inviting}
              className="px-6 py-2 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviting ? "Inviting..." : "Send Invite"}
            </button>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            💡 Invite functionality coming soon. For now, have users sign up and you can assign their role below.
          </p>
        </div>

        {/* Team Members List */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Team Members ({users.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {users.map((user) => (
              <div key={user.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {user.email}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                      {user.last_seen && (
                        <span> • Last seen {new Date(user.last_seen).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value as "accountant" | "client")}
                      className="px-3 py-1.5 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-sm text-gray-900 dark:text-white"
                    >
                      <option value="accountant">Accountant</option>
                      <option value="client">Client</option>
                    </select>

                    <button
                      onClick={() => removeUser(user.id, user.auth_user_id)}
                      className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            👥 Role Permissions
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <div><strong>Accountant:</strong> Full access - manage team, budgets, settings, all receipts</div>
            <div><strong>Client:</strong> Limited access - view own receipts, upload receipts, basic reporting</div>
          </div>
        </div>
      </div>
    </div>
  );
}