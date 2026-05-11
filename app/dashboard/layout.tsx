"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import SidebarTour from "@/components/SidebarTour";
import DailyCheckinRunner from "@/components/DailyCheckinRunner";
import { getUserRole, UserRole } from "@/lib/getUserRole";
import { getMyFirmPlan } from "@/lib/getMyFirmPlan";
import { hasFeature, type Plan } from "@/lib/featureGates";
import { ClientProvider } from "@/lib/ClientContext";
import { EditModeProvider } from "@/lib/EditMode";
import EditModeToggle from "@/components/EditModeToggle";
import { ToastProvider } from "@/components/Toast";
import {
  Settings as SettingsIcon,
  LogOut,
  Home,
  Folder,
  FolderOpen,
  Camera,
  Wallet,
  Mail,
  MessageSquare,
  BarChart3,
  Flag,
  Users,
  Building2,
  ClipboardList,
  User,
  TrendingUp,
  Receipt,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile drawer state — separate from desktop sidebarOpen (which controls
  // wide vs. narrow on ≥md). On <md the sidebar is hidden by default; the
  // hamburger toggles it as an overlay drawer that closes after navigation.
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [firmPlan, setFirmPlan] = useState<Plan>(null);
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadUserRole();
    loadFirmPlan();
    loadAndApplyTheme();
  }, []);

  // Auto-close the mobile drawer whenever the user navigates to a new page.
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userRole || userRole === "client") return;
    const refresh = async () => {
      try {
        const { count } = await supabase
          .from("deletion_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        setPendingDeletionCount(count || 0);
      } catch {
        // Sidebar badge is decorative; quiet failure is fine.
      }
    };
    refresh();
    // The Edit History page emits this event after approve/deny so the
    // badge updates without waiting for a navigation.
    window.addEventListener("deletion-requests-changed", refresh);
    return () => window.removeEventListener("deletion-requests-changed", refresh);
  }, [userRole, pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

async function loadAndApplyTheme() {
  // Apply the cached theme from localStorage IMMEDIATELY so the layout
  // can render without waiting for Supabase. The inline <script> in
  // app/layout.tsx already toggles `dark` on <html> on first paint, so
  // this just keeps state in sync.
  try {
    const cached = localStorage.getItem("receipture-theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (cached) applyTheme(cached);
  } catch {
    // localStorage may be unavailable (Safari private mode) — ignore.
  }

  // Then refresh from Supabase in the background and update if it differs.
  // This no longer blocks layout render.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_preferences")
      .select("theme")
      .eq("user_id", user.id)
      .single();

    const theme = data?.theme || "system";
    applyTheme(theme);
  } catch (error) {
    console.error("Failed to load theme:", error);
  }
}

function applyTheme(theme: "light" | "dark" | "system") {
  localStorage.setItem('receipture-theme', theme);
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

  async function loadUserRole() {
    const role = await getUserRole();
    setUserRole(role);
  }

  async function loadFirmPlan() {
    const plan = await getMyFirmPlan();
    setFirmPlan(plan);
  }

const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";
const isAccountant = userRole === "accountant" || userRole === "owner" || userRole === "firm_admin";
const isClient = userRole === "client";

// Tier-gated features (Pro+ only). The plan loads asynchronously, so until
// it's known we render conservatively — gated nav items hide while loading
// and reappear if the user is on Pro/Enterprise.
const canBudget = hasFeature(firmPlan, "budget_tracking");
const canEditHistory = hasFeature(firmPlan, "edit_history");
const canClientReports = hasFeature(firmPlan, "client_reports");

return (
  <EditModeProvider userRole={userRole}>
  <ClientProvider userRole={userRole}>
  <ToastProvider>
    <OnboardingWrapper>
            <div className="min-h-screen bg-gray-50 dark:bg-dark-bg md:flex transition-colors">
        {/* Mobile-only hamburger — fixed top-left, sits above safe area */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation"
          className="md:hidden print:hidden fixed top-3 left-3 z-50 w-11 h-11 flex items-center justify-center rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-sm text-gray-700 dark:text-gray-300"
          style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>

        {/* Mobile drawer backdrop */}
        {mobileDrawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden print:hidden fixed inset-0 z-40 bg-black/40"
          />
        )}

        {/* Sidebar — print:hidden so PDF exports get the full page width.
            On <md it acts as an overlay drawer (fixed + transform).
            On ≥md it's a flex sibling with the existing wide/narrow toggle. */}
        <aside
          className={`print:hidden bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border transition-all duration-300 fixed md:static inset-y-0 left-0 z-50 w-64 ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 ${sidebarOpen ? "md:w-64" : "md:w-20"}`}
        >
          <div className="h-full flex flex-col">
            {/* Logo/Brand */}
            <div className="p-6 border-b border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between">
                {sidebarOpen ? (
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Receipture</h1>
                ) : (
                  <span className="text-xl font-bold text-accent-600 dark:text-accent-400">R</span>
                )}
                {/* Desktop: wide/narrow toggle. Mobile: close-drawer button.
                    The chevron behaves differently on mobile (drawer pattern),
                    so we render it as a different button per breakpoint. */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden md:inline-flex text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  aria-label="Close navigation"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" /></svg>
                </button>
              </div>
            </div>

{/* Navigation */}
<nav className="flex-1 p-4 overflow-y-auto">
  {sidebarOpen ? (
    // EXPANDED SIDEBAR
    <ul className="space-y-1">
      {/* Dashboard - always visible */}
      <li>
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            pathname === '/dashboard'
              ? 'bg-accent-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>
      </li>

      {/* Client - Simple nav */}
      {isClient && (
        <>
          <li>
            <Link
              href="/dashboard/receipts"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === '/dashboard/receipts' || pathname.startsWith('/dashboard/receipts/')
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Folder className="w-5 h-5" />
              <span className="font-medium">Receipts</span>
            </Link>
          </li>
          {isClient && (
          <li>
            <Link
              href="/dashboard/personal"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === '/dashboard/personal'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Personal</span>
            </Link>
          </li>
          )}
{!isFirmAdmin && (
          <li>
            <Link
              href="/capture"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === '/capture'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span className="font-medium">Quick Capture</span>
            </Link>
          </li>
          )}
          {canBudget && (
          <li>
            <Link
              href="/dashboard/budget-settings"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === '/dashboard/budget-settings'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="font-medium">Budget</span>
            </Link>
          </li>
          )}

          <li>
            <Link
              href="/dashboard/email-inbox"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === '/dashboard/email-inbox'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Mail className="w-5 h-5" />
              <span className="font-medium">Email Receipts</span>
            </Link>
          </li>

<li>
  <Link
    href="/dashboard/conversations"
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      pathname.startsWith('/dashboard/conversations')
        ? 'bg-accent-500 text-white'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
    }`}
  >
    <MessageSquare className="w-5 h-5" />
    <span className="font-medium">Messages</span>
  </Link>
</li>

{canClientReports && (
<li>
  <Link
    href="/dashboard/client/reports"
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      pathname.startsWith('/dashboard/client/reports') || pathname.startsWith('/dashboard/reports/clients')
        ? 'bg-accent-500 text-white'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
    }`}
  >
    <BarChart3 className="w-5 h-5" />
    <span className="font-medium">My Reports</span>
  </Link>
</li>
)}
        </>
      )}

      {/* Accountant/Firm Admin - Collapsible sections */}
      {(isAccountant || isFirmAdmin) && (
        <>
          {/* Operations Section */}
          <li className="mt-4">
            <button
              onClick={() => setOperationsOpen(!operationsOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="flex-1 text-left font-medium">Operations</span>
              {operationsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </li>
          {operationsOpen && (
            <>
              <li className="ml-4">
                <Link
                  data-tour="sidebar-receipts"
                  href="/dashboard/receipts"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/receipts' || pathname.startsWith('/dashboard/receipts/')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="text-sm">Receipts</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  data-tour="sidebar-email-inbox"
                  href="/dashboard/email-inbox"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/email-inbox'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Email Inbox</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  href="/dashboard/category-dashboard"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/category-dashboard'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm">Categories</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  data-tour="sidebar-flags"
                  href="/dashboard/flags"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/flags'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  <span className="text-sm">Flags</span>
                </Link>
              </li>
              {(userRole === "accountant" || userRole === "owner") && canBudget && (
                <li className="ml-4">
                  <Link
                    href="/dashboard/budget-settings"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/dashboard/budget-settings'
                        ? 'bg-accent-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Spending Budget</span>
                  </Link>
                </li>
              )}
            </>
          )}

          {/* Team & Clients Section */}
          <li className="mt-2">
            <button
              onClick={() => setTeamOpen(!teamOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
            >          
              <Users className="w-5 h-5" />
              <span className="flex-1 text-left font-medium">Team & Clients</span>
              {teamOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </li>
          {teamOpen && (
            <>
              <li className="ml-4">
                <Link
                  data-tour="sidebar-clients"
                  href="/dashboard/clients"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/clients' || pathname.startsWith('/dashboard/clients/')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">Clients</span>
                </Link>
              </li>

              <li className="ml-4">
                <Link
                  href="/dashboard/conversations"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname.startsWith('/dashboard/conversations')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">Messages</span>
                </Link>
              </li>

              <li className="ml-4">
                <Link
                  data-tour="sidebar-approvals"
                  href="/dashboard/approval-requests"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/approval-requests'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="text-sm">Requests</span>
                </Link>
              </li>
              {isFirmAdmin && (
                <li className="ml-4">
                  <Link
                    data-tour="sidebar-team"
                    href="/dashboard/team"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/dashboard/team'
                        ? 'bg-accent-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">Team</span>
                  </Link>
                </li>
              )}
            </>
          )}

          {/* Reports Section */}
          <li className="mt-2">
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="flex-1 text-left font-medium">Reports</span>
              {reportsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </li>
          {reportsOpen && (
            <>
              {isFirmAdmin && (
                <li className="ml-4">
                  <Link
                    href="/dashboard/firm-admin"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/dashboard/firm-admin'
                        ? 'bg-accent-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-sm">Analytics</span>
                  </Link>
                </li>
              )}
              <li className="ml-4">
                <Link
                  href="/dashboard/tax-codes"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/tax-codes'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span className="text-sm">Tax Codes</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  href="/dashboard/reports/capital-assets"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname.startsWith('/dashboard/reports/capital-assets')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">Capital Assets</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  href="/dashboard/reports/home-office"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname.startsWith('/dashboard/reports/home-office')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="text-sm">Home Office</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  href="/dashboard/reports/quarterly-hst"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname.startsWith('/dashboard/reports/quarterly-hst')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="text-sm">Quarterly HST</span>
                </Link>
              </li>
              <li className="ml-4">
                <Link
                  href="/dashboard/reports/net-income"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname.startsWith('/dashboard/reports/net-income')
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm">Net Income</span>
                </Link>
              </li>
              {canClientReports && (
              <li className="ml-4">
  <Link
    data-tour="sidebar-reports-clients"
href="/dashboard/reports/clients"
    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
      pathname.startsWith('/dashboard/reports/clients')
        ? 'bg-accent-500 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
    }`}
  >
    <BarChart3 className="w-4 h-4" />
    <span className="text-sm">Client Reports</span>
  </Link>
</li>
              )}
              {canEditHistory && (
<li className="ml-4">
  <Link
    data-tour="sidebar-reports-edits"
    href="/dashboard/reports/edits"
    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
      pathname.startsWith('/dashboard/reports/edits')
        ? 'bg-accent-500 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
    }`}
  >
    <Edit3 className="w-4 h-4" />
    <span className="text-sm flex-1">Edit History</span>
    {!isClient && pendingDeletionCount > 0 && (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        pathname.startsWith('/dashboard/reports/edits')
          ? 'bg-white/20 text-white'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      }`}>
        {pendingDeletionCount}
      </span>
    )}
  </Link>
</li>
              )}

            </>
          )}
        </>
      )}
    </ul>
  ) : (

    // COLLAPSED SIDEBAR - Icon-only view with floating bubble tooltips
    <ul className="space-y-2">
      {/* Dashboard */}
      <li className="relative group">
        <Link
          href="/dashboard"
          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
            pathname === '/dashboard'
              ? 'bg-accent-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
          }`}
        >
          <Home className="w-5 h-5" />
        </Link>
<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
  Dashboard
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
</div>
      </li>

      {/* Client icons */}
      {isClient && (
        <>
          <li className="relative group">
            <Link
              href="/dashboard/receipts"
              className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname === '/dashboard/receipts' || pathname.startsWith('/dashboard/receipts/')
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Folder className="w-5 h-5" />
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Receipts
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
          <li className="relative group">
            <Link
              href="/capture"
              className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname === '/capture'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Camera className="w-5 h-5" />
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Quick Capture
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
<li className="relative group">
            <Link
              href="/dashboard/budget-settings"
              className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname === '/dashboard/budget-settings'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Budget
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
          
          <li className="relative group">
            <Link
              href="/dashboard/email-inbox"
              className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname === '/dashboard/email-inbox'
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <Mail className="w-5 h-5" />
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Email Receipts
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>

          <li className="relative group">
            <Link
              href="/dashboard/conversations"
              className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname.startsWith('/dashboard/conversations')
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Messages
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
        </>
      )}
      
      {/* Accountant/Firm Admin icons */}
      {(isAccountant || isFirmAdmin) && (
        <>
          <li className="relative group">
            <button
              onClick={() => {
                setSidebarOpen(true);
                setOperationsOpen(true);
              }}
              className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Operations
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
          <li className="relative group">
            <button
              onClick={() => {
                setSidebarOpen(true);
                setTeamOpen(true);
              }}
              className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Team & Clients
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
          <li className="relative group">
            <button
              onClick={() => {
                setSidebarOpen(true);
                setReportsOpen(true);
              }}
              className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Reports
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </li>
        </>
      )}
    </ul>
  )}
</nav>

            {/* User Menu */}
            <div className="p-4 border-t border-gray-200 dark:border-dark-border">
              {/* Role Badge */}
              {sidebarOpen && userRole && (
                <div className="mb-3 px-4 py-2 bg-gray-100 dark:bg-dark-hover rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                    Role
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                    {userRole}
                  </div>
                </div>
              )}

              {/* Owner edit-mode toggle (only renders for owners) */}
              {sidebarOpen ? <EditModeToggle /> : <div className="mb-2 flex justify-center"><EditModeToggle collapsed /></div>}

              {sidebarOpen ? (
                <div className="flex gap-2">
                  <Link
                    data-tour="sidebar-settings"
                    href="/dashboard/settings"
                    className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                  </Link>
                  <div className="relative group">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                      Sign out
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  <div className="relative group">
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                    >
                      <SettingsIcon className="w-5 h-5" />
                    </Link>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                      Settings
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                      Sign out
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content. Inline padding-top accounts for both the iOS
            safe-area inset (~47px on notched devices in standalone PWA)
            and the fixed hamburger button height (44px + 12px gap). On
            ≥md we override back to 0 since the hamburger is hidden. */}
        <main
          className="flex-1 overflow-auto relative md:!pt-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          {/* Notification Bell - Top Right (offset for safe area on mobile) */}
          <div
            className="print:hidden absolute right-4 md:right-8 z-40"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
          >
            <NotificationBell />
          </div>

          <div className="print:hidden">
            <EmailVerifyBanner />
          </div>

          {children}

          <SidebarTour />
          <DailyCheckinRunner />
        </main>
      </div>
    </OnboardingWrapper>
  </ToastProvider>
  </ClientProvider>
  </EditModeProvider>
  );
}