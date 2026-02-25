"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import UploadFab from "@/components/UploadFab";
import NotificationBell from "@/components/NotificationBell";  // ADD THIS

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/receipts", label: "Receipts", icon: "📁" },
    { href: "/dashboard/email-inbox", label: "Email Inbox", icon: "📧" },
    { href: "/dashboard/category-dashboard", label: "Categories", icon: "📊" },
    { href: "/dashboard/tax-codes", label: "Tax Codes", icon: "🧾" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {sidebarOpen ? (
                <h1 className="text-xl font-bold text-gray-900">ReceiptAI</h1>
              ) : (
                <span className="text-2xl">📱</span>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-500 hover:text-gray-700"
              >
                {sidebarOpen ? "←" : "→"}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-black text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      {sidebarOpen && (
                        <span className="font-medium">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-gray-200">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
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
  );
}