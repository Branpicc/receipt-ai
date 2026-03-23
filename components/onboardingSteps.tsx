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
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              1. Invite Accountants
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Go to <strong>Team</strong> → Click "Invite User" → Select "Accountant" role → They'll receive an email invitation
            </p>
          </div>
          <div className="border-l-4 border-accent-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              2. Assign Clients
            </h4>
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
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          You're ready to go! Here's what to do next:
        </p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Add your first client</strong> (if you haven't already)
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Invite accountants</strong> to join your team
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Assign clients</strong> to accountants
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Monitor progress</strong> from your dashboard
          </li>
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
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              📤 Manual Upload
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You or clients upload receipts directly. Our AI extracts vendor, date, total, and line items automatically.
            </p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              📧 Email Forwarding
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Clients forward receipts to their unique email address (e.g., mike1985@receipts.example.com). Check <strong>Email Inbox</strong> to approve them.
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
          <li className="text-gray-700 dark:text-gray-300">
            <strong>AI suggests a category</strong> based on vendor and purpose
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Review the suggestion</strong> - approve or change it
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Set purpose</strong> - add business context if needed
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            <strong>Verify line items</strong> - ensure totals match
          </li>
        </ol>
        <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View all receipts by category in <strong>Categories</strong> dashboard or by tax code in <strong>Tax Codes</strong>.
          </p>
        </div>
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
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          You're all set! Here's your workflow:
        </p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="text-gray-700 dark:text-gray-300">
            Check <strong>Email Inbox</strong> for new emailed receipts
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            Process <strong>Needs Review</strong> receipts
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            Categorize and verify details
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            Set budgets in <strong>Spending Budget</strong>
          </li>
          <li className="text-gray-700 dark:text-gray-300">
            Generate reports from <strong>Tax Codes</strong>
          </li>
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
              💡 Your accountant handles all categorization - you just need to upload!
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Set Up Your Email Inbox 📧",
      description: "Get your personal receipt email address.",
      content: (
        <ClientEmailSetup
          currentAlias={currentAlias}
          onSave={onSaveAlias}
        />
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
    {
      title: "Tell Us About Your Income 💼",
      description: "Help us prepare the right tax forms for you.",
      content: (
        <ClientIncomeTypeSelection />
      ),
    },
    {
      title: "Confirm Your Income Types 📋",
      description: "Review your selections before continuing.",
      content: (
        <ClientIncomeTypeConfirmation />
      ),
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
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-2xl">📤</span> Option 1: Direct Upload
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click the <strong>+ Upload</strong> button (bottom right) or visit the Dashboard. Select multiple receipts at once - we support JPG, PNG, PDF, and HEIC formats.
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
        </div>
      ),
    },
    {
      title: "Track Your Spending 💰",
      description: "Set budgets and monitor your expenses.",
      content: (
        <div className="space-y-4">
          <p>
            Stay on top of your business spending:
          </p>
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
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            Everything is set up! Here's what to do next:
          </p>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-gray-700 dark:text-gray-300">
              Upload your first receipt using the <strong>+ button</strong>
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              Or forward receipt emails to your inbox address
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              Set your budgets in <strong>Spending Budget</strong>
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              Check back anytime to view processed receipts
            </li>
          </ol>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
            <p className="text-sm text-green-900 dark:text-green-200">
              💡 Your accountant will handle all the categorization - just keep uploading!
            </p>
          </div>
        </div>
      ),
    },
  ];
}

// Client Email Setup Component (used in client onboarding)
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
    if (!alias.trim()) {
      setError("Email alias is required");
      return;
    }

    if (!validateAlias(alias)) {
      return;
    }

    try {
      setSaving(true);
      await onSave(alias);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Store the save function in window so the parent can call it
  React.useEffect(() => {
    (window as any).__saveClientEmail = handleSave;
  }, [alias]);

  return (
    <div className="space-y-4">
      <p>
        Choose a custom email address for your receipts. Forward any receipt emails here, and we'll process them automatically!
      </p>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Your Receipt Email Address
        </label>
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
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {saving && (
          <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Examples: john-smith, jdoe, mycompany-2024
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          💡 <strong>Tip:</strong> Save this email to your contacts so you can quickly forward receipts while on the go!
        </p>
      </div>
    </div>
  );
}

// Client Income Type Selection Component (Step 1)
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
      if (value === "other") {
        setOtherIncomeText("");
      }
    } else {
      setPrimaryIncome([...primaryIncome, value]);
    }
  }

  // Save to window storage when state changes
  React.useEffect(() => {
    (window as any).__incomeTypeData = {
      primaryIncome,
      secondaryIncome,
      otherIncomeText,
    };
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
                    <div className="absolute -top-2 -left-2 bg-accent-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-10">
                      ✓
                    </div>
                  )}
                  <span className="text-2xl">{type.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {type.desc}
                  </div>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Please specify your other income source *
          </label>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Additional Income (Optional)
          </label>
          <div className="space-y-2">
            {secondaryOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={secondaryIncome.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSecondaryIncome([...secondaryIncome, option.value]);
                    } else {
                      setSecondaryIncome(secondaryIncome.filter(v => v !== option.value));
                    }
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
            onClick={() => {
              (window as any).__incomeTypeData = { skipped: true };
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Skip for now - I'll set this later
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

// Client Income Type Confirmation Component (Step 2)
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
    if (skipped) {
      return;
    }

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

      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!firmUser?.client_id) {
        throw new Error("Client record not found");
      }

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

      // Clear temporary data
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
        <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Skipped!
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          You can set your income type later in Settings.
        </p>
      </div>
    );
  }

  const selectedTypes = incomeTypes.filter(t => primaryIncome.includes(t.value));
  const selectedSecondary = secondaryOptions.filter(s => secondaryIncome.includes(s.value));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">📋</div>
        <p className="text-gray-600 dark:text-gray-400">
          Please review your selections before continuing
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Primary Income Sources ({selectedTypes.length})
        </h4>
        <div className="space-y-2">
          {selectedTypes.map(type => (
            <div key={type.value} className="flex items-center gap-3 p-3 bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {type.label}
                  {type.value === "other" && otherIncomeText && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      ({otherIncomeText})
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {type.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedSecondary.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Secondary Income ({selectedSecondary.length})
            </h4>
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

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      
      {saving && (
        <p className="text-sm text-blue-600 dark:text-blue-400">Saving...</p>
      )}
    </div>
  );
}