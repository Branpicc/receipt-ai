"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ApprovalRequest = {
  id: string;
  receipt_id: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  requested_by_email: string;
  receipt_vendor: string | null;
  receipt_total: number | null;
};

export default function ApprovalRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (userRole === "accountant") {
      loadRequests();
    }
  }, [userRole, activeTab]);

  async function checkAccess() {
    const role = await getUserRole();
    setUserRole(role);

    if (role !== "accountant" && role !== "owner") {
      alert("Access denied. Only accountants can view approval requests.");
      router.push("/dashboard");
      return;
    }
  }

  async function loadRequests() {
    try {
      setLoading(true);
      const firmId = await getMyFirmId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's firm_user id
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (!firmUser) return;

      // Get requests assigned to this accountant
      let query = supabase
        .from("approval_requests")
        .select(`
          id,
          receipt_id,
          message,
          status,
          created_at,
          resolved_at,
          requested_by
        `)
        .eq("firm_id", firmId)
        .eq("assigned_to", firmUser.id);

      if (activeTab === "pending") {
        query = query.eq("status", "pending");
      } else {
        query = query.in("status", ["approved", "rejected"]);
      }

      query = query.order("created_at", { ascending: false });

      const { data: requestsData, error } = await query;

      if (error) throw error;

      // Get additional details for each request
      const enrichedRequests = await Promise.all(
        (requestsData || []).map(async (req: any) => {
          // Get requester email
          const { data: requester } = await supabase
            .from("firm_users")
            .select("auth_user_id")
            .eq("id", req.requested_by)
            .single();

          // Get receipt details
          const { data: receipt } = await supabase
            .from("receipts")
            .select("vendor, total_cents")
            .eq("id", req.receipt_id)
            .single();

          return {
            ...req,
            requested_by_email: requester?.auth_user_id || "Unknown",
            receipt_vendor: receipt?.vendor || "Unknown vendor",
            receipt_total: receipt?.total_cents || 0,
          };
        })
      );

      setRequests(enrichedRequests as ApprovalRequest[]);
    } catch (error: any) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markInProgress(requestId: string) {
    try {
      const { error } = await supabase
        .from("approval_requests")
        .update({ status: "pending" }) // Keep as pending since no "in_progress" status
        .eq("id", requestId);

      if (error) throw error;
      await loadRequests();
    } catch (error: any) {
      alert("Failed to update status: " + error.message);
    }
  }

  async function completeRequest() {
    if (!selectedRequestId) return;

    try {
      setCompletingId(selectedRequestId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const firmId = await getMyFirmId();
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
          resolved_by: firmUser?.id || null,
        })
        .eq("id", selectedRequestId);

      if (error) throw error;

      setShowNotesModal(false);
      setSelectedRequestId(null);
      await loadRequests();
    } catch (error: any) {
      alert("Failed to complete request: " + error.message);
    } finally {
      setCompletingId(null);
    }
  }

  function openCompleteModal(requestId: string) {
    setSelectedRequestId(requestId);
    setShowNotesModal(true);
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending" || r.status === "in_progress").length;

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Approval Requests
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Changes requested by firm admins
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "pending"
                ? "bg-accent-500 text-white"
                : "bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover border border-transparent dark:border-dark-border"
            }`}
          >
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "completed"
                ? "bg-accent-500 text-white"
                : "bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover border border-transparent dark:border-dark-border"
            }`}
          >
            Completed
          </button>
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border">
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === "pending"
                ? "No pending requests"
                : "No completed requests"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/dashboard/receipts/${request.receipt_id}`}
                        className="text-lg font-semibold text-gray-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400"
                      >
                        {request.receipt_vendor}
                      </Link>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          request.status === "pending"
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                            : request.status === "approved"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Amount: ${((request.receipt_total || 0) / 100).toFixed(2)} • Requested by:{" "}
                      {request.requested_by_email}
                    </div>
                    <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {request.message}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Created: {new Date(request.created_at).toLocaleString()}
                      {request.resolved_at && (
                        <> • Resolved: {new Date(request.resolved_at).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                </div>

                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/receipts/${request.receipt_id}`}
                      className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 font-medium text-sm transition-colors"
                    >
                      Edit Receipt
                    </Link>
                    <button
                      onClick={() => openCompleteModal(request.id)}
                      disabled={completingId === request.id}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm transition-colors"
                    >
                      {completingId === request.id ? "Completing..." : "Mark Complete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completion Confirmation Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full p-6 border border-transparent dark:border-dark-border">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Complete Request
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Mark this request as complete? This will close the request and notify the firm admin.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedRequestId(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={completeRequest}
                disabled={completingId !== null}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors"
              >
                {completingId ? "Completing..." : "Complete Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}