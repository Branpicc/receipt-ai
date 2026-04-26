"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";

type Conversation = {
  id: string;
  type: "client" | "support";
  subject: string | null;
  status: "open" | "closed";
  client_id: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
  lastMessage?: string;
  unreadCount?: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default function ConversationsPage() {
  const [activeTab, setActiveTab] = useState<"clients" | "support">("clients");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [firmId, setFirmId] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

useEffect(() => {
  loadConversations();
}, [activeTab, firmId, clientId, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const role = await getUserRole();
      setUserRole(role);

      const fId = await getMyFirmId();
      setFirmId(fId);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: firmUser } = await supabase
          .from("firm_users")
          .select("display_name, client_id")
          .eq("auth_user_id", user.id)
          .single();
// For clients, get their client name instead of email
if (role === "client" && firmUser?.client_id) {
  const { data: clientData } = await supabase
    .from("clients")
    .select("name")
    .eq("id", firmUser.client_id)
    .single();
  setUserName(clientData?.name || firmUser?.display_name || "there");
} else {
  setUserName(firmUser?.display_name || "there");
}
      if (role === "client") setClientId(firmUser?.client_id || "");
      }

      if (role !== "client") {
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name")
          .eq("firm_id", fId)
          .order("name");
        setClients(clientsData || []);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations() {
    if (!firmId) return;
    try {
      let query = supabase
        .from("conversations")
        .select("*, clients(name)")
        .eq("firm_id", firmId)
        .eq("type", activeTab === "clients" ? "client" : "support")
        .eq("status", statusFilter)
        .order("updated_at", { ascending: false });

       if (clientId) query = query.eq("client_id", clientId);

      const { data } = await query;
      const convos = (data || []) as Conversation[];

      // Load last message and unread count for each
      for (const convo of convos) {
        const { data: msgs } = await supabase
          .from("conversation_messages")
          .select("message, read, sender_role")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1);

        convo.lastMessage = msgs?.[0]?.message || "No messages yet";

        const { count } = await supabase
          .from("conversation_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .eq("read", false)
          .neq("sender_role", userRole || "");

        convo.unreadCount = count || 0;
      }

      setConversations(convos);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    setMessages((data as Message[]) || []);

    // Mark messages as read
    await supabase
      .from("conversation_messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_role", userRole || "");
  }

  async function selectConversation(convo: Conversation) {
    setSelectedConversation(convo);
    setShowEscalate(false);
    setFailedAttempts(0);
    await loadMessages(convo.id);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;
    setSending(true);

    try {
      const { data: msg } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_role: userRole || "client",
          sender_name: userName,
          message: newMessage.trim(),
          read: false,
        })
        .select()
        .single();

      setMessages(prev => [...prev, msg as Message]);
      setNewMessage("");

      // Update conversation updated_at
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      // If support conversation, trigger AI response
      if (selectedConversation.type === "support") {
        await triggerAiResponse(selectedConversation.id, newMessage.trim());
      }

      await loadConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  async function triggerAiResponse(conversationId: string, userMessage: string) {
    setAiThinking(true);
    try {
      // Build conversation history for context
      const { data: history } = await supabase
        .from("conversation_messages")
        .select("sender_role, message")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      const conversationHistory = (history || []).map(m => ({
        role: m.sender_role === "ai" ? "assistant" : "user",
        content: m.message,
      }));

const { data: { session: chatSession } } = await supabase.auth.getSession();
if (!chatSession) {
  setLoading(false);
  return;
}
const response = await fetch("/api/support/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${chatSession.access_token}`,
  },
  body: JSON.stringify({
    messages: conversationHistory.slice(-10),
    userName,
  }),
});

const data = await response.json();
const aiMessage = data.message || "I'm sorry, I couldn't process that. Please try again.";

      // Check if AI is escalating
      const isEscalating = aiMessage.includes("unable to resolve") || aiMessage.includes("escalate");
      if (isEscalating) {
        setFailedAttempts(prev => {
          const next = prev + 1;
          if (next >= 2) setShowEscalate(true);
          return next;
        });
      }

      await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        sender_role: "ai",
        sender_name: "Receipture Support",
        message: aiMessage,
        read: false,
      });

      await loadMessages(conversationId);
    } catch (err) {
      console.error("AI response failed:", err);
    } finally {
      setAiThinking(false);
    }
  }

  async function escalateToSupport() {
    if (!selectedConversation) return;
    setEscalating(true);
    try {
      // Get full conversation
      const { data: history } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      const transcript = (history || [])
        .map(m => `[${m.sender_name}]: ${m.message}`)
        .join("\n");

      // Send escalation email via API
      await fetch("/api/support/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          firmId,
          userRole,
          userName,
          subject: selectedConversation.subject,
          transcript,
        }),
      });

      // Add system message
      await supabase.from("conversation_messages").insert({
        conversation_id: selectedConversation.id,
        sender_role: "ai",
        sender_name: "Receipture Support",
        message: "✅ Your issue has been escalated to our support team. You'll hear back within 24 hours. We've sent a summary of this conversation to our team.",
        read: false,
      });

      await loadMessages(selectedConversation.id);
      setShowEscalate(false);
    } catch (err) {
      console.error("Escalation failed:", err);
    } finally {
      setEscalating(false);
    }
  }

async function createConversation() {
      console.log("Creating conversation:", { firmId, newClientId, clientId, activeTab, newSubject });
      if (!newSubject.trim()) return;
      if (activeTab === "clients" && !newClientId && userRole !== "client") return;

    try {
const { data: convo, error: convoError } = await supabase
  .from("conversations")
  .insert({
    firm_id: firmId,
    client_id: activeTab === "clients" ? (newClientId || clientId) : null,
    type: activeTab === "clients" ? "client" : "support",
    subject: newSubject.trim(),
    status: "open",
  })
  .select()
  .single();

if (convoError) {
  console.error("Conversation insert error:", convoError);
  alert("Failed to create conversation: " + convoError.message);
  return;
}

      setShowNewConversation(false);
      setNewSubject("");
      setNewClientId("");
      await loadConversations();
      if (convo) selectConversation(convo as Conversation);

// If support, send subject as first user message then trigger AI response
if (activeTab === "support") {
  // Insert the subject as the user's first message
  await supabase.from("conversation_messages").insert({
    conversation_id: convo.id,
    sender_role: userRole || "client",
    sender_name: userName,
    message: newSubject.trim(),
    read: false,
  });

  await loadMessages(convo.id);

  // Trigger AI response to the subject
  await triggerAiResponse(convo.id, newSubject.trim());
}
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }

  const isClient = userRole === "client";

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-dark-bg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💬 Messages</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isClient ? "Message your accountant or get support" : "Client conversations and support tickets"}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-dark-border">
            <button
              onClick={() => { setActiveTab("clients"); setSelectedConversation(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "clients" ? "border-b-2 border-accent-500 text-accent-600 dark:text-accent-400" : "text-gray-600 dark:text-gray-400"}`}
            >
              👥 {isClient ? "Accountant" : "Clients"}
            </button>
            <button
              onClick={() => { setActiveTab("support"); setSelectedConversation(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "support" ? "border-b-2 border-accent-500 text-accent-600 dark:text-accent-400" : "text-gray-600 dark:text-gray-400"}`}
            >
              🤖 Support
            </button>
          </div>

{/* New conversation button */}
<div className="p-3 border-b border-gray-100 dark:border-dark-border space-y-2">
  <button
    onClick={() => setShowNewConversation(true)}
    className="w-full px-3 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
  >
    + New Conversation
  </button>
  <div className="flex gap-2">
    <button
      onClick={() => setStatusFilter("open")}
      className={`flex-1 text-xs px-2 py-1 rounded-lg transition-colors ${statusFilter === "open" ? "bg-accent-500 text-white" : "border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover"}`}
    >
      Open
    </button>
    <button
      onClick={() => setStatusFilter("closed")}
      className={`flex-1 text-xs px-2 py-1 rounded-lg transition-colors ${statusFilter === "closed" ? "bg-accent-500 text-white" : "border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover"}`}
    >
      Closed
    </button>
  </div>
</div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No conversations yet. Start one above!
              </div>
            ) : (
              conversations.map(convo => (
                <button
                  key={convo.id}
                  onClick={() => selectConversation(convo)}
                  className={`w-full text-left p-4 border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors ${selectedConversation?.id === convo.id ? "bg-accent-50 dark:bg-accent-900/20" : ""}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1">
                      {convo.subject || "Untitled"}
                    </div>
                    {(convo.unreadCount || 0) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-accent-500 text-white text-xs rounded-full flex-shrink-0">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                  {convo.clients?.name && (
                    <div className="text-xs text-accent-600 dark:text-accent-400 mb-1">{convo.clients.name}</div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{convo.lastMessage}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(convo.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selectedConversation.subject}</div>
                  {selectedConversation.clients?.name && (
                    <div className="text-sm text-accent-600 dark:text-accent-400">{selectedConversation.clients.name}</div>
                  )}
                </div>
<div className="flex items-center gap-2">
  <span className={`text-xs px-2 py-1 rounded-full ${selectedConversation.status === "open" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
    {selectedConversation.status}
  </span>
  {selectedConversation.status === "open" && (
    <button
      onClick={async () => {
        if (!confirm("Close this conversation?")) return;
        await supabase.from("conversations").update({ status: "closed" }).eq("id", selectedConversation.id);
        setSelectedConversation(prev => prev ? { ...prev, status: "closed" } : prev);
        await loadConversations();
      }}
      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    >
      Close
    </button>
  )}
</div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                  const isOwn = msg.sender_role === userRole;
                  const isAi = msg.sender_role === "ai";
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-3 ${
                        isOwn
                          ? "bg-accent-500 text-white"
                          : isAi
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white"
                          : "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white"
                      }`}>
                        {!isOwn && (
                          <div className={`text-xs font-medium mb-1 ${isAi ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>
                            {isAi ? "🤖 " : ""}{msg.sender_name}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div className={`text-xs mt-1 ${isOwn ? "text-accent-100" : "text-gray-400 dark:text-gray-500"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {aiThinking && (
                  <div className="flex justify-start">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3">
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">🤖 Receipture Support</div>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Escalate button */}
              {showEscalate && selectedConversation.type === "support" && (
                <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Still need help? Escalate to our support team.
                    </p>
                    <button
                      onClick={escalateToSupport}
                      disabled={escalating}
                      className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {escalating ? "Escalating..." : "Escalate to Support"}
                    </button>
                  </div>
                </div>
              )}

              {/* Message input */}
              <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message... (Enter to send)"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-xl text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim() || aiThinking}
                    className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">💬</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Select a conversation</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              New {activeTab === "clients" ? "Client Message" : "Support Ticket"}
            </h2>

            {activeTab === "clients" && !isClient && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client</label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder={activeTab === "clients" ? "e.g. Question about your receipt" : "e.g. Help with uploading"}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowNewConversation(false); setNewSubject(""); setNewClientId(""); }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover"
              >
                Cancel
              </button>
              <button
                onClick={createConversation}
                disabled={!newSubject.trim() || (activeTab === "clients" && !isClient && !newClientId)}
                className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}