"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import Link from "next/link";

type EmailInboxRow = {
  id: string;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  has_attachment: boolean;
  attachment_count: number;
  status: string;
  received_at: string;
  client_id: string;
};

export default function EmailInboxPage() {
  const [emails, setEmails] = useState<EmailInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "auto_processed">("pending");

  useEffect(() => {
    loadEmails();
  }, [filter]);

  async function loadEmails() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();
      if (!firmId) throw new Error("No firm found");

      let query = supabase
        .from("email_inbox")
        .select("*")
        .eq("firm_id", firmId)
        .order("received_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails((data as EmailInboxRow[]) || []);
    } catch (err: any) {
      console.error("Failed to load emails:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveAsReceipt(emailId: string) {
    try {
      const { error } = await supabase
        .from("email_inbox")
        .update({ 
          status: "approved",
          processed_at: new Date().toISOString()
        })
        .eq("id", emailId);

      if (error) throw error;

      alert("✅ Email approved! Receipt will be created.");
      loadEmails();
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    }
  }

  async function rejectEmail(emailId: string) {
    try {
      const { error } = await supabase
        .from("email_inbox")
        .update({ 
          status: "rejected",
          processed_at: new Date().toISOString()
        })
        .eq("id", emailId);

      if (error) throw error;

      loadEmails();
    } catch (err: any) {
      alert("Failed to reject: " + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Inbox</h1>
            <p className="text-gray-600 mt-1">
              Review emails that need manual approval
            </p>
          </div>
          <Link
            href="/dashboard/receipts"
            className="text-sm text-gray-600 underline hover:text-gray-800"
          >
            ← Back to receipts
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === "all"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === "pending"
                ? "bg-yellow-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Needs Review
          </button>
          <button
            onClick={() => setFilter("auto_processed")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === "auto_processed"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Auto-Processed
          </button>
        </div>

        {/* Email List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">
              {filter === "pending"
                ? "No emails awaiting review"
                : "No emails found"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {emails.map((email) => (
              <div
                key={email.id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Subject */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {email.subject || "(No subject)"}
                    </h3>

                    {/* From */}
                    <div className="text-sm text-gray-600 mb-2">
                      From: {email.from_email}
                    </div>

                    {/* Body Preview */}
                    {email.body_text && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                        {email.body_text}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {new Date(email.received_at).toLocaleString()}
                      </span>
                      {email.has_attachment && (
                        <span className="flex items-center gap-1">
                          📎 {email.attachment_count} attachment(s)
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded ${
                          email.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : email.status === "auto_processed"
                            ? "bg-green-100 text-green-800"
                            : email.status === "approved"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {email.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {email.status === "pending" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => approveAsReceipt(email.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                      >
                        ✓ Approve as Receipt
                      </button>
                      <button
                        onClick={() => rejectEmail(email.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                      >
                        ✗ Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}