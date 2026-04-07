"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";
import { useClientContext } from "@/lib/ClientContext";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  receipt_id: string | null;
  email_id: string | null;
  read: boolean;
  created_at: string;
  // We join receipt to get client_id for filtering
  client_id?: string | null;
};

type NotificationSummary = {
  emailsCount: number;
  needsReviewCount: number;
  flaggedCount: number;
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [summary, setSummary] = useState<NotificationSummary>({
    emailsCount: 0,
    needsReviewCount: 0,
    flaggedCount: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected client from context
  const { selectedClient, isFiltered } = useClientContext();

  useEffect(() => {
    loadNotifications();

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recompute filtered notifications when selected client changes
  useEffect(() => {
    computeSummary(allNotifications);
  }, [selectedClient, allNotifications]);

  async function loadNotifications() {
    try {
      const firmId = await getMyFirmId();

      // Load notifications with receipt info so we can filter by client
// Also filter by client_id directly on notifications table if set
let notifQuery = supabase
  .from("notifications")
  .select(`*, receipts!receipt_id (client_id)`)
  .eq("firm_id", firmId)
  .order("read", { ascending: true })
  .order("created_at", { ascending: false })
  .limit(100);

const { data: notifs, error } = await notifQuery;

      if (error) throw error;

      // Flatten client_id from joined receipt
      const withClientId = (notifs || []).map((n: any) => ({
        ...n,
        client_id: n.receipts?.client_id ?? null,
        receipts: undefined, // remove nested object
      }));

      setAllNotifications(withClientId);
      computeSummary(withClientId);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }

  function getFilteredNotifications(notifs: Notification[]) {
    if (!isFiltered || !selectedClient) return notifs;
    // Show notifications for the selected client, plus non-receipt notifications
    return notifs.filter(n =>
      n.client_id === selectedClient.id || n.client_id === null
    );
  }

  function computeSummary(notifs: Notification[]) {
    const filtered = getFilteredNotifications(notifs);
    const unread = filtered.filter(n => !n.read);

    setUnreadCount(unread.length);
    setSummary({
      emailsCount: unread.filter(n => n.type === 'email_received').length,
      needsReviewCount: unread.filter(n => n.type === 'receipt_needs_review').length,
      flaggedCount: unread.filter(n => n.type === 'receipt_flagged').length,
    });
  }

  async function markAsRead(notificationId: string) {
    try {
      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);
      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      const firmId = await getMyFirmId();
      const filtered = getFilteredNotifications(allNotifications).filter(n => !n.read);
      const ids = filtered.map(n => n.id);

      if (ids.length === 0) return;

      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .in("id", ids);

      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'email_received': return '📧';
      case 'receipt_uploaded': return '📄';
      case 'receipt_flagged': return '⚠️';
      case 'receipt_needs_review': return '👀';
      default: return '🔔';
    }
  }

  function getNotificationLink(notification: Notification) {
    if (notification.receipt_id) return `/dashboard/receipts/${notification.receipt_id}`;
    if (notification.email_id) return `/dashboard/email-inbox`;
    return '/dashboard';
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  const visibleNotifications = getFilteredNotifications(allNotifications);
  const hasUnread = unreadCount > 0;
  const hasSummary = summary.emailsCount > 0 || summary.needsReviewCount > 0 || summary.flaggedCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
      >
        <span className="text-2xl">🔔</span>
        {hasUnread && (
          <span className="absolute top-1 right-1 bg-red-600 dark:bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
      <div className="fixed md:absolute right-0 md:right-0 top-16 md:top-auto mt-0 md:mt-2 w-screen md:w-96 bg-white dark:bg-dark-surface rounded-none md:rounded-lg shadow-xl border-0 md:border border-gray-200 dark:border-dark-border z-50 max-h-[80vh] md:max-h-[600px] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {isFiltered && selectedClient && (
                <p className="text-xs text-accent-600 dark:text-accent-400 mt-0.5">
                  Filtered: {selectedClient.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Summary */}
          {hasSummary && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {isFiltered && selectedClient
                  ? `Since your last visit — ${selectedClient.name}:`
                  : "Since your last visit:"}
              </div>
              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {summary.emailsCount > 0 && (
                  <div>📧 {summary.emailsCount} emailed receipt{summary.emailsCount !== 1 ? 's' : ''} pending</div>
                )}
                {summary.needsReviewCount > 0 && (
                  <div>📄 {summary.needsReviewCount} receipt{summary.needsReviewCount !== 1 ? 's' : ''} need review</div>
                )}
                {summary.flaggedCount > 0 && (
                  <div>⚠️ {summary.flaggedCount} receipt{summary.flaggedCount !== 1 ? 's' : ''} flagged</div>
                )}
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                {isFiltered && selectedClient
                  ? `No notifications for ${selectedClient.name}`
                  : "No notifications yet"}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-dark-border">
                {visibleNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={getNotificationLink(notification)}
                    onClick={() => {
                      markAsRead(notification.id);
                      setIsOpen(false);
                    }}
                    className={`block p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-white`}>
                          {notification.title}
                        </div>
                           {notification.message && (
                          <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {notification.message}
                          </div>
                        )}
                                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </div>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {hasUnread && (
            <div className="p-3 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-hover">
              <button
                onClick={markAllAsRead}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
              >
                Mark all as read {isFiltered && selectedClient ? `for ${selectedClient.name}` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}