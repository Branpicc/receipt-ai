"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { MessageSquare, Send, Sparkles } from "lucide-react";

/**
 * Per-receipt chat thread. Mounts on the receipt detail page and gives
 * accountants a way to start (or continue) a conversation with the
 * client about *this specific receipt* — instead of opening a generic
 * thread in /dashboard/conversations.
 *
 * Visibility rules (enforced in the UI; RLS lets all firm members read):
 *   - assigned accountant + the receipt's client : read + write
 *   - firm_admin / owner                          : read only (must
 *     message the accountant about it via a separate thread)
 *   - other accountants in the firm               : not shown
 *
 * Reuse: if an open conversation already exists for this receipt we
 * load it and continue. We never create a duplicate.
 */

type Message = {
  id: string;
  conversation_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  created_at: string;
};

type Conversation = {
  id: string;
  receipt_id: string | null;
  client_id: string | null;
  subject: string | null;
  status: "open" | "closed";
};

type Props = {
  receiptId: string;
  clientId: string;
  vendor: string | null;
  receiptDate: string | null;
  hasUnresolvedFlags: boolean;
  hasPurpose: boolean;
};

const QUICK_PROMPTS: { label: string; message: string }[] = [
  {
    label: "Is this a business expense?",
    message:
      "Quick check on this receipt — can you confirm whether this was a business expense? If it was personal, no problem, we'll mark it accordingly.",
  },
  {
    label: "What was the purpose?",
    message:
      "Could you let me know what this expense was for? Even a short note (e.g. \"client lunch\", \"office supplies for new hire\") helps me categorize it correctly.",
  },
  {
    label: "Wrong card?",
    message:
      "I noticed this receipt was paid with a card that isn't on your registered business cards list. Can you confirm whether this should still be tracked as a business expense?",
  },
];

export default function ReceiptThread({ receiptId, clientId, vendor, receiptDate, hasUnresolvedFlags, hasPurpose }: Props) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [ownClientId, setOwnClientId] = useState<string | null>(null);
  const [assignedAccountantId, setAssignedAccountantId] = useState<string | null>(null);
  const [callerFirmUserId, setCallerFirmUserId] = useState<string | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showFreeform, setShowFreeform] = useState(false);
  const [freeform, setFreeform] = useState("");

  const subject = useMemo(() => {
    const v = vendor || "this receipt";
    const d = receiptDate
      ? new Date(receiptDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
      : "";
    return `About ${v} receipt${d ? ` — ${d}` : ""}`;
  }, [vendor, receiptDate]);

  // ── Initial load: identify caller, fetch existing thread, then messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        setAuthUserId(user.id);

        const firmId = await getMyFirmId();
        const { data: fu } = await supabase
          .from("firm_users")
          .select("id, role, display_name, client_id")
          .eq("auth_user_id", user.id)
          .eq("firm_id", firmId)
          .maybeSingle();
        if (cancelled || !fu) return;
        setUserRole(fu.role || null);
        setUserName(fu.display_name || "Receipture user");
        setCallerFirmUserId(fu.id);
        setOwnClientId(fu.client_id || null);

        // Look up the receipt's assigned accountant (for visibility check).
        const { data: clientRow } = await supabase
          .from("clients")
          .select("assigned_accountant_id")
          .eq("id", clientId)
          .maybeSingle();
        if (cancelled) return;
        setAssignedAccountantId(clientRow?.assigned_accountant_id || null);

        // Reuse: only an OPEN conversation tied to this receipt. Closed
        // threads stay closed (issue was resolved) — if a new flag fires
        // later we want a fresh thread, not the old one reopening.
        // Past history is reachable via /dashboard/conversations.
        const { data: existing } = await supabase
          .from("conversations")
          .select("id, receipt_id, client_id, subject, status")
          .eq("receipt_id", receiptId)
          .eq("status", "open")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (existing) {
          setConversation(existing as Conversation);
          await loadMessages(existing.id, cancelled);
        }
      } catch (err) {
        console.error("ReceiptThread init failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptId, clientId]);

  async function loadMessages(conversationId: string, cancelled: boolean) {
    const { data } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, sender_role, sender_name, message, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (!cancelled) setMessages((data || []) as Message[]);
  }

  // ── Visibility derivation
  const canReadOnly = userRole === "firm_admin" || userRole === "owner";
  const canPost =
    (userRole === "client" && ownClientId === clientId) ||
    (userRole === "accountant" && callerFirmUserId === assignedAccountantId);
  // Other accountants — not the assigned one — don't see the thread at all.
  const otherAccountant = userRole === "accountant" && callerFirmUserId !== assignedAccountantId;
  const canSee = canReadOnly || canPost;

  async function startThread(initialMessage: string) {
    if (!authUserId || !userRole || sending) return;
    setSending(true);
    try {
      const firmId = await getMyFirmId();
      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .insert({
          firm_id: firmId,
          client_id: clientId,
          receipt_id: receiptId,
          type: "client",
          subject,
          status: "open",
        })
        .select("id, receipt_id, client_id, subject, status")
        .single();
      if (convoErr || !convo) throw convoErr || new Error("Failed to create conversation");

      const { error: msgErr } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: convo.id,
          sender_role: userRole,
          sender_name: userName || "Accountant",
          message: initialMessage.trim(),
          read: false,
        });
      if (msgErr) throw msgErr;

      setConversation(convo as Conversation);
      await loadMessages(convo.id, false);
      setDraft("");
      setFreeform("");
      setShowFreeform(false);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to start thread.";
      alert(msg);
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!conversation || !draft.trim() || !userRole || sending) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: conversation.id,
          sender_role: userRole,
          sender_name: userName || (userRole === "client" ? "Client" : "Accountant"),
          message: draft.trim(),
          read: false,
        });
      if (error) throw error;
      // Optimistic refresh.
      await loadMessages(conversation.id, false);
      setDraft("");
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to send.";
      alert(msg);
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;
  if (otherAccountant) return null;
  if (!canSee) return null;

  // ── Existing thread: render the chat
  if (conversation) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-600 dark:text-accent-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Chat about this receipt
            </h3>
            <span
              className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${
                conversation.status === "open"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {conversation.status}
            </span>
          </div>
          <Link
            href="/dashboard/conversations"
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
          >
            All conversations →
          </Link>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet.</p>
          ) : (
            messages.map(m => {
              const mine = m.sender_role === userRole;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      mine
                        ? "bg-accent-500 text-white"
                        : "bg-gray-100 dark:bg-dark-hover text-gray-900 dark:text-white"
                    }`}
                  >
                    <div className="text-[10px] opacity-70 mb-0.5">
                      {m.sender_name} · {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {canPost && conversation.status === "open" ? (
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type a reply…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm resize-none"
              disabled={sending}
            />
            <button
              onClick={sendReply}
              disabled={sending || !draft.trim()}
              className="px-3 py-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        ) : conversation.status === "closed" ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            This thread is closed. Start a fresh one any time if a new question comes up.
          </p>
        ) : canReadOnly ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            You can read this thread but not post directly. Message the assigned accountant if you want to weigh in.
          </p>
        ) : null}
      </div>
    );
  }

  // ── No thread yet: show the soft-suggest CTA (accountant only).
  if (userRole !== "accountant" || callerFirmUserId !== assignedAccountantId) {
    return null;
  }

  const hint = hasUnresolvedFlags
    ? "There's an unresolved flag on this receipt. Want to ask the client about it?"
    : !hasPurpose
    ? "No purpose on this receipt yet. Quick chat to fill it in?"
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-600 dark:text-accent-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          Ask the client about this receipt
        </h3>
      </div>
      {hint && <p className="text-sm text-gray-600 dark:text-gray-400">{hint}</p>}

      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => startThread(p.message)}
            disabled={sending}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowFreeform(s => !s)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-600 hover:bg-accent-700 text-white"
        >
          Other / write your own
        </button>
      </div>

      {showFreeform && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-dark-border">
          <textarea
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            rows={3}
            placeholder="Hi — quick question about this receipt…"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowFreeform(false); setFreeform(""); }}
              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => freeform.trim() && startThread(freeform)}
              disabled={sending || !freeform.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg"
            >
              {sending ? "Starting…" : "Start thread"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
