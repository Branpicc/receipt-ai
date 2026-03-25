"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
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

type Tab = "profile" | "notifications" | "billing" | "email" | "security" | "advanced";

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
  const [replayingTour, setReplayingTour] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  
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
      
      // Load email forwarding for clients
      if (firmUser.role === "client" && firmUser.client_id) {
        loadEmailForwarding(firmUser.client_id);
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
        receiptsUsed: usage?.currentCount || 0,
        receiptsLimit: usage?.limit || 10,
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForwarding)) {
      alert("Please enter a valid email address");
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
        .update({ email_forwarding_address: emailForwarding.trim() })
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
    { id: "billing" as Tab, label: "Billing & Plan", icon: "💳" },
    ...(isClient ? [{ id: "email" as Tab, label: "Email Forwarding", icon: "📧" }] : []),
    { id: "security" as Tab, label: "Security", icon: "🔒" },
    { id: "advanced" as Tab, label: "Advanced", icon: "⚙️" },
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
                onClick={() => setActiveTab(tab.id)}
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
                          <div className="text-sm text-gray-600 dark:text-gray-400">Monthly Usage</div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {billingInfo.receiptsUsed} / {billingInfo.receiptsLimit === -1 || billingInfo.receiptsLimit >= 999999 ? '∞' : billingInfo.receiptsLimit}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">receipts</div>
                        </div>
                      </div>

                      {/* Usage Progress Bar */}
                      {billingInfo.receiptsLimit < 999999 && (
                        <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2 mb-4">
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
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => window.location.href = '/dashboard/billing'}
                          className="flex-1 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 font-medium transition-colors"
                        >
                          Change Plan
                        </button>
                        {billingInfo.plan !== 'free' && (
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel your subscription? You'll lose access to premium features.")) {
                                // TODO: Implement retention offer flow
                                alert("Cancellation flow coming soon!");
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
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailForwarding}
                    onChange={(e) => setEmailForwarding(e.target.value)}
                    disabled={!editingEmail}
                    placeholder="receipts@yourcompany.com"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white disabled:bg-gray-100 disabled:dark:bg-dark-bg"
                  />
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
              Replay the onboarding tour to learn about ReceiptAI features again
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
              Sign Out
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sign out of your account on this device
            </p>
            <LogoutButton className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" />
          </div>
        </div>
      )}
    </div>
  </div>
</div>
  );
}