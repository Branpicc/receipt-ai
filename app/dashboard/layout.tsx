"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import UploadFab from "@/components/UploadFab";
import NotificationBell from "@/components/NotificationBell";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import { getUserRole, UserRole } from "@/lib/getUserRole";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    loadUserRole();
  }, []);

  async function loadUserRole() {
    const role = await getUserRole();
    setUserRole(role);
  }

const isFirmAdmin = userRole === "firm_admin" || userRole === "owner";
const isAccountant = userRole === "accountant" || userRole === "owner" || userRole === "firm_admin";
const isClient = userRole === "client";

  // Base navigation items (visible to all)
  const baseNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/receipts", label: "Receipts", icon: "📁" },
  ];

// Accountant-only navigation items
const accountantNavItems = [
  { href: "/dashboard/email-inbox", label: "Email Inbox", icon: "📧" },
  { href: "/dashboard/category-dashboard", label: "Categories", icon: "📊" },
  { href: "/dashboard/tax-codes", label: "Tax Codes", icon: "🧾" },
  { href: "/dashboard/clients", label: "Clients", icon: "👥" },
  { href: "/dashboard/approval-requests", label: "Requests", icon: "📋" },
];

// Show full nav to firm_admin and accountants
const navItems = (isAccountant || isFirmAdmin)
  ? [...baseNavItems, ...accountantNavItems]
  : baseNavItems;

  return (
    <OnboardingWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex transition-colors">
        {/* Sidebar */}
        <aside
          className={`bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border transition-all duration-300 ${
            sidebarOpen ? "w-64" : "w-20"
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Logo/Brand */}
            <div className="p-6 border-b border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between">
                {sidebarOpen ? (
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">ReceiptAI</h1>
                ) : (
                  <span className="text-2xl">📱</span>
                )}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {sidebarOpen ? "←" : "→"}
                </button>
              </div>
            </div>

{/* Navigation */}
<nav className="flex-1 p-4 overflow-y-auto">
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
        <span className="text-xl">🏠</span>
        {sidebarOpen && <span className="font-medium">Dashboard</span>}
      </Link>
    </li>

    {/* Client - Simple nav (no sections) */}
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
            <span className="text-xl">📁</span>
            {sidebarOpen && <span className="font-medium">Receipts</span>}
          </Link>
        </li>
        <li>
          <Link
            href="/capture"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/capture'
                ? 'bg-accent-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
            }`}
          >
            <span className="text-xl">📸</span>
            {sidebarOpen && <span className="font-medium">Quick Capture</span>}
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/budget-settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/dashboard/budget-settings'
                ? 'bg-accent-500 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover'
            }`}
          >
            <span className="text-xl">💰</span>
            {sidebarOpen && <span className="font-medium">Budget</span>}
          </Link>
        </li>
      </>
    )}

    {/* Accountant/Firm Admin - Collapsible sections */}
    {(isAccountant || isFirmAdmin) && (
      <>
        {/* Operations Section */}
        <li className="mt-4">
          <button
onClick={() => {
  if (!sidebarOpen) {
    setSidebarOpen(true);
    setOperationsOpen(true);
  } else {
    setOperationsOpen(!operationsOpen);
  }
}}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
          >
            <span className="text-xl">📊</span>
            {sidebarOpen ? (
              <>
                <span className="flex-1 text-left font-medium">Operations</span>
                <span className="text-sm">{operationsOpen ? '▼' : '▶'}</span>
              </>
            ) : null}
          </button>
        </li>
        {sidebarOpen && operationsOpen && (
          <>
            <li className="ml-4">
              <Link
                href="/dashboard/receipts"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/receipts' || pathname.startsWith('/dashboard/receipts/')
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">📁</span>
                <span className="text-sm">Receipts</span>
              </Link>
            </li>
            <li className="ml-4">
              <Link
                href="/dashboard/email-inbox"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/email-inbox'
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">📧</span>
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
                <span className="text-lg">📂</span>
                <span className="text-sm">Categories</span>
              </Link>
            </li>
            <li className="ml-4">
              <Link
                href="/dashboard/flags"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/flags'
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">🚩</span>
                <span className="text-sm">Flags</span>
              </Link>
            </li>
            <li className="ml-4">
              <Link
                href="/dashboard/budget-settings"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/budget-settings'
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">💰</span>
                <span className="text-sm">Spending Budget</span>
              </Link>
            </li>
          </>
        )}

        {/* Team & Clients Section */}
        <li className="mt-2">
          <button
onClick={() => {
    if (!sidebarOpen) {
      setSidebarOpen(true);
      setTeamOpen(true);  // ✅ CORRECT
    } else {
      setTeamOpen(!teamOpen);  // ✅ CORRECT
    }
  }}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
>          
            <span className="text-xl">👥</span>
            {sidebarOpen ? (
              <>
                <span className="flex-1 text-left font-medium">Team & Clients</span>
                <span className="text-sm">{teamOpen ? '▼' : '▶'}</span>
              </>
            ) : null}
          </button>
        </li>
        {sidebarOpen && teamOpen && (
          <>
            <li className="ml-4">
              <Link
                href="/dashboard/clients"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/clients' || pathname.startsWith('/dashboard/clients/')
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">🏢</span>
                <span className="text-sm">Clients</span>
              </Link>
            </li>
            <li className="ml-4">
              <Link
                href="/dashboard/approval-requests"
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard/approval-requests'
                    ? 'bg-accent-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="text-lg">📋</span>
                <span className="text-sm">Requests</span>
              </Link>
            </li>
            {isFirmAdmin && (
              <li className="ml-4">
                <Link
                  href="/dashboard/team"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard/team'
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                >
                  <span className="text-lg">👤</span>
                  <span className="text-sm">Team</span>
                </Link>
              </li>
            )}
          </>
        )}

        {/* Reports Section */}
        <li className="mt-2">
          <button
 onClick={() => {
    if (!sidebarOpen) {
      setSidebarOpen(true);
      setReportsOpen(true);
    } else {
      setReportsOpen(!reportsOpen);
    }
  }}
  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
>
            <span className="text-xl">📈</span>
            {sidebarOpen ? (
              <>
                <span className="flex-1 text-left font-medium">Reports</span>
                <span className="text-sm">{reportsOpen ? '▼' : '▶'}</span>
              </>
            ) : null}
          </button>
        </li>
        {sidebarOpen && reportsOpen && (
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
                  <span className="text-lg">📊</span>
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
                <span className="text-lg">🧾</span>
                <span className="text-sm">Tax Codes</span>
              </Link>
            </li>
          </>
        )}
      </>
    )}
  </ul>
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

              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
              >
                <span className="text-xl">⚙️</span>
                {sidebarOpen && <span className="font-medium">Settings</span>}
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative">
          {/* Notification Bell - Top Right */}
          <div className="absolute top-4 right-8 z-40">
            <NotificationBell />
          </div>
          
          {children}
        </main>
              
        {/* Floating Upload Button */}
        <UploadFab />
      </div>
    </OnboardingWrapper>
  );
}