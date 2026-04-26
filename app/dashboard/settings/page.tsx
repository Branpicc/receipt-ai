"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import { restartOnboarding } from "@/lib/useOnboarding";
import ClientCardManager from "@/components/ClientCardManager";
import TrainingModules from "@/components/TrainingModules";

type UserInfo = {
  email: string;
  role: string;
  firmId: string;
  displayName?: string;
  phoneNumber?: string;
};

type UserPreferences = {
  theme: "light" | "dark" | "system";
  language: "en" | "fr";
  emailNotifications: boolean;
  receiptNotifications: boolean;
  budgetAlerts: boolean;
  weeklyDigest: boolean;
};

type Tab = "profile" | "notifications" | "billing" | "email" | "security" | "advanced" | "training";

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
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
const [hardDeleteUsers, setHardDeleteUsers] = useState<{id: string; auth_user_id: string; display_name: string | null; role: string; client_id: string | null}[]>([]);
  const [hardDeleteSearch, setHardDeleteSearch] = useState("");
  const [hardDeleteRoleFilter, setHardDeleteRoleFilter] = useState("all");
  const [replayingTour, setReplayingTour] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [incomeType, setIncomeType] = useState("self_employed");
  
  // Email forwarding
  const [emailForwarding, setEmailForwarding] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Billing info
  const [billingInfo, setBillingInfo] = useState<{
    plan: string;
    status: string;
    receiptsUsed: number;
    receiptsLimit: number;
  } | null>(null);

useEffect(() => {
    if (user && activeTab === "advanced") {
      loadHardDeleteUsers();
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadUser();
    loadPreferences();
  }, []);

  useEffect(() => {
    if (user) {
      loadBillingInfo();
    }
  }, [user]);

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

      const { data: firmUser, error } = await supabase
        .from("firm_users")
        .select("role, firm_id, display_name, client_id")
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

      // Load income type for clients
      if (firmUser.role === "client" && firmUser.client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("income_type")
          .eq("id", firmUser.client_id)
          .single();
        setIncomeType(clientData?.income_type || "self_employed");
      }
      
// Load email forwarding and phone for clients
      if (firmUser.role === "client" && firmUser.client_id) {
        loadEmailForwarding(firmUser.client_id);
        loadClientPhone(firmUser.client_id);
      }
        } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailForwarding = async (clientId: string) => {
    try {
      const { data } = await supabase
        .from("clients")
        .select("email_forwarding_address")
        .eq("id", clientId)
        .single();

      if (data) {
        setEmailForwarding(data.email_forwarding_address || "");
      }
    } catch (error) {
      console.error("Failed to load email forwarding:", error);
    }
  };

const loadClientPhone = async (clientId: string) => {
    try {
      const { data } = await supabase
        .from("clients")
        .select("phone_number")
        .eq("id", clientId)
        .single();
      if (data) {
        setUser(prev => prev ? { ...prev, phoneNumber: data.phone_number || "" } : null);
      }
    } catch (error) {
      console.error("Failed to load phone:", error);
    }
  };

  const loadBillingInfo = async () => {
    try {
      const firmId = user?.firmId;
      if (!firmId) return;

      // Get firm subscription info
      const { data: firm } = await supabase
        .from("firms")
        .select("subscription_tier, subscription_plan, subscription_status")
        .eq("id", firmId)
        .single();

      const plan = firm?.subscription_tier || firm?.subscription_plan || 'free';

      // Get usage stats
const { getUsageStats } = await import('@/lib/checkUsageLimits');
const usage = await getUsageStats(firmId);

setBillingInfo({
  plan,
  status: firm?.subscription_status || 'active',
  receiptsUsed: usage?.clients || 0,
  receiptsLimit: usage?.clientLimit || 5,
});

} catch (error) {
      console.error("Failed to load billing info:", error);
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
        const loadedPrefs = {
          theme: data.theme || "system",
          language: data.language || "en",
          emailNotifications: data.email_notifications ?? true,
          receiptNotifications: data.receipt_notifications ?? true,
          budgetAlerts: data.budget_alerts ?? true,
          weeklyDigest: data.weekly_digest ?? false,
        };
        setPreferences(loadedPrefs);
        applyTheme(loadedPrefs.theme);
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

      if (newPreferences.theme) {
        applyTheme(newPreferences.theme);
      }
      
      alert("✅ Preferences saved");
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

  const saveEmailForwarding = async () => {
    if (!emailForwarding.trim()) {
      alert("Email address cannot be empty");
      return;
    }

if (!/^[a-zA-Z0-9._-]+$/.test(emailForwarding.trim())) {
      alert("Please enter only the part before the @ symbol");
      return;
    }

    try {
      setSaving(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", authUser.id)
        .single();

      if (!firmUser?.client_id) {
        alert("Client record not found");
        return;
      }

const { error } = await supabase
        .from("clients")
        .update({ email_forwarding_address: `${emailForwarding.trim()}@receipts.receipture.ca` })
        .eq("id", firmUser.client_id);
        
      if (error) throw error;

      setEditingEmail(false);
      alert("✅ Email forwarding address updated");
    } catch (error) {
      console.error("Failed to update email forwarding:", error);
      alert("Failed to update email forwarding");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    try {
      setChangingPassword(true);
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("✅ Password changed successfully");
    } catch (error: any) {
      console.error("Failed to change password:", error);
      alert("Failed to change password: " + error.message);
    } finally {
      setChangingPassword(false);
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

const loadHardDeleteUsers = async () => {
    if (!user || (user.role !== "firm_admin" && user.role !== "owner")) return;
    try {
      // Get users with accounts
      const { data: firmUsers } = await supabase
        .from("firm_users")
        .select("id, auth_user_id, display_name, role, client_id")
        .eq("firm_id", user.firmId)
        .neq("role", "firm_admin")
        .neq("role", "owner")
        .order("created_at", { ascending: false });

      // Get clients without accounts
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", user.firmId)
        .eq("is_active", true);

      const accountClientIds = new Set((firmUsers || []).map(u => u.client_id).filter(Boolean));
      const clientsWithoutAccounts = (allClients || [])
        .filter(c => !accountClientIds.has(c.id))
        .map(c => ({
          id: `client-only-${c.id}`,
          auth_user_id: "",
          display_name: c.name,
          role: "client (no account)",
          client_id: c.id,
        }));

      setHardDeleteUsers([...(firmUsers || []), ...clientsWithoutAccounts]);
    } catch (err) {
      console.error("Failed to load users for delete:", err);
    }
  };

const hardDeleteUser = async (firmUserId: string, authUserId: string, displayName: string | null, clientId: string | null) => {
    if (!confirm(`⚠️ Permanently delete ${displayName || "this user"}?\n\nThis will remove:\n• Their account access\n• Their firm_users record\n• Their client record (if applicable)\n\nReceipts and data they submitted will remain. This cannot be undone.`)) return;
try {
      if (clientId) {
        await supabase.from("clients").delete().eq("id", clientId);
      }
      // Only delete firm_users if it's a real account (not client-only)
      if (!firmUserId.startsWith("client-only-")) {
        await supabase.from("firm_users").delete().eq("id", firmUserId);
      }
            alert("✅ User removed successfully.");
      loadHardDeleteUsers();
    } catch (err: any) {
      alert("Failed to delete user: " + err.message);
    }
  };

  const exportData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !user) return;

      const { data: receipts } = await supabase
        .from("receipts")
        .select("*")
        .eq("firm_id", user.firmId)
        .order("receipt_date", { ascending: false });

      if (!receipts || receipts.length === 0) {
        alert("No receipts to export");
        return;
      }

      const headers = [
        "Date",
        "Vendor",
        "Amount",
        "Category",
        "Payment Method",
        "Status"
      ];

      const csvRows = [
        headers.join(","),
        ...receipts.map(receipt => [
          receipt.receipt_date || "",
          `"${(receipt.vendor || "").replace(/"/g, '""')}"`,
          (receipt.total_cents / 100).toFixed(2),
          `"${(receipt.approved_category || receipt.suggested_category || "").replace(/"/g, '""')}"`,
          receipt.payment_method || "",
          receipt.status || ""
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
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
          Not authenticated. Please log in.
        </div>
      </div>
    );
  }

  const isClient = user.role === "client";
  const isAccountant = user.role === "accountant" || user.role === "firm_admin" || user.role === "owner";

  const tabs = [
    { id: "profile" as Tab, label: "Profile", icon: "👤" },
    { id: "notifications" as Tab, label: "Notifications", icon: "🔔" },
    ...(user.role === "firm_admin" || user.role === "owner" ? [{ id: "billing" as Tab, label: "Billing & Plan", icon: "💳" }] : []),
    ...(isClient ? [{ id: "email" as Tab, label: "Email Forwarding", icon: "📧" }] : []),
    { id: "security" as Tab, label: "Security", icon: "🔒" },
    { id: "advanced" as Tab, label: "Advanced", icon: "⚙️" },
    { id: "training" as Tab, label: "Training", icon: "🎓" },
  ];

  const planNames: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Manage your account settings and preferences
        </p>

        {/* Tabs */}
        <div className="bg-white dark:bg-dark-surface rounded-t-xl border border-gray-200 dark:border-dark-border border-b-0">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "advanced") loadHardDeleteUsers();
                }}
                                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? "border-accent-500 text-accent-600 dark:text-accent-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-dark-surface rounded-b-xl border border-gray-200 dark:border-dark-border p-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Profile Information
                </h2>

                <div className="space-y-4">

                  {isClient && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number on File
                      </label>
                      <input
                        type="text"
                        value={user.phoneNumber || "Not set"}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Contact your accountant to update your phone number
                      </p>
                    </div>
                  )}

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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Contact support to change your email address
                    </p>
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
                        placeholder="Your name"
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
                      Theme
                    </label>
                    <div className="flex gap-2">
                      {(["light", "dark", "system"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => savePreferences({ theme: t })}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors capitalize ${
                            preferences.theme === t
                              ? "bg-accent-500 text-white border-accent-500"
                              : "bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover"
                          }`}
                        >
                          {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      System follows your device setting
                    </p>
                  </div>
                                  </div>
              </div>

{/* Income Type — clients only */}
              {isClient && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Income Type
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    This determines which CRA tax form applies to your receipts (T2125, T776, or T2200).
                  </p>
                  <select
                    value={incomeType}
                    onChange={async (e) => {
                      const newType = e.target.value;
                      setIncomeType(newType);
                      try {
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        if (!authUser) return;
                        const { data: firmUser } = await supabase
                          .from("firm_users")
                          .select("client_id")
                          .eq("auth_user_id", authUser.id)
                          .single();
                        if (!firmUser?.client_id) return;
                        await supabase
                          .from("clients")
                          .update({ income_type: newType })
                          .eq("id", firmUser.client_id);
                        alert("✅ Income type updated");
                      } catch (err: any) {
                        alert("Failed to update income type: " + err.message);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                  >
                    <option value="self_employed">Self-Employed / Incorporated (T2125)</option>
                    <option value="rental_property">Rental Property (T776)</option>
                    <option value="employed">Employed — Home Office/Vehicle (T2200)</option>
                  </select>
                </div>
              )}

              {/* Business Card Manager — clients only */}
              {isClient && (
                <div className="border-t border-gray-200 dark:border-dark-border pt-6">
                  <ClientCardManager />
                </div>
              )}
            </div>
          )}
          
          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Notification Preferences
              </h2>

              <div className="space-y-4">
                <label className="flex items-start justify-between cursor-pointer p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      Email Notifications
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Receive email updates about your receipts and account activity
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) => savePreferences({ emailNotifications: e.target.checked })}
                    className="w-5 h-5 text-accent-500 rounded mt-1 ml-4"
                  />
                </label>

                <label className="flex items-start justify-between cursor-pointer p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      Receipt Notifications
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Get notified when new receipts are uploaded or processed
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.receiptNotifications}
                    onChange={(e) => savePreferences({ receiptNotifications: e.target.checked })}
                    className="w-5 h-5 text-accent-500 rounded mt-1 ml-4"
                  />
                </label>

                <label className="flex items-start justify-between cursor-pointer p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      Budget Alerts
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Receive alerts when approaching budget limits
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.budgetAlerts}
                    onChange={(e) => savePreferences({ budgetAlerts: e.target.checked })}
                    className="w-5 h-5 text-accent-500 rounded mt-1 ml-4"
                  />
                </label>

                <label className="flex items-start justify-between cursor-pointer p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      Weekly Digest
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Receive a weekly summary of your activity and receipts
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.weeklyDigest}
                    onChange={(e) => savePreferences({ weeklyDigest: e.target.checked })}
                    className="w-5 h-5 text-accent-500 rounded mt-1 ml-4"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Subscription & Billing
                </h2>

                {billingInfo ? (
                  <div className="space-y-6">
                    {/* Current Plan Card */}
                    <div className="bg-gradient-to-br from-accent-50 to-accent-100 dark:from-accent-900/20 dark:to-accent-800/20 border border-accent-200 dark:border-accent-800 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-sm text-accent-600 dark:text-accent-400 mb-1">
                            Current Plan
                          </div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                            {planNames[billingInfo.plan] || billingInfo.plan}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Status: <span className="font-medium text-green-600 dark:text-green-400 capitalize">
                              {billingInfo.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                         <div className="text-sm text-gray-600 dark:text-gray-400">Client Usage</div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {billingInfo.receiptsUsed} / {billingInfo.receiptsLimit === -1 || billingInfo.receiptsLimit >= 999999 ? '∞' : billingInfo.receiptsLimit}
                          </div>
                         <div className="text-xs text-gray-500 dark:text-gray-400">clients</div>
                        </div>
                      </div>

                      {/* Usage Progress Bar */}
<div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2 mb-4">
                        {billingInfo.receiptsLimit >= 999999 || billingInfo.receiptsLimit === -1 ? (
                          <div className="h-2 rounded-full bg-green-500 w-full" />
                        ) : (
                          <div
                            className={`h-2 rounded-full transition-all ${
                              billingInfo.receiptsUsed >= billingInfo.receiptsLimit
                                ? "bg-red-500"
                                : billingInfo.receiptsUsed / billingInfo.receiptsLimit > 0.8
                                ? "bg-orange-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min((billingInfo.receiptsUsed / billingInfo.receiptsLimit) * 100, 100)}%` }}
                          />
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => window.location.href = '/dashboard/billing'}
                          className="flex-1 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 font-medium transition-colors"
                        >
                          Change Plan
                        </button>
{billingInfo.plan !== 'free' && (
  <button
    onClick={async () => {
      try {
        // Check eligibility for retention offer
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert('Your session expired. Please log in again.');
          return;
        }
        const eligibilityRes = await fetch('/api/retention/check-eligibility', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ firmId: user.firmId }),
        });
        
const eligibility = await eligibilityRes.json();
console.log('🔍 Retention eligibility:', eligibility);

if (eligibility.eligible) {
  console.log('✅ Eligible for retention offer!');
  // Show retention offer// 

          const accepted = confirm(
            "🎉 Special Offer!\n\n" +
            "We'd hate to see you go! As a valued customer, we'd like to offer you:\n\n" +
            "✨ 30% OFF your current plan for the next 3 months\n\n" +
            `That's just $${billingInfo.plan === 'starter' ? '34.30' : '139.30'}/month instead of $${billingInfo.plan === 'starter' ? '49' : '199'}!\n\n` +
            "Accept this exclusive offer?"
          );
          
          if (accepted) {
            // Accept retention offer (server re-derives card fingerprint from firmId)
            const acceptRes = await fetch('/api/retention/accept-offer', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ firmId: user.firmId }),
            });
            
            if (acceptRes.ok) {
              alert("🎉 Amazing! Your 30% discount has been applied for 3 months. Thank you for staying with us!");
              loadBillingInfo(); // Reload to show updated info
            } else {
              alert("Failed to apply discount. Please try again or contact support.");
            }
} else {
  console.log('❌ Not eligible:', eligibility.reason);
  // Not eligible for retention offer, go straight to cancellation
              
            // User declined offer, proceed with cancellation
            const confirmCancel = confirm(
              "Are you sure you want to cancel?\n\n" +
              "You'll lose access to:\n" +
              "• Unlimited receipts\n" +
              "• AI categorization\n" +
              "• Priority support\n\n" +
              "Your account will revert to the Free plan (10 receipts/month)."
            );
            
            if (confirmCancel) {
              // TODO: Implement actual cancellation
              alert("Cancellation flow coming soon!");
            }
          }
        } else {
          // Not eligible for retention offer, go straight to cancellation
          const confirmCancel = confirm(
            "Are you sure you want to cancel your subscription?\n\n" +
            "Your account will revert to the Free plan (10 receipts/month)."
          );
          
          if (confirmCancel) {
            // TODO: Implement actual cancellation
            alert("Cancellation flow coming soon!");
          }
        }
      } catch (error) {
        console.error("Cancel flow error:", error);
        alert("Something went wrong. Please contact support.");
      }
    }}
    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
  >
    Cancel Plan
  </button>
)}
                      </div>
                    </div>

                    {/* Plan Features */}
                    <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Your Plan Includes
                      </h3>
                      <ul className="space-y-2">
                        {billingInfo.plan === 'free' && (
                          <>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">10 receipts per month</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">1 user</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">AI-powered OCR</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">CSV export</span>
                            </li>
                          </>
                        )}
                        {billingInfo.plan === 'starter' && (
                          <>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">100 receipts per month</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">1 user</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">AI-powered OCR</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">Auto-categorization</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">Email support</span>
                            </li>
                          </>
                        )}
                        {billingInfo.plan === 'professional' && (
                          <>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">Unlimited receipts</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">3 users</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">AI categorization</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">QuickBooks export</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span className="text-gray-700 dark:text-gray-300">Priority support</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Loading billing information...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Forwarding Tab (Clients Only) */}
          {activeTab === "email" && isClient && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Email Forwarding
              </h2>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      How Email Forwarding Works
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Forward receipts to your personal email address, and they'll automatically be processed and added to your account. Perfect for keeping all your receipts in one place!
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Forwarding Email Address
                </label>
<div className="flex gap-2 items-center">
                  <div className="flex flex-1 border border-gray-300 dark:border-dark-border rounded-lg overflow-hidden">
                    <input
                      type="text"
                      value={emailForwarding}
                      onChange={(e) => setEmailForwarding(e.target.value.replace(/@.*/, ""))}
                      disabled={!editingEmail}
                      placeholder="yourname"
                      className="flex-1 px-4 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-white disabled:bg-gray-100 disabled:dark:bg-dark-bg outline-none"
                    />
                    <span className="px-3 py-2 bg-gray-50 dark:bg-dark-hover text-gray-500 dark:text-gray-400 text-sm border-l border-gray-300 dark:border-dark-border whitespace-nowrap">
                      @receipts.receipture.ca
                    </span>
                  </div>
                                    {editingEmail ? (
                    <>
                      <button
                        onClick={saveEmailForwarding}
                        disabled={saving}
                        className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingEmail(false);
                          loadUser();
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingEmail(true)}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      {emailForwarding ? "Edit" : "Set Up"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Forward receipts to this address to automatically add them to your account
                </p>
              </div>
            </div>
          )}

{/* Security Tab */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Password
            </h2>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
</div>

              <button
                onClick={changePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? "Changing..." : "Change Password"}
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Password must be at least 8 characters long
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-dark-border pt-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Two-Factor Authentication
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add an extra layer of security to your account (Coming Soon)
            </p>
            <button
              disabled
              className="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed"
            >
              Enable 2FA (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
{activeTab === "advanced" && (
        <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Onboarding Tour
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Replay the onboarding tour to learn about Receipture features again
            </p>
            <button
              onClick={handleReplayTour}
              disabled={replayingTour}
              className="px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50"
            >
              {replayingTour ? "Restarting..." : "🎯 Replay Tour"}
            </button>
          </div>

          <div className="border-t border-gray-200 dark:border-dark-border pt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Data Export
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Export all your receipts to a CSV file for use in Excel or accounting software
            </p>
            <button
              onClick={exportData}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              📊 Export Receipts (CSV)
            </button>
          </div>

<div className="border-t border-gray-200 dark:border-dark-border pt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📲 Install Receipture App
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add Receipture to your home screen for quick access — no App Store needed.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">🍎 iPhone / iPad (Safari)</p>
              <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Open this page in <strong>Safari</strong></li>
                <li>Tap the <strong>Share</strong> button (□↑) at the bottom</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">🤖 Android (Chrome)</p>
              <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Open this page in <strong>Chrome</strong></li>
                <li>Tap the <strong>⋮ menu</strong> in the top right</li>
                <li>Tap <strong>"Add to Home Screen"</strong></li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            </div>
          </div>

{/* Hard Delete — firm admins only */}
          {(user.role === "firm_admin" || user.role === "owner") && (
            <div className="border-t border-gray-200 dark:border-dark-border pt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                🗑️ Remove Users
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Permanently remove a user and all their associated data from the firm. This cannot be undone.
              </p>
{/* Search and filter */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={hardDeleteSearch}
                  onChange={(e) => setHardDeleteSearch(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
                <select
                  value={hardDeleteRoleFilter}
                  onChange={(e) => setHardDeleteRoleFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  <option value="all">All Roles</option>
                  <option value="accountant">Accountants</option>
                  <option value="client">Clients</option>
                </select>
              </div>

              <div className="space-y-3">
                {hardDeleteUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Loading team members...</p>
                ) : (
                  hardDeleteUsers
                    .filter(u => {
                      const matchesSearch = !hardDeleteSearch || 
                        (u.display_name || "").toLowerCase().includes(hardDeleteSearch.toLowerCase()) ||
                        u.auth_user_id.toLowerCase().includes(hardDeleteSearch.toLowerCase());
                      const matchesRole = hardDeleteRoleFilter === "all" || u.role === hardDeleteRoleFilter;
                      return matchesSearch && matchesRole;
                    })
                    .map(u => (
                                          <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-hover rounded-lg border border-gray-200 dark:border-dark-border">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{u.display_name || "No name"}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{u.auth_user_id}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{u.role}</p>
                      </div>
                      <button
onClick={() => hardDeleteUser(u.id, u.auth_user_id, u.display_name, u.client_id)}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-dark-border pt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sign Out
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sign out of your account on this device
            </p>
            <LogoutButton className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" />
          </div>
        </div>
      )}

      {/* Training Tab */}
      {activeTab === "training" && (
        <TrainingModules
          userRole={user.role}
          isPlanEnterprise={billingInfo?.plan === "enterprise"}
        />
      )}
    </div>
  </div>
</div>
  );
}