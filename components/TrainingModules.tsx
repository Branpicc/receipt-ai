"use client";

import { useState } from "react";

type Step = {
  title: string;
  content: string;
  tip?: string;
};

type Module = {
  id: string;
  title: string;
  description: string;
  icon: string;
  duration: string;
  steps: Step[];
};

// ── CLIENT MODULES ────────────────────────────────────────────────────────────
const clientModules: Module[] = [
  {
    id: "client-getting-started",
    title: "Welcome to ReceiptAI",
    description: "Everything you need to know to get started",
    icon: "🚀",
    duration: "3 min",
    steps: [
      {
        title: "What is ReceiptAI?",
        content: "ReceiptAI makes managing your business receipts simple. Instead of keeping paper receipts or manually entering expenses, you just upload a photo or forward an email — and our AI takes care of the rest.\n\nYour accountant can then review, categorize, and use your receipts for tax purposes without you needing to do anything extra.",
        tip: "The less you have to think about receipts, the better. That's what we're here for!",
      },
      {
        title: "Your Dashboard",
        content: "When you log in, your dashboard shows:\n\n• **My Receipts** — Total number of receipts submitted\n• **This Month** — Receipts submitted this month\n• **Categorized %** — How many have been processed by your accountant\n• **Budget Status** — How your spending compares to your monthly budgets\n• **Recent Receipts** — Your latest submissions",
        tip: "Check your dashboard weekly to stay on top of your expenses.",
      },
      {
        title: "Your Sidebar",
        content: "Use the left sidebar to navigate:\n\n• 🏠 **Dashboard** — Your home screen with stats and recent activity\n• 📁 **Receipts** — View all your submitted receipts\n• 📸 **Quick Capture** — Take a photo of a receipt with your camera\n• 💰 **Budget** — Set and track spending limits by category\n• 💬 **Messages** — Contact your accountant or get support\n• ⚙️ **Settings** — Update your profile, phone number, and preferences",
        tip: "Pin this app to your phone's home screen for quick access when you're on the go.",
      },
    ],
  },
  {
    id: "client-uploading",
    title: "Uploading Receipts",
    description: "Three easy ways to submit your receipts",
    icon: "📸",
    duration: "4 min",
    steps: [
      {
        title: "Option 1: Upload from Your Device",
        content: "The easiest way to upload from your phone or computer:\n\n1. Go to your **Dashboard**\n2. Tap or click the upload area that says 'Click to upload or drag here'\n3. Select one or more receipt images from your camera roll or files\n4. Wait a few seconds — our AI extracts all the details automatically\n\nSupported formats: JPG, PNG, PDF, HEIC",
        tip: "You can select multiple receipts at once to save time.",
      },
      {
        title: "Option 2: Quick Camera Capture",
        content: "Take a photo directly with your phone camera:\n\n1. Tap **Quick Capture** (📸) in the sidebar\n2. Allow camera access when prompted\n3. Point your camera at the receipt\n4. Tap **Take Photo**\n5. Review the photo — if it looks clear, tap **Submit Receipt**\n\nThis is perfect for paper receipts right after a purchase.",
        tip: "Take photos in good lighting and make sure all text is readable for best results.",
      },
      {
        title: "Option 3: Email Forwarding",
        content: "Forward digital receipts directly to your personal inbox:\n\n1. Find your receipt email address in **Settings → Profile** or on your Dashboard\n2. Save it as a contact on your phone (e.g. 'ReceiptAI Inbox')\n3. When you get a receipt email from Amazon, Shopify, etc. — just forward it!\n4. We'll automatically extract all the details\n\nYou'll then receive an SMS asking for the purpose.",
        tip: "This is the easiest method for online purchases — forward and forget!",
      },
      {
        title: "After You Upload",
        content: "Once you submit a receipt, here's what happens:\n\n1. Our AI reads the receipt and extracts vendor, date, total, and tax\n2. You'll receive a text message asking for the purpose of the expense\n3. Reply to the text with a number or your own description\n4. Your accountant reviews and approves the category\n5. The receipt is ready for tax purposes\n\nYou can always view the status of any receipt under **Receipts**.",
        tip: "Reply to SMS messages while the purchase is fresh in your memory for best accuracy.",
      },
    ],
  },
  {
    id: "client-sms",
    title: "SMS Notifications",
    description: "How to reply to receipt purpose requests",
    icon: "📱",
    duration: "3 min",
    steps: [
      {
        title: "What is the SMS Feature?",
        content: "After every receipt you upload, ReceiptAI sends you a text message asking what the expense was for. This helps your accountant properly categorize it for tax purposes.\n\nExample message:\n\n'Good afternoon, [Your Name]. We received your receipt from Staples for $45.99. What was the purpose of this expense?\n1. Office supplies\n2. Business equipment\n3. Other'\n\nAll you do is reply!",
        tip: "Save the ReceiptAI number as a contact so you recognize our texts.",
      },
      {
        title: "How to Reply",
        content: "Replying is simple — just text back:\n\n• **Reply with a number** — Type '1', '2', or '3' to select from the suggested options\n• **Reply in your own words** — Type anything like 'printer paper for the office' and our AI will clean it up into a professional record\n\nBoth methods work great — use whichever is faster for you.",
        tip: "You don't need to be formal — plain English works perfectly.",
      },
      {
        title: "Changing Your SMS Timing",
        content: "You can choose when you receive SMS messages:\n\n• **Instantly** — Right after each upload (recommended)\n• **5 or 30 minutes later** — A short delay\n• **1 or 4 hours later** — Batch during breaks\n• **End of day** — One summary message at your chosen time\n\nTo change this, go to **Settings → Profile** and scroll to your SMS preferences.",
        tip: "If you upload many receipts throughout the day, 'End of day' keeps things tidy.",
      },
      {
        title: "Setting Up Your Phone Number",
        content: "To receive SMS messages, you need to add your phone number:\n\n1. Go to **Settings → Profile**\n2. Scroll down to SMS Notifications\n3. Toggle it on and enter your mobile number\n4. Choose your preferred timing\n5. Save\n\nYou can disable SMS at any time from the same screen.",
        tip: "Canadian and US numbers are both supported.",
      },
    ],
  },
  {
    id: "client-budget",
    title: "Budget Tracking",
    description: "Set limits and monitor your spending",
    icon: "💰",
    duration: "3 min",
    steps: [
      {
        title: "Why Set a Budget?",
        content: "Budget tracking helps you:\n\n• Know exactly how much you're spending in each category\n• Get warned before you overspend\n• Have accurate numbers ready for tax time\n• Avoid surprises at year-end\n\nYour accountant may also use your budget information to advise you on deductions.",
        tip: "Even rough budgets are better than none — you can always adjust them later.",
      },
      {
        title: "Setting Your Budgets",
        content: "To set monthly spending limits:\n\n1. Click **Budget** (💰) in the sidebar\n2. You'll see spending categories like Meals, Fuel, Office Supplies\n3. Enter a monthly dollar limit for each category\n4. Click Save\n\nYour dashboard will then show how much you've spent vs. your limit for the current month.",
        tip: "Start with your biggest expense categories first.",
      },
      {
        title: "Reading Your Budget Status",
        content: "On your dashboard, each budget shows a progress bar:\n\n• 🟢 **Green** — Under 80% of budget used\n• 🟠 **Orange** — Between 80-100% — approaching your limit\n• 🔴 **Red** — Over budget\n\nThe numbers show: **Amount Spent / Monthly Limit**\n\nExample: $340 / $500 means you've spent $340 of your $500 meal budget this month.",
        tip: "Check your budget status mid-month so you can adjust spending if needed.",
      },
    ],
  },
  {
    id: "client-messages",
    title: "Messaging Your Accountant",
    description: "Ask questions and get help without leaving the app",
    icon: "💬",
    duration: "2 min",
    steps: [
      {
        title: "The Messages Section",
        content: "The **Messages** section (💬 in your sidebar) has two tabs:\n\n• **Accountant** — Send messages directly to your accountant. Use this for questions about specific receipts, categories, or your account.\n• **Support** — Chat with our AI support assistant for help with using ReceiptAI. If the AI can't solve your problem, it escalates to our team.",
        tip: "Use Messages instead of email — your accountant can see your receipt history right alongside the conversation.",
      },
      {
        title: "Starting a Conversation",
        content: "To message your accountant:\n\n1. Click **Messages** in the sidebar\n2. Make sure you're on the **Accountant** tab\n3. Click **+ New Conversation**\n4. Enter a subject (e.g. 'Question about my Staples receipt')\n5. Click **Start Conversation**\n6. Type your message and press Enter or click Send\n\nYour accountant will reply within the app.",
        tip: "Be specific in your subject line — it helps your accountant find the right receipt faster.",
      },
      {
        title: "Getting AI Support",
        content: "For help with using ReceiptAI:\n\n1. Click **Messages** in the sidebar\n2. Go to the **Support** tab\n3. Click **+ New Conversation**\n4. Type your question as the subject — the AI will respond immediately\n5. Continue the conversation until your issue is resolved\n\nIf the AI can't help, click **Escalate to Support** and our team will follow up within 24 hours.",
        tip: "The AI knows everything about ReceiptAI — try asking it anything!",
      },
    ],
  },
];

// ── ACCOUNTANT MODULES ────────────────────────────────────────────────────────
const accountantModules: Module[] = [
  {
    id: "accountant-getting-started",
    title: "Getting Started as an Accountant",
    description: "Your role, access, and daily workflow",
    icon: "🚀",
    duration: "4 min",
    steps: [
      {
        title: "Your Role in ReceiptAI",
        content: "As an accountant, you are responsible for:\n\n• Processing and categorizing receipts for your assigned clients\n• Reviewing emailed receipts from the Email Inbox\n• Resolving flags raised by the system\n• Setting purposes for expenses that need context\n• Generating reports for tax purposes\n\nYou can only see receipts from clients assigned to you by the firm admin.",
        tip: "Check with your firm admin if you don't see any clients — you may not have been assigned yet.",
      },
      {
        title: "Your Daily Workflow",
        content: "A typical day as an accountant in ReceiptAI:\n\n1. Check **Email Inbox** for new emailed receipts to approve or reject\n2. Go to **Receipts** and filter by 'Needs Review'\n3. Approve or correct AI-suggested categories\n4. Set purpose for receipts that need context\n5. Resolve any open flags\n6. Check **Messages** for client questions\n\nThe more consistently you process receipts, the easier tax season becomes.",
        tip: "Processing receipts weekly is much easier than doing it all at once before a deadline.",
      },
      {
        title: "Navigating Your Dashboard",
        content: "Your dashboard shows firm-wide stats with a client filter:\n\n• Use the **Client Selector** at the top to filter everything by a specific client\n• **Total Receipts** — All receipts for the selected client or firm\n• **Needs Review** — Receipts waiting for your attention\n• **Flagged Issues** — Receipts with potential problems\n• **Recent Uploads** — Latest activity\n\nThe sidebar has everything organized under Operations, Team & Clients, and Reports.",
        tip: "Use the Client Selector when working on a specific client to stay focused.",
      },
    ],
  },
  {
    id: "accountant-clients",
    title: "Adding & Managing Clients",
    description: "How to add clients and set them up",
    icon: "👥",
    duration: "5 min",
    steps: [
      {
        title: "Adding a New Client",
        content: "To add a client to the system:\n\n1. Go to **Team & Clients → Clients**\n2. Fill in the client name, province, and timezone\n3. Click **Create Client**\n4. The client gets a unique client code and email alias automatically\n\nOnce created, you can invite them to the platform so they can log in and upload receipts themselves.",
        tip: "Set the province correctly — it affects which tax rates apply to their receipts.",
      },
      {
        title: "Setting Up the Client Email Alias",
        content: "Each client gets a unique email address for forwarding receipts:\n\n1. Go to **Clients** and find the client\n2. Click the ✏️ Edit button next to their email alias\n3. Set a custom alias like 'johnsmith' → johnsmith@receipts.example.com\n4. Click Save\n\nShare this email address with your client so they can forward receipts to it.",
        tip: "Set a memorable alias early — clients use this address for all their email forwarding.",
      },
      {
        title: "Inviting the Client to Log In",
        content: "To give your client access to their own dashboard:\n\n1. Go to **Team & Clients → Team**\n2. Click **Invite User**\n3. Enter the client's email address\n4. Select **Client** as their role\n5. Assign them to the correct client account\n6. Click Send Invitation\n\nThe client will receive an email with a link to set up their account.",
        tip: "Walk clients through the onboarding tour the first time they log in.",
      },
      {
        title: "Viewing Client Details",
        content: "Click any client name in the Clients list to open their full profile:\n\n• **Overview** — Client info, income type, SMS status, recent receipts\n• **Flags** — All flags ever raised with resolution notes and patterns\n• **Cards** — Registered business and personal cards\n• **Edit History** — All changes made to their receipts\n\nThis gives you a complete picture of each client's expense history.",
        tip: "Review the Flags tab before client meetings to identify any spending patterns to discuss.",
      },
    ],
  },
  {
    id: "accountant-receipts",
    title: "Processing Receipts",
    description: "Categorizing, reviewing, and approving receipts",
    icon: "📋",
    duration: "6 min",
    steps: [
      {
        title: "Finding Receipts to Review",
        content: "To find receipts that need your attention:\n\n1. Go to **Operations → Receipts**\n2. Filter by **Status: Needs Review**\n3. Or use the Client Selector to focus on one client\n\nReceipts show vendor, date, amount, and current status at a glance. Click any receipt to open the detail view.",
        tip: "Sort by date (oldest first) to process receipts in order.",
      },
      {
        title: "Approving Categories",
        content: "Our AI suggests a category for every receipt. Your job is to review and approve:\n\n1. Open a receipt\n2. See the AI's suggested category and confidence score\n3. If it looks right — click **✓ Approve Category**\n4. If it's wrong — click **Change Category** and select the correct one\n5. Optionally add or edit the **Purpose of expense**\n\nCommon categories: Office Supplies, Meals & Entertainment, Vehicle Expenses, Professional Fees, Advertising.",
        tip: "If confidence is below 80%, always double-check the category before approving.",
      },
      {
        title: "Setting Expense Purpose",
        content: "The purpose explains WHY the expense was incurred — essential for CRA audits:\n\n• Clients can set purpose by replying to SMS\n• You can also set or edit it manually in the receipt detail\n• Good example: 'Lunch with client John Smith to discuss Q3 project scope'\n• Bad example: 'Lunch'\n\nClick **Save purpose** after entering the description.",
        tip: "The more specific the purpose, the better protection in case of a CRA audit.",
      },
      {
        title: "Editing Receipt Details",
        content: "If the AI didn't capture information correctly, you can fix it:\n\n1. Scroll to the bottom of the receipt detail page\n2. Click **✏️ Didn't capture right? Edit details**\n3. Fix the vendor name, date, total, or tax amount\n4. Click **Save Changes**\n5. Select a reason for the change (e.g. 'Total amount was wrong')\n\nAll edits are logged with before/after values for your audit trail.",
        tip: "Always provide an accurate reason — this is recorded and visible in reports.",
      },
      {
        title: "Line Items",
        content: "For receipts with multiple items (e.g. a Staples receipt with office supplies and a printer):\n\n• View line items in the **Digital Receipt** section\n• Switch between Card view and Table view\n• Click **+ Add Item** to add missing items\n• Edit quantities and prices in Table view\n• Click **Save Items** when done\n\nIf items belong to different categories, use the **Split Items** feature when a flag is raised.",
        tip: "Accurate line items help catch category mismatches automatically.",
      },
    ],
  },
  {
    id: "accountant-flags",
    title: "Handling Flags",
    description: "Reviewing and resolving flagged receipts",
    icon: "🚩",
    duration: "4 min",
    steps: [
      {
        title: "What are Flags?",
        content: "Flags are automatic alerts raised when something looks wrong or needs attention:\n\n• 🔴 **Personal card used** — Client paid with a registered personal card\n• ⚠️ **Unrecognized card** — Card not registered as business or personal\n• ⚠️ **Purpose mismatch** — Description doesn't match the vendor type\n• ⚠️ **Line item mismatch** — Total doesn't match sum of individual items\n\nGo to **Operations → Flags** to see all unresolved flags across all clients.",
        tip: "Check the Flags page at least once a week.",
      },
      {
        title: "Resolving Flags",
        content: "To resolve a flag:\n\n1. Open the receipt with the flag\n2. Review the flag message at the top of the page\n3. For card flags — click **Resolve** and select a reason:\n   • 'Client reimbursement — will be paid back'\n   • 'Business card was unavailable'\n   • 'This is a business card — adding to client cards'\n4. For other flags — click **Resolve** to dismiss\n\nAll resolution notes are saved permanently to the audit trail.",
        tip: "Never resolve a flag without understanding why it was raised.",
      },
      {
        title: "Card Flags Explained",
        content: "Card flags are raised when a receipt's payment card doesn't match the client's registered business cards:\n\n• Ask your client to register their business cards in **Settings → Profile → My Business Cards**\n• Once registered, business card purchases won't trigger flags\n• Personal card purchases will always flag — review each one carefully\n\nPatterns matter: if a client regularly uses personal cards, discuss it with them.",
        tip: "Encourage all clients to register their cards during onboarding.",
      },
      {
        title: "Splitting Mismatched Items",
        content: "When a receipt has items from different categories (e.g. a restaurant that also sold office supplies):\n\n1. Open the flagged receipt\n2. See the 'Line item mismatch' flag\n3. Click **Split Items**\n4. Confirm the split — ReceiptAI creates two separate receipts\n5. Each receipt gets its own category and tax calculation\n6. A PDF documentation record is generated automatically\n\nThis keeps your records clean and defensible.",
        tip: "Split receipts are the cleanest way to handle mixed-category purchases.",
      },
    ],
  },
  {
    id: "accountant-email",
    title: "Email Inbox",
    description: "Processing receipts forwarded by email",
    icon: "📧",
    duration: "3 min",
    steps: [
      {
        title: "How Email Receipts Work",
        content: "Clients can forward receipt emails to their unique inbox address (e.g. johnsmith@receipts.example.com). These appear in your **Email Inbox** for review.\n\nThe system automatically:\n• Extracts attachments (PDF, images)\n• Runs OCR to extract vendor, date, and total\n• Creates a pending email receipt record\n• Sends the client an SMS asking for the purpose",
        tip: "Email receipts are great for online purchases where there's no paper receipt.",
      },
      {
        title: "Approving or Rejecting",
        content: "To process email receipts:\n\n1. Go to **Operations → Email Inbox**\n2. Review each pending email receipt\n3. Check the extracted data — vendor, date, total\n4. Click **Approve** to add it as a full receipt\n5. Or click **Reject** if it's not a valid business receipt\n\nApproved emails become full receipts that appear in the Receipts list.",
        tip: "Rejected emails are still logged — clients can see their submission was received.",
      },
      {
        title: "When Extraction Fails",
        content: "Sometimes OCR can't extract data from an email (e.g. if the receipt is in an unusual format):\n\n• The email receipt will show blank vendor/amount\n• Approve it anyway and then manually enter the details in the receipt detail\n• Or use the Edit Details feature to correct the extracted data\n\nThis is rare but happens with some bank statements or custom receipt formats.",
        tip: "Ask clients to forward the original receipt email, not a screenshot.",
      },
    ],
  },
  {
    id: "accountant-reports",
    title: "Reports & Tax Codes",
    description: "Generating reports and understanding tax codes",
    icon: "📊",
    duration: "4 min",
    steps: [
      {
        title: "Tax Codes (T2125)",
        content: "Go to **Reports → Tax Codes** to see a T2125 summary:\n\n• Every approved category is mapped to a CRA T2125 line number\n• The summary shows total spending per line for the year\n• Filter by client and date range\n• Export to CSV for use in tax software\n\nThis is the most important report for self-employed clients filing their taxes.",
        tip: "Run the T2125 report before every client meeting during tax season.",
      },
      {
        title: "Client Monthly Reports",
        content: "Go to **Reports → Client Reports** to see monthly summaries:\n\n• Total spend, tax, and receipt count per month\n• Category breakdown with pie chart\n• Budget vs actual comparison\n• Month-over-month trends\n\nClients can also see their own reports from their dashboard.",
        tip: "Share monthly reports with clients to keep them informed and build trust.",
      },
      {
        title: "Edit History Report",
        content: "Go to **Reports → Edit History** to see all receipt edits:\n\n• Filter by client and date range\n• See exactly what was changed, by whom, and why\n• Before/after values for every field\n• Direct link to the receipt\n\nThis is your audit trail — keep it clean by always providing accurate edit reasons.",
        tip: "Review edit history before tax season to catch any data quality issues.",
      },
      {
        title: "Exporting Data",
        content: "To export receipts to CSV:\n\n1. Go to **Settings → Advanced**\n2. Click **Export Receipts (CSV)**\n3. The file downloads with date, vendor, amount, category, payment method, and status\n\nYou can open this in Excel or import it into accounting software.",
        tip: "Export monthly for your own records, especially for clients on paper filing.",
      },
    ],
  },
  {
    id: "accountant-sms",
    title: "SMS Setup for Clients",
    description: "Setting up and managing client SMS notifications",
    icon: "📱",
    duration: "3 min",
    steps: [
      {
        title: "How Client SMS Works",
        content: "After every receipt upload, ReceiptAI texts the client asking for the purpose:\n\n1. Client uploads a receipt\n2. AI extracts vendor, amount, date\n3. Client receives: 'Hi [Name], we received your receipt from [Vendor] for $X. What was the purpose?'\n4. Client replies with a number or plain text\n5. AI saves the purpose to the receipt automatically\n\nThis eliminates the need for you to chase clients for expense descriptions.",
        tip: "Clients who use SMS consistently make your job significantly easier.",
      },
      {
        title: "Helping Clients Set Up SMS",
        content: "If a client isn't receiving SMS messages, walk them through setup:\n\n1. Client logs in and goes to **Settings → Profile**\n2. Scroll down to SMS Notifications\n3. Toggle it on and enter their mobile number\n4. Choose preferred timing (Instant is recommended)\n5. Save\n\nAlternatively, during the onboarding tour, the SMS setup step handles this automatically.",
        tip: "Do this during the initial client onboarding call — it takes 2 minutes.",
      },
      {
        title: "SMS Timing Options",
        content: "Clients can choose when they receive texts:\n\n• **Instant** — Right after upload (best for accuracy)\n• **5 or 30 minutes** — Short delay\n• **1 or 4 hours** — Batch responses\n• **End of day** — One summary at a set time (good for busy clients)\n\nYou can see each client's SMS settings in their Client Detail profile under Overview.",
        tip: "Recommend 'Instant' for most clients — replies are more accurate when fresh.",
      },
    ],
  },
];

// ── FIRM ADMIN MODULES ────────────────────────────────────────────────────────
const firmAdminModules: Module[] = [
  {
    id: "admin-getting-started",
    title: "Your Role as Firm Admin",
    description: "What you oversee and how to use your dashboard",
    icon: "🏢",
    duration: "4 min",
    steps: [
      {
        title: "What Firm Admins Do",
        content: "As a Firm Admin, you have complete oversight of your firm's operations:\n\n• **View** all receipts and data across all clients (read-only)\n• **Manage** your team of accountants\n• **Assign** clients to accountants\n• **Monitor** overall firm performance\n• **Control** billing and subscription\n• **Request changes** from accountants via the receipt detail page\n\nYou do NOT process or edit receipts directly — that's your accountants' job.",
        tip: "Your read-only access ensures accountability — you can see everything without accidentally changing it.",
      },
      {
        title: "Your Dashboard",
        content: "Your firm overview dashboard shows:\n\n• **Total Receipts** — All receipts across the firm\n• **Categorized %** — Overall completion rate\n• **Needs Review** — Receipts waiting for accountant attention\n• **Flagged Issues** — Active problems across all clients\n• **Email Processing** — Email receipt stats\n• **Team Overview** — Accountant and client counts\n\nUse the **Client Selector** to filter everything down to a single client.",
        tip: "Check the Flagged Issues count daily — flags left unresolved create problems at tax time.",
      },
      {
        title: "Requesting Changes",
        content: "If you spot an issue on a receipt, you can't edit it directly — but you can request a change:\n\n1. Open the receipt\n2. Click **📝 Request Changes** button\n3. Describe what needs to be fixed\n4. Your accountant receives a notification\n5. They make the change and mark it resolved\n\nThis keeps a clean record of all review decisions.",
        tip: "Be specific in your change requests — 'Category should be Vehicle Expenses, not Office Supplies' is better than 'Category is wrong'.",
      },
    ],
  },
  {
    id: "admin-setup",
    title: "Setting Up Your Firm",
    description: "Adding clients, inviting accountants, and getting organized",
    icon: "⚙️",
    duration: "6 min",
    steps: [
      {
        title: "Step 1: Add Your Clients",
        content: "Start by adding all your clients:\n\n1. Go to **Team & Clients → Clients**\n2. Enter the client name, province, and timezone\n3. Click **Create Client**\n4. Set a custom email alias (e.g. 'johnsmith')\n5. Repeat for each client\n\nEach client gets a unique email address for forwarding receipts automatically.",
        tip: "Add all clients before inviting accountants — you'll need them for assignment.",
      },
      {
        title: "Step 2: Invite Your Accountants",
        content: "Add your accounting team:\n\n1. Go to **Team & Clients → Team**\n2. Click **Invite User**\n3. Enter the accountant's email address\n4. Select **Accountant** as their role\n5. Click Send Invitation\n\nThey'll receive an email to set up their account. The firm admin account does NOT count against your accountant seat limit.",
        tip: "Invite all accountants before assigning clients to them.",
      },
      {
        title: "Step 3: Assign Clients to Accountants",
        content: "Match clients with accountants:\n\n1. Go to **Team & Clients → Clients**\n2. Find a client in the list\n3. Use the dropdown next to their name to select an accountant\n4. Repeat for all clients\n\nAccountants can only see receipts from their assigned clients — this keeps workloads organized and data private.",
        tip: "Balance the workload — don't assign all clients to one accountant.",
      },
      {
        title: "Step 4: Invite Your Clients",
        content: "Give clients access to their own dashboard:\n\n1. Go to **Team & Clients → Team**\n2. Click **Invite User**\n3. Enter the client's email\n4. Select **Client** as their role\n5. Assign to their client account\n\nClients can then upload receipts, reply to SMS, and view their own data without seeing anyone else's.",
        tip: "Walk clients through their first login — 5 minutes of onboarding saves hours of questions later.",
      },
      {
        title: "Step 5: Set Up Email Aliases",
        content: "Make sure every client has a clean email alias:\n\n1. Go to **Clients**\n2. Click ✏️ Edit next to each client's email\n3. Set a memorable alias (firstname, company name, etc.)\n4. Share the full address with the client: alias@receipts.example.com\n\nThis is the address clients forward receipt emails to.",
        tip: "Use consistent naming conventions — e.g. firstname-lastname or companyname.",
      },
    ],
  },
  {
    id: "admin-monitoring",
    title: "Monitoring Your Firm",
    description: "Keeping track of performance and catching issues",
    icon: "📊",
    duration: "4 min",
    steps: [
      {
        title: "Analytics Dashboard",
        content: "Go to **Reports → Analytics** for deep-dive metrics:\n\n• Receipt volume over time\n• Categorization completion rates by accountant\n• Flag frequency by client\n• Email receipt processing stats\n• Revenue trends by category\n\nFilter by date range and client to drill down into specific areas.",
        tip: "Use analytics to identify which clients or accountants need the most attention.",
      },
      {
        title: "Client Detail Profiles",
        content: "Click any client name to open their full profile — your most powerful oversight tool:\n\n• **Overview** — Stats, recent receipts, income type, SMS status\n• **Flags** — Every flag ever raised with resolution notes\n• **Cards** — Registered business/personal cards\n• **Edit History** — Every change made to their receipts\n\nLook for patterns: frequent personal card use, repeated edits to the same fields, unresolved flags.",
        tip: "Review client profiles quarterly to catch issues before they compound.",
      },
      {
        title: "Flags Overview",
        content: "Go to **Operations → Flags** to see all active flags:\n\n• Filter by severity (high, warn, info)\n• Filter by flag type\n• See which receipts need attention\n• Track resolution progress\n\nHigh severity flags (personal card used) should be reviewed within 24 hours. Warning flags can be batched weekly.",
        tip: "A firm with 0 unresolved flags at tax time is a firm that had a smooth year.",
      },
      {
        title: "Edit History Report",
        content: "Go to **Reports → Edit History** to see all receipt changes across the firm:\n\n• Filter by client or date range\n• See who made each change and why\n• Before/after values for every field\n• Spot patterns of data quality issues\n\nIf you see the same field being corrected repeatedly for a client, the OCR might need help — encourage better photo quality.",
        tip: "Share edit history with accountants in team meetings to improve data quality.",
      },
    ],
  },
  {
    id: "admin-billing",
    title: "Billing & Plan Management",
    description: "Understanding your subscription and managing costs",
    icon: "💳",
    duration: "3 min",
    steps: [
      {
        title: "Your Current Plan",
        content: "Go to **Settings → Billing** to see your current plan:\n\n• **Starter** — Up to 5 clients, 1 accountant seat, $49/month\n• **Professional** — Up to 20 clients, 3 accountant seats, $199/month\n• **Enterprise** — Unlimited clients and accountants, $349/month\n\nAll paid plans include unlimited receipts. You're billed per firm, not per user.",
        tip: "The firm admin account does NOT count against your accountant seat limit.",
      },
      {
        title: "Monitoring Usage",
        content: "Your billing page shows current usage:\n\n• **Clients** — How many active clients vs. your plan limit\n• **Accountants** — How many accountant seats used vs. available\n• **Receipts** — Always unlimited on paid plans\n\nUpgrade before you hit your limits to avoid disruption to your team.",
        tip: "Check usage monthly — growing firms can hit limits quickly.",
      },
      {
        title: "Upgrading or Cancelling",
        content: "To change your plan:\n\n• Click **Change Plan** on the Billing page\n• Select your new plan and complete checkout via Stripe\n• Upgrades take effect immediately\n• Downgrades take effect at the next billing cycle\n\nIf you want to cancel, click **Cancel Plan** — you may be offered a retention discount first.",
        tip: "Contact support before cancelling — we may be able to resolve your concerns.",
      },
    ],
  },
  {
    id: "admin-messages",
    title: "Messaging & Communication",
    description: "Staying connected with your team and clients",
    icon: "💬",
    duration: "3 min",
    steps: [
      {
        title: "The Messages Section",
        content: "Go to **Team & Clients → Messages** to access firm-wide conversations:\n\n• **Clients tab** — Conversations between accountants and clients\n• **Support tab** — Your own AI support conversations\n\nAs a firm admin, you can see all client conversations to monitor communication quality.",
        tip: "Check messages weekly to ensure accountants are responding to clients promptly.",
      },
      {
        title: "Messaging Accountants",
        content: "To send a message to an accountant:\n\n1. Go to **Messages → Clients** tab\n2. Click **+ New Conversation**\n3. Select the accountant's client\n4. Enter a subject\n5. Start the conversation\n\nUse this for specific receipt feedback, workload discussions, or quality reviews.",
        tip: "Be constructive in messages — they're part of the permanent record.",
      },
      {
        title: "Getting Support",
        content: "For help with ReceiptAI:\n\n1. Go to **Messages → Support** tab\n2. Start a new conversation with your question\n3. Our AI responds immediately with step-by-step help\n4. If unresolved, click **Escalate to Support** for human assistance\n\nOur team responds to escalations within 24 hours.",
        tip: "The AI knows the entire ReceiptAI platform — try it before escalating.",
      },
    ],
  },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
type TrainingModulesProps = {
  userRole: string;
  isPlanEnterprise: boolean;
};

export default function TrainingModules({ userRole, isPlanEnterprise }: TrainingModulesProps) {
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [completedModules, setCompletedModules] = useState<string[]>([]);

  function getModules(): Module[] {
    if (userRole === "client") return clientModules;
    if (userRole === "accountant") return accountantModules;
    if (userRole === "firm_admin" || userRole === "owner") return firmAdminModules;
    return [];
  }

  const modules = getModules();

  function openModule(module: Module) {
    setActiveModule(module);
    setActiveStep(0);
  }

  function nextStep() {
    if (!activeModule) return;
    if (activeStep < activeModule.steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      setCompletedModules(prev => [...new Set([...prev, activeModule.id])]);
      setActiveModule(null);
      setActiveStep(0);
    }
  }

  function prevStep() {
    if (activeStep > 0) setActiveStep(prev => prev - 1);
  }

  if (!isPlanEnterprise) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎓</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Training Modules</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          Interactive role-specific training modules are available on the Enterprise plan. Upgrade to access step-by-step guides tailored to each member of your team.
        </p>
        <a
          href="/dashboard/billing"
          className="px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg transition-colors inline-block"
        >
          Upgrade to Enterprise →
        </a>
      </div>
    );
  }

  if (activeModule) {
    const step = activeModule.steps[activeStep];
    const isLastStep = activeStep === activeModule.steps.length - 1;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setActiveModule(null); setActiveStep(0); }}
            className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
          >
            ← Back to modules
          </button>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {activeModule.icon} {activeModule.title}
          </span>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span>Step {activeStep + 1} of {activeModule.steps.length}</span>
            <span>{Math.round(((activeStep + 1) / activeModule.steps.length) * 100)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
            <div
              className="bg-accent-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((activeStep + 1) / activeModule.steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{step.title}</h3>
          <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {step.content.split('\n').map((line, i) => {
              const parts = line.split('**');
              return (
                <p key={i} className={line === '' ? 'mt-3' : 'mb-1'}>
                  {parts.map((part, j) =>
                    j % 2 === 1
                      ? <strong key={j} className="text-gray-900 dark:text-white">{part}</strong>
                      : part
                  )}
                </p>
              );
            })}
          </div>
          {step.tip && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 <strong>Tip:</strong> {step.tip}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={prevStep}
            disabled={activeStep === 0}
            className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50 transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={nextStep}
            className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isLastStep ? "✓ Complete Module" : "Next →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Training Modules</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Step-by-step guides tailored to your role
        </p>
        {completedModules.length > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            ✅ {completedModules.length} of {modules.length} modules completed
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(module => {
          const isCompleted = completedModules.includes(module.id);
          return (
            <button
              key={module.id}
              onClick={() => openModule(module)}
              className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                isCompleted
                  ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                  : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-accent-300 dark:hover:border-accent-600"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-3xl">{module.icon}</span>
                {isCompleted && <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Done</span>}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{module.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{module.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                <span>⏱ {module.duration}</span>
                <span>•</span>
                <span>{module.steps.length} steps</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}