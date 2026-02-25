"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { categorizeReceipt } from "@/lib/categorizeReceipt";
import Link from "next/link";

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

  useEffect(() => {
    loadEmailReceipts();
    loadEmailAddress();
  }, [activeTab]);

  async function loadEmailAddress() {
    try {
      const firmId = await getMyFirmId();
      const { data: firm } = await supabase
        .from("firms")
        .select("email_ingestion_address")
        .eq("id", firmId)
        .single();

      if (firm?.email_ingestion_address) {
        setEmailAddress(firm.email_ingestion_address);
      }
    } catch (error) {
      console.error("Failed to load email address:", error);
    }
  }

  async function loadEmailReceipts() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();

      const { data, error } = await supabase
        .from("email_receipts")
        .select("*")
        .eq("firm_id", firmId)
        .eq("status", activeTab)
        .order("received_at", { ascending: false });

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
      
      // Get the email receipt data
      const { data: emailReceipt } = await supabase
        .from("email_receipts")
        .select("*")
        .eq("id", emailReceiptId)
        .single();

      if (!emailReceipt) {
        alert("Email receipt not found");
        return;
      }

      // Check for duplicates
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

      // Get first client (for now)
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("firm_id", firmId)
        .limit(1);

      if (!clients || clients.length === 0) {
        alert("Please add a client first");
        return;
      }

      // Run categorization
      const categorization = categorizeReceipt(
        emailReceipt.vendor || "",
        emailReceipt.email_text || ""
      );

      console.log("📊 Categorization result:", categorization);

      // Create regular receipt from email receipt
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
          // Add categorization
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

      // Update email receipt status
      await supabase
        .from("email_receipts")
        .update({
          status: "approved",
          converted_receipt_id: receipt.id,
        })
        .eq("id", emailReceiptId);

      // Create notification for approved email receipt
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
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Inbox</h1>
      <p className="text-gray-600 mb-6">
        Review receipts received via email
      </p>

      {/* Email Address Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-2">
          📧 Your Receipt Email Address
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Forward receipts to this address and they'll appear here for review
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-white px-4 py-3 rounded border border-blue-300 font-mono text-sm">
            {emailAddress || "Loading..."}
          </code>
          <button
            onClick={copyEmail}
            className="px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("pending")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === "pending"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === "approved"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === "rejected"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Rejected
          </button>
        </nav>
      </div>

      {/* Email Receipts List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : emailReceipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-3">
            {activeTab === "pending" ? "📭" : activeTab === "approved" ? "✅" : "❌"}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {getEmptyStateMessage()}
          </h3>
          <p className="text-gray-600">
            {getEmptyStateDescription()}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {emailReceipts.map((email) => (
            <div
              key={email.id}
              className={`bg-white rounded-lg border p-6 ${
                activeTab === "approved" ? "border-green-200 bg-green-50" :
                activeTab === "rejected" ? "border-red-200 bg-red-50" :
                "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {email.vendor || "Unknown Vendor"}
                    </h3>
                    {email.has_attachment && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        📎 Attachment
                      </span>
                    )}
                    {activeTab === "approved" && email.converted_receipt_id && (
                      <Link 
                        href={`/dashboard/receipts/${email.converted_receipt_id}`}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        View Receipt →
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    From: {email.from_email}
                  </p>
                  <p className="text-sm text-gray-500">
                    {email.subject || "No subject"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Received: {new Date(email.received_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    ${((email.total_cents || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {email.receipt_date
                      ? new Date(email.receipt_date).toLocaleDateString()
                      : "No date"}
                  </div>
                </div>
              </div>

              {/* Email Preview */}
              <div className="bg-white rounded p-3 mb-4 border border-gray-200">
                <p className="text-xs text-gray-600 line-clamp-3">
                  {email.email_text?.substring(0, 200)}...
                </p>
              </div>

              {/* Actions */}
              {activeTab === "pending" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => approveReceipt(email.id)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
                  >
                    ✓ Approve & Categorize
                  </button>
                  <button
                    onClick={() => rejectReceipt(email.id)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}

              {activeTab === "approved" && (
                <div className="flex items-center gap-3 text-sm text-green-700">
                  <span className="font-medium">✓ Approved</span>
                  {email.converted_receipt_id && (
                    <Link
                      href={`/dashboard/receipts/${email.converted_receipt_id}`}
                      className="text-blue-600 hover:text-blue-800 underline"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                  >
                    ↺ Restore to Pending
                  </button>
                  <span className="flex items-center text-sm text-red-700">
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