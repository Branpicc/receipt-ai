"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { categorizeReceipt } from "@/lib/categorizeReceipt";
import Link from "next/link";
import { useClientContext } from "@/lib/ClientContext";

type EmailReceipt = {
  id: string;
  from_email: string;
  subject: string;
  received_at: string;
  vendor: string | null;
  total_cents: number | null;
  receipt_date: string | null;
  status: string;
  has_attachment: boolean;
  email_text: string;
  converted_receipt_id: string | null;
};

type TabType = "pending" | "approved" | "rejected";

export default function EmailInboxPage() {
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [emailReceipts, setEmailReceipts] = useState<EmailReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");
  const { selectedClient, isFiltered } = useClientContext();

useEffect(() => {
    loadEmailReceipts();
    loadEmailAddress();
  }, [activeTab, selectedClient]);

async function loadEmailAddress() {
    try {
      const firmId = await getMyFirmId();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("role, client_id")
        .eq("auth_user_id", authUser.id)
        .single();

      if (firmUser?.role === "client" && firmUser?.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("email_alias, client_code")
          .eq("id", firmUser.client_id)
          .single();
        if (client) {
          const alias = client.email_alias || client.client_code;
          setEmailAddress(`${alias}@receipts.receipture.ca`);
        }
      } else {
        const { data: firm } = await supabase
          .from("firms")
          .select("email_ingestion_address")
          .eq("id", firmId)
          .single();
        if (firm?.email_ingestion_address) {
          setEmailAddress(firm.email_ingestion_address);
        } else {
          setEmailAddress(`receipts@receipts.receipture.ca`);
        }
      }
    } catch (error) {
      console.error("Failed to load email address:", error);
    }
  }
  
  async function loadEmailReceipts() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

let emailQuery = supabase
        .from("email_receipts")
        .select("*")
        .eq("firm_id", firmId)
        .eq("status", activeTab)
        .order("received_at", { ascending: false });

      if (isFiltered && selectedClient) {
        emailQuery = emailQuery.eq("client_id", selectedClient.id);
      }

      const { data, error } = await emailQuery;

      if (error) throw error;

      setEmailReceipts(data || []);
    } catch (error) {
      console.error("Failed to load email receipts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function approveReceipt(emailReceiptId: string) {
    try {
      const firmId = await getMyFirmId();
      
      const { data: emailReceipt } = await supabase
        .from("email_receipts")
        .select("*")
        .eq("id", emailReceiptId)
        .single();

      if (!emailReceipt) {
        alert("Email receipt not found");
        return;
      }

      if (emailReceipt.vendor && emailReceipt.total_cents && emailReceipt.receipt_date) {
        const { data: duplicates } = await supabase
          .from("receipts")
          .select("id, vendor, total_cents, receipt_date")
          .eq("firm_id", firmId)
          .eq("vendor", emailReceipt.vendor)
          .eq("total_cents", emailReceipt.total_cents)
          .eq("receipt_date", emailReceipt.receipt_date)
          .limit(1);

        if (duplicates && duplicates.length > 0) {
          const confirmDuplicate = confirm(
            `⚠️ Possible duplicate found!\n\n` +
            `Vendor: ${emailReceipt.vendor}\n` +
            `Amount: $${(emailReceipt.total_cents / 100).toFixed(2)}\n` +
            `Date: ${emailReceipt.receipt_date}\n\n` +
            `A receipt with the same details already exists. Add anyway?`
          );
          
          if (!confirmDuplicate) {
            return;
          }
        }
      }

      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("firm_id", firmId)
        .limit(1);

      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        return;
      }

      const categorization = categorizeReceipt(
        emailReceipt.vendor || "",
        emailReceipt.email_text || ""
      );

      console.log("📊 Categorization result:", categorization);

      const { data: receipt, error: receiptError } = await supabase
        .from("receipts")
        .insert([{
          firm_id: firmId,
          client_id: clients[0].id,
          source: "email",
          vendor: emailReceipt.vendor,
          receipt_date: emailReceipt.receipt_date,
          total_cents: emailReceipt.total_cents,
          currency: emailReceipt.currency || "CAD",
          status: "needs_review",
          extraction_status: emailReceipt.extraction_status,
          ocr_raw_text: emailReceipt.ocr_raw_text,
          file_path: emailReceipt.attachment_url,
          suggested_category: categorization.suggested_category,
          category_confidence: categorization.category_confidence,
          category_reasoning: categorization.category_reasoning,
        }])
        .select("id")
        .single();

      if (receiptError) {
        console.error("Failed to create receipt:", receiptError);
        alert("Failed to approve receipt");
        return;
      }

      await supabase
        .from("email_receipts")
        .update({
          status: "approved",
          converted_receipt_id: receipt.id,
        })
        .eq("id", emailReceiptId);

      try {
        await supabase.from("notifications").insert([
          {
            firm_id: firmId,
            type: "receipt_needs_review",
            title: "Email receipt approved",
            message: `${emailReceipt.vendor || "Receipt"} from email needs review`,
            receipt_id: receipt.id,
            email_id: emailReceiptId,
            read: false,
          },
        ]);
      } catch (notifError) {
        console.error("Failed to create notification:", notifError);
      }

      alert(`✅ Receipt approved and categorized as "${categorization.suggested_category}"!`);
      loadEmailReceipts();
    } catch (error: any) {
      console.error("Approve error:", error);
      alert("Failed to approve: " + error.message);
    }
  }

  async function rejectReceipt(emailReceiptId: string) {
    if (!confirm("Reject this email receipt? You can view it later in the Rejected tab.")) return;

    try {
      await supabase
        .from("email_receipts")
        .update({ status: "rejected" })
        .eq("id", emailReceiptId);

      alert("❌ Receipt rejected");
      loadEmailReceipts();
    } catch (error) {
      console.error("Reject error:", error);
    }
  }

  async function restoreReceipt(emailReceiptId: string) {
    if (!confirm("Restore this receipt to pending?")) return;

    try {
      await supabase
        .from("email_receipts")
        .update({ status: "pending" })
        .eq("id", emailReceiptId);

      alert("✅ Receipt restored to pending");
      loadEmailReceipts();
    } catch (error) {
      console.error("Restore error:", error);
    }
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(emailAddress);
    alert("✅ Email address copied!");
  };

  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case "pending":
        return "No pending email receipts";
      case "approved":
        return "No approved emails yet";
      case "rejected":
        return "No rejected emails";
      default:
        return "No emails found";
    }
  };

  const getEmptyStateDescription = () => {
    switch (activeTab) {
      case "pending":
        return "Send receipts to the email above and they'll appear here";
      case "approved":
        return "Approved emails will appear here for reference";
      case "rejected":
        return "Rejected emails will appear here";
      default:
        return "";
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Email Inbox</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Review receipts received via email
      </p>
      
{/* Client filter banner */}
      {isFiltered && selectedClient && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700 rounded-lg">
          <span className="text-sm text-accent-700 dark:text-accent-300 font-medium">
            📁 Showing emails for: <strong>{selectedClient.name}</strong>
          </span>
          <span className="text-xs text-accent-500 dark:text-accent-400">
            — To see all clients, clear the filter on the dashboard
          </span>
        </div>
      )}

      {/* Email Address Display */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          📧 Your Receipt Email Address
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Forward receipts to this address and they'll appear here for review
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-white dark:bg-dark-surface px-4 py-3 rounded border border-blue-300 dark:border-blue-700 font-mono text-sm text-gray-900 dark:text-white">
            {emailAddress || "Loading..."}
          </code>
          <button
            onClick={copyEmail}
            className="px-4 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-dark-border mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("pending")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "pending"
                ? "border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }
            `}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "approved"
                ? "border-green-500 dark:border-green-400 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }
            `}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "rejected"
                ? "border-red-500 dark:border-red-400 text-red-600 dark:text-red-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }
            `}
          >
            Rejected
          </button>
        </nav>
      </div>

      {/* Email Receipts List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : emailReceipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-dark-surface rounded-lg border-2 border-dashed border-gray-300 dark:border-dark-border">
          <div className="text-4xl mb-3">
            {activeTab === "pending" ? "📭" : activeTab === "approved" ? "✅" : "❌"}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {getEmptyStateMessage()}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {getEmptyStateDescription()}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {emailReceipts.map((email) => (
            <div
              key={email.id}
              className={`rounded-lg border p-6 ${
                activeTab === "approved" 
                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" :
                activeTab === "rejected" 
                  ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20" :
                "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {email.vendor || "Unknown Vendor"}
                    </h3>
                    {email.has_attachment && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                        📎 Attachment
                      </span>
                    )}
                    {activeTab === "approved" && email.converted_receipt_id && (
                      <Link 
                        href={`/dashboard/receipts/${email.converted_receipt_id}`}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        View Receipt →
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    From: {email.from_email}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {email.subject || "No subject"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Received: {new Date(email.received_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    ${((email.total_cents || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {email.receipt_date
                      ? new Date(email.receipt_date).toLocaleDateString()
                      : "No date"}
                  </div>
                </div>
              </div>

              {/* Email Preview */}
              <div className="bg-white dark:bg-dark-hover rounded p-3 mb-4 border border-gray-200 dark:border-dark-border">
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                  {email.email_text?.substring(0, 200)}...
                </p>
              </div>

              {/* Actions */}
              {activeTab === "pending" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => approveReceipt(email.id)}
                    className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                  >
                    ✓ Approve & Categorize
                  </button>
                  <button
                    onClick={() => rejectReceipt(email.id)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}

              {activeTab === "approved" && (
                <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400">
                  <span className="font-medium">✓ Approved</span>
                  {email.converted_receipt_id && (
                    <Link
                      href={`/dashboard/receipts/${email.converted_receipt_id}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                      View receipt details →
                    </Link>
                  )}
                </div>
              )}

              {activeTab === "rejected" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => restoreReceipt(email.id)}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    ↺ Restore to Pending
                  </button>
                  <span className="flex items-center text-sm text-red-700 dark:text-red-400">
                    ✗ Rejected
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}