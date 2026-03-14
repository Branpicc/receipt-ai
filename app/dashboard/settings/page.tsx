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
  displayName?: string;
};

type UserPreferences = {
  theme: "light" | "dark" | "system";
  language: "en" | "fr";
  emailNotifications: boolean;
  receiptNotifications: boolean;
  budgetAlerts: boolean;
  weeklyDigest: boolean;
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    language: "en",
    emailNotifications: true,
    receiptNotifications: true,
    budgetAlerts: true,
    weeklyDigest: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [replayingTour, setReplayingTour] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    loadUser();
    loadPreferences();
  }, []);

  // Apply theme when preferences load or change
  useEffect(() => {
    if (preferences.theme) {
      applyTheme(preferences.theme);
    }
  }, [preferences.theme]);

  const loadUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("role, firm_id, display_name")
        .eq("auth_user_id", session.user.id)
        .single();

      if (!firmUser) {
        setLoading(false);
        return;
      }

      setUser({
        email: session.user.email!,
        role: firmUser.role,
        firmId: firmUser.firm_id,
        displayName: firmUser.display_name,
      });
      
      setDisplayName(firmUser.display_name || "");
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", authUser.id)
        .single();

      if (data) {
        setPreferences({
          theme: data.theme || "system",
          language: data.language || "en",
          emailNotifications: data.email_notifications ?? true,
          receiptNotifications: data.receipt_notifications ?? true,
          budgetAlerts: data.budget_alerts ?? true,
          weeklyDigest: data.weekly_digest ?? false,
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const savePreferences = async (newPreferences: Partial<UserPreferences>) => {
    try {
      setSaving(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const updated = { ...preferences, ...newPreferences };
      setPreferences(updated);

const { error } = await supabase
  .from("user_preferences")
  .upsert({
    user_id: authUser.id,
    theme: updated.theme,
    language: updated.language,
    email_notifications: updated.emailNotifications,
    receipt_notifications: updated.receiptNotifications,
    budget_alerts: updated.budgetAlerts,
    weekly_digest: updated.weeklyDigest,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id'
  });
  
      if (error) throw error;

      // Apply theme immediately
      if (newPreferences.theme) {
        applyTheme(newPreferences.theme);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      alert("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const applyTheme = (theme: "light" | "dark" | "system") => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  };

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      alert("Display name cannot be empty");
      return;
    }

    try {
      setSaving(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { error } = await supabase
        .from("firm_users")
        .update({ display_name: displayName.trim() })
        .eq("auth_user_id", authUser.id);

      if (error) throw error;

      setUser(prev => prev ? { ...prev, displayName: displayName.trim() } : null);
      setEditingName(false);
      alert("✅ Display name updated");
    } catch (error) {
      console.error("Failed to update display name:", error);
      alert("Failed to update display name");
    } finally {
      setSaving(false);
    }
  };

  const handleReplayTour = async () => {
    if (!confirm("This will restart the onboarding tour. Continue?")) {
      return;
    }

    try {
      setReplayingTour(true);
      await restartOnboarding();
      window.location.reload();
    } catch (error) {
      console.error("Failed to restart onboarding:", error);
      alert("Failed to restart tour. Please try again.");
    } finally {
      setReplayingTour(false);
    }
  };

  const exportData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !user) return;

      // Get all receipts
      const { data: receipts } = await supabase
        .from("receipts")
        .select("*")
        .eq("firm_id", user.firmId)
        .order("receipt_date", { ascending: false });

      if (!receipts || receipts.length === 0) {
        alert("No receipts to export");
        return;
      }

      // Convert to CSV
      const headers = [
        "Date",
        "Vendor",
        "Amount",
        "Category",
        "Tax Code",
        "Payment Method",
        "Description",
        "Status"
      ];

      const csvRows = [
        headers.join(","),
        ...receipts.map(receipt => [
          receipt.receipt_date || "",
          `"${(receipt.vendor || "").replace(/"/g, '""')}"`,
          (receipt.total_cents / 100).toFixed(2),
          `"${(receipt.category || "").replace(/"/g, '""')}"`,
          receipt.tax_code || "",
          receipt.payment_method || "",
          `"${(receipt.description || "").replace(/"/g, '""')}"`,
          receipt.status || ""
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");

      // Download as CSV
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ Exported ${receipts.length} receipts to CSV`);
    } catch (error) {
      console.error("Failed to export data:", error);
      alert("Failed to export data");
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

        {/* Profile Settings */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!editingName}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white disabled:bg-gray-100 disabled:dark:bg-dark-bg"
                />
                {editingName ? (
                  <>
                    <button
                      onClick={saveDisplayName}
                      disabled={saving}
                      className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setDisplayName(user.displayName || "");
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <input
                type="text"
                value={user.role.replace("_", " ")}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-white capitalize"
              />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme
            </label>
            <div className="flex gap-3">
              {[
                { value: "light", label: "☀️ Light", icon: "☀️" },
                { value: "dark", label: "🌙 Dark", icon: "🌙" },
                { value: "system", label: "💻 System", icon: "💻" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => savePreferences({ theme: option.value as any })}
                  disabled={saving}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    preferences.theme === option.value
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                      : "border-gray-200 dark:border-dark-border hover:border-accent-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.label.split(" ")[1]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Language</h2>
          
          <select
            value={preferences.language}
            onChange={(e) => savePreferences({ language: e.target.value as any })}
            disabled={saving}
            className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
          >
            <option value="en">🇬🇧 English</option>
            <option value="fr">🇫🇷 Français</option>
          </select>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Email Notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Receive email updates</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) => savePreferences({ emailNotifications: e.target.checked })}
                className="w-5 h-5 text-accent-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Receipt Notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Get notified of new receipts</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.receiptNotifications}
                onChange={(e) => savePreferences({ receiptNotifications: e.target.checked })}
                className="w-5 h-5 text-accent-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Budget Alerts</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Alerts when approaching budget limits</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.budgetAlerts}
                onChange={(e) => savePreferences({ budgetAlerts: e.target.checked })}
                className="w-5 h-5 text-accent-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Weekly Digest</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Weekly summary of activity</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.weeklyDigest}
                onChange={(e) => savePreferences({ weeklyDigest: e.target.checked })}
                className="w-5 h-5 text-accent-500 rounded"
              />
            </label>
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
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

        {/* Data & Privacy */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Export</h2>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export all your receipts to a CSV file for use in Excel or accounting software.
          </p>
          
          <button
            onClick={exportData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
          >
            📊 Export Receipts (CSV)
          </button>
        </div>

        {/* User Management (Firm Admins Only) */}
        {user.role === "firm_admin" && (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6 mb-6">
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
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-transparent dark:border-dark-border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Actions</h2>
          
          <LogoutButton className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700" />
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <InviteUserModal onClose={() => setShowInviteModal(false)} />
        )}
      </div>
    </div>
  );
}