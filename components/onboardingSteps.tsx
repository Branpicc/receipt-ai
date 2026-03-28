import { supabase } from "@/lib/supabaseClient";
import React from "react";

// Firm Admin / Owner Onboarding Steps
export const firmAdminSteps = [
  {
    title: "Welcome to ReceiptAI! 🎉",
    description: "Your all-in-one platform for managing business receipts and expenses.",
    content: (
      <div className="space-y-4">
        <p>
          As a <strong>Firm Administrator</strong>, you have complete oversight of your firm's receipt processing system.
        </p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Monitor all receipt processing across your firm</li>
          <li>Assign clients to accountants</li>
          <li>View analytics and performance metrics</li>
          <li>Manage team members and roles</li>
          <li>Track budgets and spending</li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            💡 <strong>Your Role:</strong> You have read-only access to all receipts and data, allowing you to oversee operations without interfering with your accountants' work.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Your Dashboard Overview 📊",
    description: "Get a bird's-eye view of your firm's operations.",
    content: (
      <div className="space-y-4">
        <p>Your dashboard shows real-time metrics:</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <div className="text-2xl mb-2">📄</div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Total Receipts</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Track all uploaded receipts</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <div className="text-2xl mb-2">✅</div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Categorized</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Completion percentage</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <div className="text-2xl mb-2">📧</div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Email Stats</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending & approved</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <div className="text-2xl mb-2">👥</div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Team Overview</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Accountants & clients</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Managing Your Team 👥",
    description: "Invite accountants and assign clients for efficient workflow.",
    content: (
      <div className="space-y-4">
        <p>Build your team in two steps:</p>
        <div className="space-y-3">
          <div className="border-l-4 border-accent-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">1. Invite Accountants</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Go to <strong>Team</strong> → Click "Invite User" → Select "Accountant" role → They'll receive an email invitation
            </p>
          </div>
          <div className="border-l-4 border-accent-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">2. Assign Clients</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Go to <strong>Clients</strong> → Use the dropdown next to each client → Assign to an accountant
            </p>
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
          <p className="text-sm text-yellow-900 dark:text-yellow-200">
            ⚠️ <strong>Tip:</strong> Accountants can only see receipts from their assigned clients, ensuring proper workload distribution.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Analytics & Insights 📈",
    description: "Deep dive into your firm's performance metrics.",
    content: (
      <div className="space-y-4">
        <p>Access detailed analytics from your dashboard:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li><strong>Detailed Analytics</strong> - Comprehensive reports and breakdowns</li>
          <li><strong>Completion Rates</strong> - Track categorization progress</li>
          <li><strong>Flagged Issues</strong> - See receipts that need attention</li>
          <li><strong>Recent Activity</strong> - Monitor latest uploads</li>
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
          Click <strong>"Detailed Analytics"</strong> in Quick Actions for in-depth analysis with date filtering and accountant performance tracking.
        </p>
      </div>
    ),
  },
  {
    title: "You're All Set! 🎊",
    description: "Start managing your firm's receipt processing.",
    content: (
      <div className="space-y-4">
        <p className="text-lg font-medium text-gray-900 dark:text-white">You're ready to go! Here's what to do next:</p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="text-gray-700 dark:text-gray-300"><strong>Add your first client</strong> (if you haven't already)</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Invite accountants</strong> to join your team</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Assign clients</strong> to accountants</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Monitor progress</strong> from your dashboard</li>
        </ol>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
          <p className="text-sm text-green-900 dark:text-green-200">
            💡 You can replay this tour anytime from <strong>Settings → Take a Tour</strong>
          </p>
        </div>
      </div>
    ),
  },
];

// Accountant Onboarding Steps
export const accountantSteps = [
  {
    title: "Welcome, Accountant! 👋",
    description: "Your workflow for processing client receipts efficiently.",
    content: (
      <div className="space-y-4">
        <p>
          As an <strong>Accountant</strong>, you have full access to process and categorize receipts for your assigned clients.
        </p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Process receipts via upload or email</li>
          <li>Review and categorize expenses</li>
          <li>Manage line items and details</li>
          <li>Set budgets and track spending</li>
          <li>Generate tax reports (T2125)</li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            💡 <strong>Your Access:</strong> You can edit and approve all receipts for clients assigned to you.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Receipt Processing Workflow 📋",
    description: "How receipts flow through the system.",
    content: (
      <div className="space-y-4">
        <p>Receipts enter the system in two ways:</p>
        <div className="space-y-3">
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">📤 Manual Upload</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You or clients upload receipts directly. Our AI extracts vendor, date, total, and line items automatically.
            </p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">📧 Email Forwarding</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Clients forward receipts to their unique email address. Check <strong>Email Inbox</strong> to approve them.
            </p>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
          After upload, receipts appear in <strong>Receipts → Needs Review</strong>
        </p>
      </div>
    ),
  },
  {
    title: "Categorizing Receipts 🏷️",
    description: "Organize expenses for tax purposes.",
    content: (
      <div className="space-y-4">
        <p>Every receipt needs an approved category:</p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="text-gray-700 dark:text-gray-300"><strong>AI suggests a category</strong> based on vendor and purpose</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Review the suggestion</strong> - approve or change it</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Set purpose</strong> - add business context if needed</li>
          <li className="text-gray-700 dark:text-gray-300"><strong>Verify line items</strong> - ensure totals match</li>
        </ol>
      </div>
    ),
  },
  {
    title: "Handling Flags & Issues ⚠️",
    description: "Resolve receipts that need attention.",
    content: (
      <div className="space-y-4">
        <p>Our system flags potential issues automatically:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li><strong>Line item mismatches</strong> - Total doesn't match sum of items</li>
          <li><strong>Purpose mismatch</strong> - Description doesn't match vendor</li>
          <li><strong>Missing information</strong> - No vendor or date</li>
          <li><strong>Duplicate receipts</strong> - Same receipt uploaded twice</li>
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
          Flagged receipts show a ⚠️ badge. Click to see details and resolve the issue.
        </p>
      </div>
    ),
  },
  {
    title: "Ready to Process! ✨",
    description: "Start managing your clients' receipts.",
    content: (
      <div className="space-y-4">
        <p className="text-lg font-medium text-gray-900 dark:text-white">You're all set! Here's your workflow:</p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="text-gray-700 dark:text-gray-300">Check <strong>Email Inbox</strong> for new emailed receipts</li>
          <li className="text-gray-700 dark:text-gray-300">Process <strong>Needs Review</strong> receipts</li>
          <li className="text-gray-700 dark:text-gray-300">Categorize and verify details</li>
          <li className="text-gray-700 dark:text-gray-300">Set budgets in <strong>Spending Budget</strong></li>
          <li className="text-gray-700 dark:text-gray-300">Generate reports from <strong>Tax Codes</strong></li>
        </ol>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
          <p className="text-sm text-green-900 dark:text-green-200">
            💡 Replay this tour anytime from <strong>Settings</strong>
          </p>
        </div>
      </div>
    ),
  },
];

// Client Onboarding Steps
export function getClientSteps(
  clientName: string,
  currentAlias: string | null,
  onSaveAlias: (alias: string) => Promise<void>
) {
  return [
    {
      title: "Welcome to ReceiptAI! 🎉",
      description: "Simplify your receipt tracking and expense management.",
      content: (
        <div className="space-y-4">
          <p>
            Hi <strong>{clientName}</strong>! Your accountant has set up ReceiptAI for you.
          </p>
          <p>With ReceiptAI, you can:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Upload receipts instantly from your phone or computer</li>
            <li>Forward receipt emails to your personal receipt inbox</li>
            <li>Track spending against your budgets</li>
            <li>View all processed receipts in one place</li>
          </ul>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              💡 Your accountant handles all categorization — you just need to upload!
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Set Up Your Email Inbox 📧",
      description: "Get your personal receipt email address.",
      content: (
        <ClientEmailSetup currentAlias={currentAlias} onSave={onSaveAlias} />
      ),
      action: {
        label: "Save & Continue →",
        onClick: async () => {
          if ((window as any).__saveClientEmail) {
            await (window as any).__saveClientEmail();
          }
        },
      },
    },
    // ── NEW: SMS Setup Step ──────────────────────────────────────────────────
    {
      title: "Set Up SMS Notifications 📱",
      description: "Get a text message asking for the purpose of each receipt.",
      content: <ClientSmsSetup />,
      action: {
        label: "Save & Continue →",
        onClick: async () => {
          if ((window as any).__saveClientSms) {
            await (window as any).__saveClientSms();
          }
        },
      },
    },
    // ────────────────────────────────────────────────────────────────────────
    {
      title: "Tell Us About Your Income 💼",
      description: "Help us prepare the right tax forms for you.",
      content: <ClientIncomeTypeSelection />,
    },
    {
      title: "Confirm Your Income Types 📋",
      description: "Review your selections before continuing.",
      content: <ClientIncomeTypeConfirmation />,
      action: {
        label: "Save & Continue →",
        onClick: async () => {
          if ((window as any).__saveIncomeTypeConfirm) {
            await (window as any).__saveIncomeTypeConfirm();
          }
        },
      },
    },
    {
      title: "How to Upload Receipts 📸",
      description: "Two easy ways to submit your receipts.",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">📤</span> Option 1: Direct Upload
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click the <strong>+ Upload</strong> button (bottom right) or visit the Dashboard. Select multiple receipts at once — we support JPG, PNG, PDF, and HEIC formats.
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">📧</span> Option 2: Email Forwarding
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Forward receipt emails to your custom address. Our system will extract the receipts automatically!
            </p>
            <div className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded px-3 py-2 font-mono text-sm">
              {currentAlias || "Set your email in the previous step"}@receipts.example.com
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Track Your Spending 💰",
      description: "Set budgets and monitor your expenses.",
      content: (
        <div className="space-y-4">
          <p>Stay on top of your business spending:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Set monthly budgets for different expense categories</li>
            <li>See real-time spending vs. budget</li>
            <li>Get alerts when you're approaching limits</li>
            <li>View spending trends over time</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            Go to <strong>Spending Budget</strong> to set your monthly limits for categories like meals, fuel, and supplies.
          </p>
        </div>
      ),
    },
    {
      title: "You're Ready to Go! 🚀",
      description: "Start uploading your receipts today.",
      content: (
        <div className="space-y-4">
          <p className="text-lg font-medium text-gray-900 dark:text-white">Everything is set up! Here's what to do next:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-gray-700 dark:text-gray-300">Upload your first receipt using the <strong>+ button</strong></li>
            <li className="text-gray-700 dark:text-gray-300">Or forward receipt emails to your inbox address</li>
            <li className="text-gray-700 dark:text-gray-300">Set your budgets in <strong>Spending Budget</strong></li>
            <li className="text-gray-700 dark:text-gray-300">Check back anytime to view processed receipts</li>
          </ol>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
            <p className="text-sm text-green-900 dark:text-green-200">
              💡 Your accountant will handle all the categorization — just keep uploading!
            </p>
          </div>
        </div>
      ),
    },
  ];
}

// ── SMS Setup Component ──────────────────────────────────────────────────────
function ClientSmsSetup() {
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [smsEnabled, setSmsEnabled] = React.useState(false);
  const [timing, setTiming] = React.useState("instant");
  const [endOfDayTime, setEndOfDayTime] = React.useState("20:00");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const timingOptions = [
    { value: "instant", label: "Instantly", desc: "Right when the receipt is received" },
    { value: "5min", label: "5 minutes later", desc: "A short delay after receipt arrives" },
    { value: "30min", label: "30 minutes later", desc: "Good for staying focused" },
    { value: "1hour", label: "1 hour later", desc: "Batch during natural breaks" },
    { value: "4hours", label: "4 hours later", desc: "Morning and afternoon check-ins" },
    { value: "end_of_day", label: "End of day summary", desc: "One message for all daily receipts" },
  ];

  // Generate time options from 5pm to 10pm in 30 min intervals
  const endOfDayOptions: { value: string; label: string }[] = [];
  for (let h = 17; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const hour12 = h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'pm' : 'am';
      const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      endOfDayOptions.push({ value, label });
    }
  }

  async function handleSave() {
    if (!smsEnabled) {
      // User opted out — save with sms_enabled = false, skip phone validation
      try {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: firmUser } = await supabase
          .from("firm_users")
          .select("client_id")
          .eq("auth_user_id", user.id)
          .single();

        if (firmUser?.client_id) {
          await supabase
            .from("clients")
            .update({ sms_enabled: false })
            .eq("id", firmUser.client_id);
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
      return;
    }

    // Validate phone number
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      throw new Error("Invalid phone number");
    }

    try {
      setSaving(true);
      setError("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!firmUser?.client_id) throw new Error("Client record not found");

      // Format to E.164
      const formatted = digits.length === 10 ? `+1${digits}` : `+${digits}`;

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          phone_number: formatted,
          sms_enabled: true,
          sms_timing: timing,
          sms_end_of_day_time: timing === "end_of_day" ? endOfDayTime : null,
        })
        .eq("id", firmUser.client_id);

      if (updateError) throw updateError;
      setError("");
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    (window as any).__saveClientSms = handleSave;
  }, [phoneNumber, smsEnabled, timing, endOfDayTime]);

  return (
    <div className="space-y-5">

      {/* What this is */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
              Receipt Purpose via Text Message
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              When you submit a receipt, we'll send you a text asking what it was for. Just reply and we'll save it automatically — no need to log in.
            </p>
          </div>
        </div>
      </div>

      {/* Save our number */}
      <div className="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          📲 Save this number as <strong>ReceiptAI</strong>
        </p>
        <p className="text-xl font-mono font-bold text-accent-600 dark:text-accent-400">
          {process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "+1 (249) 506-9136"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          This is the number that will text you. Save it so you recognize it!
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Enable SMS notifications</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Receive text messages for receipt purposes</p>
        </div>
        <button
          onClick={() => setSmsEnabled(!smsEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            smsEnabled ? "bg-accent-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              smsEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {smsEnabled && (
        <>
          {/* Phone number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Mobile Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setError("");
              }}
              placeholder="(416) 555-0123"
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Canadian or US numbers supported</p>
          </div>

          {/* Timing preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              When would you like to receive texts?
            </label>
            <div className="space-y-2">
              {timingOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTiming(option.value)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    timing === option.value
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                      : "border-gray-200 dark:border-dark-border hover:border-accent-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.desc}</p>
                    </div>
                    {timing === option.value && (
                      <span className="text-accent-500 text-lg">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* End of day time picker */}
          {timing === "end_of_day" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What time would you like your daily summary?
              </label>
              <select
                value={endOfDayTime}
                onChange={(e) => setEndOfDayTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                {endOfDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {saving && <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>}

      {!smsEnabled && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          You can enable SMS notifications later in Settings.
        </p>
      )}
    </div>
  );
}

// Client Email Setup Component
function ClientEmailSetup({
  currentAlias,
  onSave,
}: {
  currentAlias: string | null;
  onSave: (alias: string) => Promise<void>;
}) {
  const [alias, setAlias] = React.useState(currentAlias || "");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function validateAlias(value: string): boolean {
    const validFormat = /^[a-z0-9_-]{3,30}$/.test(value);
    if (!validFormat) {
      setError("Must be 3-30 characters: lowercase letters, numbers, hyphens, underscores only");
      return false;
    }
    setError("");
    return true;
  }

  async function handleSave() {
    if (!alias.trim()) { setError("Email alias is required"); return; }
    if (!validateAlias(alias)) return;
    try {
      setSaving(true);
      await onSave(alias);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    (window as any).__saveClientEmail = handleSave;
  }, [alias]);

  return (
    <div className="space-y-4">
      <p>Choose a custom email address for your receipts. Forward any receipt emails here, and we'll process them automatically!</p>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Receipt Email Address</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={alias}
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              setAlias(val);
              if (val) validateAlias(val);
            }}
            placeholder="your-name"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white font-mono"
          />
          <span className="text-gray-500 dark:text-gray-400">@receipts.example.com</span>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saving && <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">Examples: john-smith, jdoe, mycompany-2024</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          💡 <strong>Tip:</strong> Save this email to your contacts so you can quickly forward receipts while on the go!
        </p>
      </div>
    </div>
  );
}

// Client Income Type Selection Component
function ClientIncomeTypeSelection() {
  const [primaryIncome, setPrimaryIncome] = React.useState<string[]>(() => {
    return (window as any).__incomeTypeData?.primaryIncome || [];
  });
  const [secondaryIncome, setSecondaryIncome] = React.useState<string[]>(() => {
    return (window as any).__incomeTypeData?.secondaryIncome || [];
  });
  const [otherIncomeText, setOtherIncomeText] = React.useState(() => {
    return (window as any).__incomeTypeData?.otherIncomeText || "";
  });

  const incomeTypes = [
    { value: "employed", label: "Employed (T4)", desc: "You receive a T4 from your employer", icon: "👔" },
    { value: "self_employed", label: "Self-Employed", desc: "Sole proprietorship, freelancer", icon: "💼" },
    { value: "incorporated", label: "Incorporated Business", desc: "You own a corporation", icon: "🏢" },
    { value: "partnership", label: "Partnership", desc: "Business partnership", icon: "🤝" },
    { value: "retired", label: "Retired/Pension", desc: "CPP, OAS, or pension income", icon: "🏖️" },
    { value: "rental_property", label: "Rental Property Owner", desc: "Rental income from property", icon: "🏠" },
    { value: "investment", label: "Investment Income", desc: "Dividends, capital gains", icon: "📈" },
    { value: "student", label: "Student", desc: "Limited or no income", icon: "🎓" },
    { value: "other", label: "Other", desc: "Specify your income source", icon: "📝" },
  ];

  const secondaryOptions = [
    { value: "rental", label: "Rental Income" },
    { value: "investment", label: "Investment Income" },
    { value: "self_employment", label: "Self-Employment" },
  ];

  function togglePrimaryIncome(value: string) {
    if (primaryIncome.includes(value)) {
      setPrimaryIncome(primaryIncome.filter(v => v !== value));
      if (value === "other") setOtherIncomeText("");
    } else {
      setPrimaryIncome([...primaryIncome, value]);
    }
  }

  React.useEffect(() => {
    (window as any).__incomeTypeData = { primaryIncome, secondaryIncome, otherIncomeText };
  }, [primaryIncome, secondaryIncome, otherIncomeText]);

  return (
    <div className="space-y-4">
      <p className="text-gray-700 dark:text-gray-300">
        Select all income types that apply to you. This helps us prepare the correct tax forms and track the right expenses.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Income Types * (Select all that apply)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {incomeTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => togglePrimaryIncome(type.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                primaryIncome.includes(type.value)
                  ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                  : "border-gray-200 dark:border-dark-border hover:border-accent-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 relative">
                  {primaryIncome.includes(type.value) && (
                    <div className="absolute -top-2 -left-2 bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-10">✓</div>
                  )}
                  <span className="text-2xl">{type.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">{type.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{type.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {primaryIncome.length > 0 && (
          <p className="text-sm text-accent-600 dark:text-accent-400 mt-2">
            {primaryIncome.length} income type{primaryIncome.length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>
      {primaryIncome.includes("other") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Please specify your other income source *</label>
          <input
            type="text"
            value={otherIncomeText}
            onChange={(e) => setOtherIncomeText(e.target.value)}
            placeholder="e.g., Consulting, Royalties, Alimony"
            className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
          />
        </div>
      )}
      {primaryIncome.length > 0 && !primaryIncome.includes("employed") && !primaryIncome.includes("student") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Additional Income (Optional)</label>
          <div className="space-y-2">
            {secondaryOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer">
                <input
                  type="checkbox"
                  checked={secondaryIncome.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) setSecondaryIncome([...secondaryIncome, option.value]);
                    else setSecondaryIncome(secondaryIncome.filter(v => v !== option.value));
                  }}
                  className="w-4 h-4 text-accent-500 rounded"
                />
                <span className="text-gray-900 dark:text-white">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {primaryIncome.length === 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => { (window as any).__incomeTypeData = { skipped: true }; }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Skip for now — I'll set this later
          </button>
        </div>
      )}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          💡 <strong>Why we ask:</strong> Different income types have different tax forms and deduction rules. This ensures we track the right expenses for you!
        </p>
      </div>
    </div>
  );
}

// Client Income Type Confirmation Component
function ClientIncomeTypeConfirmation() {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const data = (window as any).__incomeTypeData || {};
  const { primaryIncome = [], secondaryIncome = [], otherIncomeText = "", skipped = false } = data;

  const incomeTypes = [
    { value: "employed", label: "Employed (T4)", desc: "You receive a T4 from your employer", icon: "👔" },
    { value: "self_employed", label: "Self-Employed", desc: "Sole proprietorship, freelancer", icon: "💼" },
    { value: "incorporated", label: "Incorporated Business", desc: "You own a corporation", icon: "🏢" },
    { value: "partnership", label: "Partnership", desc: "Business partnership", icon: "🤝" },
    { value: "retired", label: "Retired/Pension", desc: "CPP, OAS, or pension income", icon: "🏖️" },
    { value: "rental_property", label: "Rental Property Owner", desc: "Rental income from property", icon: "🏠" },
    { value: "investment", label: "Investment Income", desc: "Dividends, capital gains", icon: "📈" },
    { value: "student", label: "Student", desc: "Limited or no income", icon: "🎓" },
    { value: "other", label: "Other", desc: "Specify your income source", icon: "📝" },
  ];

  const secondaryOptions = [
    { value: "rental", label: "Rental Income" },
    { value: "investment", label: "Investment Income" },
    { value: "self_employment", label: "Self-Employment" },
  ];

  async function handleSave() {
    if (skipped) return;
    if (primaryIncome.length === 0) {
      setError("No income types selected. Please go back and select at least one.");
      throw new Error("No income types selected");
    }
    if (primaryIncome.includes("other") && !otherIncomeText.trim()) {
      setError("Please go back and specify your other income source.");
      throw new Error("Other income text required");
    }
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: firmUser } = await supabase.from("firm_users").select("client_id").eq("auth_user_id", user.id).single();
      if (!firmUser?.client_id) throw new Error("Client record not found");
      let incomeData = [...primaryIncome];
      if (primaryIncome.includes("other") && otherIncomeText.trim()) {
        incomeData = incomeData.map(i => i === "other" ? `other:${otherIncomeText.trim()}` : i);
      }
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          income_type: primaryIncome.length > 1 ? 'other' : primaryIncome[0],
          secondary_income: primaryIncome.length > 1 ? incomeData : secondaryIncome,
        })
        .eq("id", firmUser.client_id);
      if (updateError) throw updateError;
      delete (window as any).__incomeTypeData;
      setError("");
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    (window as any).__saveIncomeTypeConfirm = handleSave;
  }, [primaryIncome, secondaryIncome, otherIncomeText, skipped]);

  if (skipped) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Skipped!</p>
        <p className="text-gray-600 dark:text-gray-400">You can set your income type later in Settings.</p>
      </div>
    );
  }

  const selectedTypes = incomeTypes.filter(t => primaryIncome.includes(t.value));
  const selectedSecondary = secondaryOptions.filter(s => secondaryIncome.includes(s.value));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">📋</div>
        <p className="text-gray-600 dark:text-gray-400">Please review your selections before continuing</p>
      </div>
      <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Primary Income Sources ({selectedTypes.length})</h4>
        <div className="space-y-2">
          {selectedTypes.map(type => (
            <div key={type.value} className="flex items-center gap-3 p-3 bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {type.label}
                  {type.value === "other" && otherIncomeText && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({otherIncomeText})</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{type.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {selectedSecondary.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Secondary Income ({selectedSecondary.length})</h4>
            <div className="space-y-2">
              {selectedSecondary.map(sec => (
                <div key={sec.value} className="flex items-center gap-3 p-3 bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
                  <span className="text-lg">💼</span>
                  <span className="text-gray-900 dark:text-white">{sec.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saving && <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>}
    </div>
  );
}