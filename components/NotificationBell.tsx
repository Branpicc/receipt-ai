"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  receipt_id: string | null;
  email_id: string | null;
  read: boolean;
  created_at: string;
};

type NotificationSummary = {
  emailsCount: number;
  needsReviewCount: number;
  flaggedCount: number;
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    emailsCount: 0,
    needsReviewCount: 0,
    flaggedCount: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();

    // Click outside to close
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const firmId = await getMyFirmId();

      // Get recent notifications (last 50, unread first)
      const { data: notifs, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("firm_id", firmId)
        .order("read", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((notifs as Notification[]) || []);
      setUnreadCount(notifs?.filter(n => !n.read).length || 0);

      // Calculate summary
      const emailsCount = notifs?.filter(n => n.type === 'email_received' && !n.read).length || 0;
      const needsReviewCount = notifs?.filter(n => n.type === 'receipt_needs_review' && !n.read).length || 0;
      const flaggedCount = notifs?.filter(n => n.type === 'receipt_flagged' && !n.read).length || 0;

      setSummary({ emailsCount, needsReviewCount, flaggedCount });
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
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
      
      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("firm_id", firmId)
        .eq("read", false);

      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'email_received':
        return '📧';
      case 'receipt_uploaded':
        return '📄';
      case 'receipt_flagged':
        return '⚠️';
      case 'receipt_needs_review':
        return '👀';
      default:
        return '🔔';
    }
  }

  function getNotificationLink(notification: Notification) {
    if (notification.receipt_id) {
      return `/dashboard/receipts/${notification.receipt_id}`;
    }
    if (notification.email_id) {
      return `/dashboard/email-inbox`;
    }
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

  const hasUnread = unreadCount > 0;
  const hasSummary = summary.emailsCount > 0 || summary.needsReviewCount > 0 || summary.flaggedCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-2xl">🔔</span>
        {hasUnread && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[600px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Summary */}
          {hasSummary && (
            <div className="p-4 bg-blue-50 border-b">
              <div className="text-sm font-medium text-gray-900 mb-2">Since your last visit:</div>
              <div className="space-y-1 text-sm text-gray-700">
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
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={getNotificationLink(notification)}
                    onClick={() => {
                      markAsRead(notification.id);
                      setIsOpen(false);
                    }}
                    className={`block p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                          {notification.title}
                        </div>
                        {notification.message && (
                          <div className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </div>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {hasUnread && (
            <div className="p-3 border-t bg-gray-50">
              <button
                onClick={markAllAsRead}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}