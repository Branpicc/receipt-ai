"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";
import ImprovedInviteModal from "@/components/ImprovedInviteModal";

type FirmUser = {
  id: string;
  auth_user_id: string;
  email: string;
  role: "accountant" | "client";
  created_at: string;
  last_seen: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by: string;
};

export default function TeamManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<FirmUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [inviteUrlData, setInviteUrlData] = useState<{ email: string; url: string } | null>(null);
  const [inviteFilter, setInviteFilter] = useState<"all" | "accountant" | "client">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "expired" | "cancelled">("all");
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [showImprovedInvite, setShowImprovedInvite] = useState(false);

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
    loadInvitations();
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();
const { data: firmUsers, error: usersError } = await supabase
        .from("firm_users")
        .select("id, auth_user_id, role, created_at, last_seen, display_name")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });
      if (usersError) throw usersError;
      const usersWithEmails = firmUsers?.map(u => ({ ...u, email: u.display_name || u.auth_user_id })) as FirmUser[];
            setUsers(usersWithEmails || []);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      alert("Failed to load team members: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvitations() {
    try {
      const firmId = await getMyFirmId();
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at, expires_at, invited_by")
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error("Failed to load invitations:", error);
    }
  }

  async function updateRole(userId: string, newRole: "accountant" | "client") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (newRole === "client") {
        const accountantCount = users.filter(u => u.role === "accountant").length;
        if (accountantCount <= 1) {
          alert("Cannot change role. There must be at least one accountant in the firm.");
          return;
        }
      }
      const { error } = await supabase.from("firm_users").update({ role: newRole }).eq("id", userId);
      if (error) throw error;
      alert(`✅ Role updated to ${newRole}`);
      loadUsers();
    } catch (error: any) {
      alert("Failed to update role: " + error.message);
    }
  }

  async function removeUser(userId: string, userAuthId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (userAuthId === user.id) { alert("You cannot remove yourself from the team."); return; }
      const targetUser = users.find(u => u.id === userId);
      if (targetUser?.role === "accountant") {
        const accountantCount = users.filter(u => u.role === "accountant").length;
        if (accountantCount <= 1) { alert("Cannot remove the last accountant from the firm."); return; }
      }
      if (!confirm("Are you sure you want to remove this user from your team?")) return;
      const { error } = await supabase.from("firm_users").delete().eq("id", userId);
      if (error) throw error;
      alert("✅ User removed from team");
      loadUsers();
    } catch (error: any) {
      alert("Failed to remove user: " + error.message);
    }
  }

async function bulkDeleteInvitations() {
    if (selectedInvites.size === 0) return;
    if (!confirm(`Permanently delete ${selectedInvites.size} invitation(s)?`)) return;
    try {
      const ids = Array.from(selectedInvites);
      const { error } = await supabase.from("invitations").delete().in("id", ids);
      if (error) throw error;
      setSelectedInvites(new Set());
      await loadInvitations();
    } catch (error: any) {
      alert("Failed to delete invitations: " + error.message);
    }
  }

  function toggleSelectInvite(id: string) {
    setSelectedInvites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const deletable = filteredInvitations.filter(inv => {
      const isExpired = new Date(inv.expires_at) < new Date();
      return inv.status === "cancelled" || inv.status === "accepted" || isExpired;
    });
    if (selectedInvites.size === deletable.length) {
      setSelectedInvites(new Set());
    } else {
      setSelectedInvites(new Set(deletable.map(inv => inv.id)));
    }
  }


async function deleteInvitation(invitationId: string) {
    if (!confirm("Permanently delete this invitation?")) return;
    try {
      const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
      if (error) throw error;
      await loadInvitations();
    } catch (error: any) {
      alert("Failed to delete invitation: " + error.message);
    }
  }

  async function cancelInvitation(invitationId: string) {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    try {
      const { error } = await supabase.from("invitations").update({ status: "cancelled" }).eq("id", invitationId);
      if (error) throw error;
      alert("✅ Invitation cancelled");
      await loadInvitations();
    } catch (error: any) {
      alert("Failed to cancel invitation: " + error.message);
    }
  }

  async function resendInvitation(email: string, role: string) {
    try {
      setInviting(true);
      const firmId = await getMyFirmId();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Not authenticated"); return; }
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, role, firmId, clientId: role === "client" ? null : null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to resend invitation");
      alert("✅ Invitation resent!");
      await loadInvitations();
    } catch (error: any) {
      alert("Failed to resend invitation: " + error.message);
    } finally {
      setInviting(false);
    }
  }

const filteredInvitations = invitations.filter(inv => {
    const isExpired = new Date(inv.expires_at) < new Date();
    const roleMatch = inviteFilter === "all" || inv.role === inviteFilter;
    const statusMatch = statusFilter === "all" ||
      (statusFilter === "pending" && inv.status === "pending" && !isExpired) ||
      (statusFilter === "accepted" && inv.status === "accepted") ||
      (statusFilter === "expired" && inv.status === "pending" && isExpired) ||
      (statusFilter === "cancelled" && inv.status === "cancelled");
    return roleMatch && statusMatch;
  });

  const statusGroups = [
    { label: "⏳ Pending", filter: (inv: Invitation) => inv.status === "pending" && new Date(inv.expires_at) > new Date() },
    { label: "✅ Accepted", filter: (inv: Invitation) => inv.status === "accepted" },
    { label: "⌛ Expired", filter: (inv: Invitation) => inv.status === "pending" && new Date(inv.expires_at) <= new Date() },
    { label: "❌ Cancelled", filter: (inv: Invitation) => inv.status === "cancelled" },
  ];

  if (loading || (userRole !== "firm_admin" && userRole !== "owner")) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">{loading ? "Loading..." : "Checking access..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Team Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage team members and their access levels</p>
        </div>

        {/* Invite Section */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invite Team Member</h2>
          <button
            onClick={() => setShowImprovedInvite(true)}
            className="w-full px-6 py-3 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>Send Invitation</span>
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Invite accountants or clients to your firm. An email will be sent automatically.
          </p>
        </div>

        {/* Invitations */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm mb-6 border border-transparent dark:border-dark-border overflow-hidden">
<div className="p-6 border-b border-gray-200 dark:border-dark-border">
<div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invitations</h2>
              <div className="flex items-center gap-2">
                {selectedInvites.size > 0 && (
                  <button
                    onClick={bulkDeleteInvitations}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    🗑️ Delete ({selectedInvites.size})
                  </button>
                )}
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-dark-border rounded-lg"
                >
                  {selectedInvites.size > 0 ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>
                        <div className="flex flex-wrap gap-2">
              <div className="flex gap-1">
                {(["all", "accountant", "client"] as const).map(f => (
                  <button key={f} onClick={() => setInviteFilter(f)}
                    className={`px-3 py-1 text-xs rounded-lg capitalize ${inviteFilter === f ? "bg-accent-500 text-white" : "bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-gray-300"}`}>
                    {f === "all" ? "All Roles" : f + "s"}
                  </button>
                ))}
              </div>
              <div className="w-px bg-gray-200 dark:bg-dark-border" />
              <div className="flex gap-1">
                {(["all", "pending", "accepted", "expired", "cancelled"] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 text-xs rounded-lg capitalize ${statusFilter === f ? "bg-accent-500 text-white" : "bg-gray-100 dark:bg-dark-bg text-gray-700 dark:text-gray-300"}`}>
                    {f === "all" ? "All Status" : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
                    {filteredInvitations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No invitations found</div>
          ) : (
            <div>
              {statusGroups.map(({ label, filter }) => {
                const group = filteredInvitations.filter(filter);
                if (group.length === 0) return null;
                return (
                  <div key={label}>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-dark-hover border-y border-gray-100 dark:border-dark-border">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {label} ({group.length})
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-dark-border">
                      {group.map((invitation) => {
                        const isExpired = new Date(invitation.expires_at) < new Date();
                        const isPending = invitation.status === "pending" && !isExpired;
                        return (
<div key={invitation.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors ${selectedInvites.has(invitation.id) ? "bg-blue-50 dark:bg-blue-900/10" : ""}`}>
                            <div className="flex items-center justify-between gap-3">
                              {(invitation.status === "cancelled" || invitation.status === "accepted" || isExpired) && (
                                <input
                                  type="checkbox"
                                  checked={selectedInvites.has(invitation.id)}
                                  onChange={() => toggleSelectInvite(invitation.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-accent-500 flex-shrink-0"
                                />
                              )}
                              <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-1">
                                  <div className="font-medium text-gray-900 dark:text-white">{invitation.email}</div>
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                                    {invitation.role}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Sent {new Date(invitation.created_at).toLocaleDateString()} •{" "}
                                  {isExpired ? "Expired" : "Expires"} {new Date(invitation.expires_at).toLocaleDateString()}
                                </div>
                              </div>
<div className="flex items-center gap-2">
                                {isPending && (
                                  <button onClick={() => cancelInvitation(invitation.id)} className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    Cancel
                                  </button>
                                )}
                                {isExpired && invitation.status !== "cancelled" && (
                                  <button onClick={() => resendInvitation(invitation.email, invitation.role)} className="px-3 py-1.5 text-sm text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-lg transition-colors">
                                    Resend
                                  </button>
                                )}
                                {(invitation.status === "cancelled" || invitation.status === "accepted" || isExpired) && (
                                  <button onClick={() => deleteInvitation(invitation.id)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    🗑️
                                  </button>
                                )}
                              </div>
                                                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Team Members */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-transparent dark:border-dark-border overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Team Members ({users.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {users.map((user) => (
              <div key={user.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
<div className="font-medium text-gray-900 dark:text-white">{user.email}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-1">{user.auth_user_id}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                      {user.last_seen && <span> • Last seen {new Date(user.last_seen).toLocaleDateString()}</span>}
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
                    <button onClick={() => removeUser(user.id, user.auth_user_id)} className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">👥 Role Permissions</h3>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <div><strong>Accountant:</strong> Full access - manage team, budgets, settings, all receipts</div>
            <div><strong>Client:</strong> Limited access - view own receipts, upload receipts, basic reporting</div>
          </div>
        </div>

        {/* Improved Invite Modal */}
        {showImprovedInvite && (
          <ImprovedInviteModal
            onClose={() => setShowImprovedInvite(false)}
            onSuccess={(url, email) => {
              setShowImprovedInvite(false);
              setInviteUrlData({ url, email });
              setShowInviteUrl(true);
              loadInvitations();
            }}
            userRole={userRole || ""}
          />
        )}

        {/* Invite URL Modal */}
        {showInviteUrl && inviteUrlData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-transparent dark:border-dark-border">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">✅ Invitation Sent!</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Invitation sent to <strong>{inviteUrlData.email}</strong>
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invitation Link (backup):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteUrlData.url}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(inviteUrlData.url); alert("Copied!"); }}
                    className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                💡 An email has been sent automatically. Share this link as a backup if needed.
              </p>
              <button
                onClick={() => { setShowInviteUrl(false); setInviteUrlData(null); }}
                className="w-full px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}