"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";

type ReportType = "receipts" | "tax_codes" | "clients" | "categories" | "monthly" | "comprehensive";

export default function ReportsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>("receipts");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const role = await getUserRole();
    setUserRole(role);

    if (role !== "firm_admin" && role !== "owner" && role !== "accountant") {
      alert("Access denied. Only firm admins and accountants can access reports.");
      router.push("/dashboard");
      return;
    }

    loadClients();
    setLoading(false);
  }

  async function loadClients() {
    try {
      const firmId = await getMyFirmId();
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("firm_id", firmId)
        .eq("is_active", true)
        .order("name");

      setClients(data || []);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  }

  async function exportReport() {
    try {
      setExporting(true);
      const firmId = await getMyFirmId();

      let data: any[] = [];
      let filename = "";
      let headers: string[] = [];

      switch (selectedReport) {
        case "receipts":
          data = await fetchReceiptsReport(firmId);
          filename = `receipts-report-${new Date().toISOString().split("T")[0]}.csv`;
          headers = ["Date", "Vendor", "Amount", "Category", "Tax Code", "Payment Method", "Client", "Status"];
          break;

        case "tax_codes":
          data = await fetchTaxCodesReport(firmId);
          filename = `tax-codes-report-${new Date().toISOString().split("T")[0]}.csv`;
          headers = ["Tax Code", "Description", "Total Amount", "Receipt Count"];
          break;

        case "clients":
          data = await fetchClientsReport(firmId);
          filename = `clients-report-${new Date().toISOString().split("T")[0]}.csv`;
          headers = ["Client", "Total Receipts", "Total Amount", "Avg Receipt", "Last Activity"];
          break;

        case "categories":
          data = await fetchCategoriesReport(firmId);
          filename = `categories-report-${new Date().toISOString().split("T")[0]}.csv`;
          headers = ["Category", "Total Amount", "Receipt Count", "Percentage"];
          break;

        case "monthly":
          data = await fetchMonthlyReport(firmId);
          filename = `monthly-report-${new Date().toISOString().split("T")[0]}.csv`;
          headers = ["Month", "Total Amount", "Receipt Count", "Avg Receipt"];
          break;
      }

      if (data.length === 0) {
        alert("No data to export for the selected filters");
        return;
      }

      // Generate CSV
      const csvRows = [
        headers.join(","),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header] || "";
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(",") ? `"${escaped}"` : escaped;
          }).join(",")
        )
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ Exported ${data.length} rows to ${filename}`);
    } catch (error: any) {
      console.error("Export error:", error);
      alert("Failed to export report: " + error.message);
    } finally {
      setExporting(false);
    }
  }

  async function fetchReceiptsReport(firmId: string) {
    let query = supabase
      .from("receipts")
.select(`
  receipt_date,
  vendor,
  total_cents,
  approved_category,
  suggested_category,
  payment_method,
  status,
  clients (name)
`)
      .eq("firm_id", firmId)
      .order("receipt_date", { ascending: false });

    // Date filters
    if (dateFrom) query = query.gte("receipt_date", dateFrom);
    if (dateTo) query = query.lte("receipt_date", dateTo);
    
    // Client filter
    if (selectedClient) query = query.eq("client_id", selectedClient);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(r => ({
      "Date": r.receipt_date || "",
      "Vendor": r.vendor || "",
      "Amount": (r.total_cents / 100).toFixed(2),
      "Category": r.approved_category || r.suggested_category || "",
      "Payment Method": r.payment_method || "",
      "Client": (() => {
       const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
       return client?.name || "";
        })(),
      "Status": r.status || ""
    }));
  }

async function fetchTaxCodesReport(firmId: string) {
  let query = supabase
    .from("receipts")
    .select("approved_category, suggested_category, total_cents")
    .eq("firm_id", firmId);
  if (selectedClient) query = query.eq("client_id", selectedClient);
  if (dateFrom) query = query.gte("receipt_date", dateFrom);
  if (dateTo) query = query.lte("receipt_date", dateTo);
  const { data, error } = await query;

  if (error) throw error;

  // Group by category (treating it as tax reporting categories)
  const grouped = (data || []).reduce((acc: any, r) => {
    const category = r.approved_category || r.suggested_category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = { count: 0, total: 0 };
    }
    acc[category].count++;
    acc[category].total += r.total_cents;
    return acc;
  }, {});

  return Object.entries(grouped).map(([category, stats]: [string, any]) => ({
    "Tax Code": getCategoryTaxCode(category),
    "Description": category,
    "Total Amount": (stats.total / 100).toFixed(2),
    "Receipt Count": stats.count
  }));
}
  async function fetchClientsReport(firmId: string) {
    const { data, error } = await supabase
      .from("receipts")
      .select(`
        total_cents,
        created_at,
        clients (id, name)
      `)
      .eq("firm_id", firmId);

    if (error) throw error;

    // Group by client
    const grouped = (data || []).reduce((acc: any, r) => {
const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
const clientId = client?.id;
const clientName = client?.name || "Unknown";
      if (!acc[clientId]) {
        acc[clientId] = {
          name: clientName,
          count: 0,
          total: 0,
          lastActivity: r.created_at
        };
      }
      acc[clientId].count++;
      acc[clientId].total += r.total_cents;
      if (new Date(r.created_at) > new Date(acc[clientId].lastActivity)) {
        acc[clientId].lastActivity = r.created_at;
      }
      return acc;
    }, {});

    return Object.values(grouped).map((client: any) => ({
      "Client": client.name,
      "Total Receipts": client.count,
      "Total Amount": (client.total / 100).toFixed(2),
      "Avg Receipt": (client.total / client.count / 100).toFixed(2),
      "Last Activity": new Date(client.lastActivity).toLocaleDateString()
    }));
  }

async function fetchCategoriesReport(firmId: string) {
  let query = supabase
    .from("receipts")
    .select("approved_category, suggested_category, total_cents")
    .eq("firm_id", firmId);
  if (selectedClient) query = query.eq("client_id", selectedClient);
  if (dateFrom) query = query.gte("receipt_date", dateFrom);
  if (dateTo) query = query.lte("receipt_date", dateTo);
  const { data, error } = await query;

  if (error) throw error;

  const grouped = (data || []).reduce((acc: any, r) => {
    const cat = r.approved_category || r.suggested_category || "Uncategorized";
    if (!cat) return acc;
    if (!acc[cat]) {
      acc[cat] = { count: 0, total: 0 };
    }
    acc[cat].count++;
    acc[cat].total += r.total_cents;
    return acc;
  }, {});

  const total = Object.values(grouped).reduce((sum: number, g: any) => sum + g.total, 0);

  return Object.entries(grouped).map(([category, stats]: [string, any]) => ({
    "Category": category,
    "Total Amount": (stats.total / 100).toFixed(2),
    "Receipt Count": stats.count,
    "Percentage": ((stats.total / total) * 100).toFixed(1) + "%"
  }));
}

  async function fetchMonthlyReport(firmId: string) {
    const { data, error } = await supabase
      .from("receipts")
      .select("receipt_date, total_cents")
      .eq("firm_id", firmId)
      .not("receipt_date", "is", null)
      .order("receipt_date", { ascending: false });

    if (error) throw error;

    // Group by month
    const grouped = (data || []).reduce((acc: any, r) => {
      const month = r.receipt_date.substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { count: 0, total: 0 };
      }
      acc[month].count++;
      acc[month].total += r.total_cents;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, stats]: [string, any]) => ({
        "Month": month,
        "Total Amount": (stats.total / 100).toFixed(2),
        "Receipt Count": stats.count,
        "Avg Receipt": (stats.total / stats.count / 100).toFixed(2)
      }));
  }

function getTaxCodeDescription(code: string): string {
  return code;
}

function getCategoryTaxCode(category: string): string {
  // Map categories to T2125 tax codes
  const mapping: Record<string, string> = {
    "Meals & Entertainment": "8523",
    "Motor Vehicle": "9281", 
    "Office Expenses": "8590",
    "Professional Fees": "8810",
    "Supplies": "9270",
    "Advertising": "8521",
    "Insurance": "9804",
    "Travel": "9200"
  };
  return mapping[category] || "9270"; // Default to Supplies
}

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

const reportTypes = [
    { value: "receipts", label: "Receipt Summary", icon: "📄", desc: "All receipts with details" },
    { value: "tax_codes", label: "Tax Code Report", icon: "🧾", desc: "Grouped by T2125 codes" },
    { value: "clients", label: "Client Report", icon: "👥", desc: "Per-client breakdown" },
    { value: "categories", label: "Category Report", icon: "📊", desc: "Expenses by category" },
    { value: "monthly", label: "Monthly Summary", icon: "📅", desc: "Month-over-month" },
    { value: "comprehensive", label: "Comprehensive Report", icon: "📋", desc: "AI-powered full report" },
  ];

  return (
    <div className="p-8 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-6xl mx-auto">
{/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Export Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Generate detailed reports for accounting and analysis
            </p>
          </div>
          
<a
href="/dashboard/reports/clients"
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            📋 Client Monthly Reports
          </a>
        </div>
        
        {/* Report Type Selection */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Report Type
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {reportTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedReport(type.value as ReportType)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedReport === type.value
                    ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                    : "border-gray-200 dark:border-dark-border hover:border-accent-300"
                }`}
              >
                <div className="text-3xl mb-2">{type.icon}</div>
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  {type.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {type.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

{/* Filters */}
        {(selectedReport === "receipts" || selectedReport === "tax_codes" || selectedReport === "categories" || selectedReport === "monthly") && (
                    <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Filters
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Export Button */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 border border-transparent dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Ready to Export
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Report will be downloaded as CSV file
              </p>
            </div>

            <button
              onClick={exportReport}
              disabled={exporting}
              className="px-6 py-3 bg-accent-500 text-white rounded-lg font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Export Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}