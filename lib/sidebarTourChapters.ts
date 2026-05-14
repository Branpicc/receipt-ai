/**
 * Per-role chapter definitions for the immersive sidebar tour.
 *
 * Each step either:
 *   - Highlights a specific element via a stable `data-tour=` attribute,
 *     OR
 *   - Renders a centered modal (selector: null) for content that's about
 *     a *page* rather than an element.
 *
 * `position` controls where the popover lands relative to the highlighted
 * element. Use "right" for sidebar items so the popover doesn't cover the
 * sidebar itself, "bottom" for in-page elements high on the screen, etc.
 *
 * Demo data is already seeded by /api/seed-demo-data when the tour starts,
 * so the user lands on every page with realistic content visible.
 */

export type TourPosition = "top" | "bottom" | "left" | "right" | "center";

export type TourStep = {
  id: string;
  route: string;
  selector: string | null;
  title: string;
  body: string;
  position?: TourPosition;
};

export type TourChapter = {
  id: string;
  title: string;
  steps: TourStep[];
};

const FIRM_ADMIN_CHAPTERS: TourChapter[] = [
  {
    id: "welcome",
    title: "Welcome",
    steps: [
      {
        id: "fa-welcome",
        route: "/dashboard",
        selector: null,
        title: "Welcome to Receipture",
        body:
          "Your firm is set up and we've populated three sample clients, fifteen sample receipts, and a placeholder accountant so you have something real to look at. We'll walk through the main sections — skip any chapter you don't want to see.",
        position: "center",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Your dashboard",
    steps: [
      {
        id: "fa-dashboard",
        route: "/dashboard",
        selector: null,
        title: "The dashboard",
        body:
          "This is your at-a-glance view of every client and recent activity across the firm. As an admin you don't upload receipts yourself — your accountants and clients do — but here's where you'll see what's coming in across the firm.",
        position: "center",
      },
    ],
  },
  {
    id: "receipts",
    title: "Receipts",
    steps: [
      {
        id: "fa-sidebar-receipts",
        route: "/dashboard",
        selector: '[data-tour="sidebar-receipts"]',
        title: "Receipts list",
        body:
          "Every receipt across all your clients lives under Operations → Receipts. Filter by client, status, or date. Click any row to see the full detail and audit trail.",
        position: "right",
      },
      {
        id: "fa-receipts-page",
        route: "/dashboard/receipts",
        selector: null,
        title: "What you can do here",
        body:
          "As an admin, you review receipts but can't upload them — that's your accountants' and clients' workflow. From any receipt's detail page you can request changes from the assigned accountant if something looks off.",
        position: "center",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    steps: [
      {
        id: "fa-sidebar-clients",
        route: "/dashboard/receipts",
        selector: '[data-tour="sidebar-clients"]',
        title: "Clients",
        body:
          "Manage every client your firm services here. Each gets a unique receipt-collection email address you can give them to forward receipts to.",
        position: "right",
      },
      {
        id: "fa-add-client",
        route: "/dashboard/clients",
        selector: '[data-tour="clients-add"]',
        title: "Add a real client",
        body:
          "When you're ready to add a real (non-demo) client, fill in the name and province here. They'll be assignable to one of your accountants.",
        position: "bottom",
      },
    ],
  },
  {
    id: "team",
    title: "Your team",
    steps: [
      {
        id: "fa-sidebar-team",
        route: "/dashboard/clients",
        selector: '[data-tour="sidebar-team"]',
        title: "Team",
        body:
          "Invite accountants here. The demo dataset includes one placeholder accountant ([Demo] Sarah Mitchell) so you can see what an active team looks like.",
        position: "right",
      },
      {
        id: "fa-team-invite",
        route: "/dashboard/team",
        selector: '[data-tour="team-invite"]',
        title: "Send invitations",
        body:
          "Click here to invite an accountant or a client by email. They'll get a Receipture-branded email with a one-click link to join your firm.",
        position: "bottom",
      },
    ],
  },
  {
    id: "email-inbox",
    title: "Email inbox",
    steps: [
      {
        id: "fa-sidebar-email",
        route: "/dashboard/team",
        selector: '[data-tour="sidebar-email-inbox"]',
        title: "Per-client receipt emails",
        body:
          "Each client gets a unique forwarding address. Anything they send there appears in this inbox, gets OCR'd, and lands in Receipts as a new entry.",
        position: "right",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & history",
    steps: [
      {
        id: "fa-sidebar-reports",
        route: "/dashboard/email-inbox",
        selector: '[data-tour="sidebar-reports-clients"]',
        title: "Client Reports",
        body:
          "Per-client and firm-wide PDF reports — monthly summaries, comprehensive year-to-date, AI-generated narrative summaries. Generate and share with one click.",
        position: "right",
      },
      {
        id: "fa-sidebar-edits",
        route: "/dashboard/email-inbox",
        selector: '[data-tour="sidebar-reports-edits"]',
        title: "Edit history & deletion requests",
        body:
          "Every receipt edit and every deletion request lives here. Full audit trail. Clients request deletions from their side; you (or your accountants) approve or deny here.",
        position: "right",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & wrap up",
    steps: [
      {
        id: "fa-sidebar-settings",
        route: "/dashboard/email-inbox",
        selector: '[data-tour="sidebar-settings"]',
        title: "Settings",
        body:
          "Theme, billing, password, and the rest of your account preferences live here. There's a dedicated Walk-throughs tab where you can replay this tour, replay onboarding, or clear the demo data.",
        position: "right",
      },
      {
        id: "fa-finish",
        route: "/dashboard",
        selector: null,
        title: "You're set",
        body:
          "When you're ready, clear the demo data from Settings → Walk-throughs (one button). Until then, every demo entity is labeled [Demo] and won't appear in your Excel or QuickBooks exports once you've added a real receipt. Welcome aboard.",
        position: "center",
      },
    ],
  },
];

const ACCOUNTANT_CHAPTERS: TourChapter[] = [
  {
    id: "welcome",
    title: "Welcome",
    steps: [
      {
        id: "ac-welcome",
        route: "/dashboard",
        selector: null,
        title: "Welcome to Receipture",
        body:
          "You've been invited to a firm. We've assigned you three sample clients with fifteen sample receipts so you can see what you'll be working with. Skip any chapter you don't need.",
        position: "center",
      },
    ],
  },
  {
    id: "receipts",
    title: "Your receipts",
    steps: [
      {
        id: "ac-sidebar-receipts",
        route: "/dashboard",
        selector: '[data-tour="sidebar-receipts"]',
        title: "Receipts",
        body:
          "Receipts from your assigned clients live here. Categorize them, edit details, resolve flags, or — when uploading on behalf of a client — drop in a photo from this page.",
        position: "right",
      },
      {
        id: "ac-receipt-detail",
        route: "/dashboard/receipts",
        selector: null,
        title: "Working a receipt",
        body:
          "Click any row to see the full detail. The category picker has every CRA-aligned tax category — start typing to filter. Save once and the receipt is queued for the client's monthly report.",
        position: "center",
      },
    ],
  },
  {
    id: "flags",
    title: "Flags",
    steps: [
      {
        id: "ac-sidebar-flags",
        route: "/dashboard/receipts",
        selector: '[data-tour="sidebar-flags"]',
        title: "Flagged receipts",
        body:
          "Anything our system catches — personal-card-used, missing data, mismatch between line items and total — surfaces here for review. The demo dataset includes one flagged receipt so you can practice resolving.",
        position: "right",
      },
    ],
  },
  {
    id: "clients",
    title: "Your clients",
    steps: [
      {
        id: "ac-sidebar-clients",
        route: "/dashboard/flags",
        selector: '[data-tour="sidebar-clients"]',
        title: "Clients you cover",
        body:
          "These are clients assigned to you specifically. The firm admin manages assignments. Click any client to see their receipts, monthly performance, and contact info.",
        position: "right",
      },
    ],
  },
  {
    id: "approvals",
    title: "Change requests",
    steps: [
      {
        id: "ac-sidebar-approvals",
        route: "/dashboard/clients",
        selector: '[data-tour="sidebar-approvals"]',
        title: "Approval requests",
        body:
          "When the firm admin requests changes on a receipt, it lands here. Make the edit, mark it complete, and the admin gets notified.",
        position: "right",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    steps: [
      {
        id: "ac-sidebar-reports",
        route: "/dashboard/approval-requests",
        selector: '[data-tour="sidebar-reports-clients"]',
        title: "Generate reports",
        body:
          "Generate per-client monthly or comprehensive reports. Download as PDF or Excel — Excel feeds straight into QuickBooks. Demo receipts are excluded automatically once any real receipt exists.",
        position: "right",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & wrap up",
    steps: [
      {
        id: "ac-sidebar-settings",
        route: "/dashboard/approval-requests",
        selector: '[data-tour="sidebar-settings"]',
        title: "Settings",
        body:
          "Your preferences, password, and account settings live here. The dedicated Walk-throughs tab is where you can replay this tour or onboarding any time.",
        position: "right",
      },
      {
        id: "ac-finish",
        route: "/dashboard",
        selector: null,
        title: "You're set",
        body:
          "Welcome to Receipture. The demo dataset is yours to explore — your firm admin can clear it from Settings → Walk-throughs whenever you're both ready to start fresh with real clients.",
        position: "center",
      },
    ],
  },
];

// Personal-account chapters live entirely under /dashboard/client and
// subroutes the personal user is allowed to visit. This is critical:
// if a step pointed at /dashboard the SidebarTour's route-sync effect
// would push the personal user back there, and the dashboard's
// router.replace to /dashboard/client would fire again — infinite
// loop. Keep every `route` here off of /dashboard root.
const PERSONAL_CHAPTERS: TourChapter[] = [
  {
    id: "welcome",
    title: "Welcome",
    steps: [
      {
        id: "p-welcome",
        route: "/dashboard/client",
        selector: null,
        title: "Welcome to Receipture",
        body:
          "Your account is set up. We'll do a quick spin through the sections you'll actually use — skip any chapter you don't want to see.",
        position: "center",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Your dashboard",
    steps: [
      {
        id: "p-dashboard",
        route: "/dashboard/client",
        selector: null,
        title: "Your dashboard",
        body:
          "This is your home screen. Upload receipts from the hero button, check budgets, see recent activity, and (if you're self-employed) your monthly net income — revenue minus deductibles, charted by month.",
        position: "center",
      },
    ],
  },
  {
    id: "receipts",
    title: "Receipts",
    steps: [
      {
        id: "p-receipts",
        route: "/dashboard/receipts",
        selector: null,
        title: "Your receipts",
        body:
          "Every receipt you've uploaded lives here. Click any row to see the full extracted detail. Three ways to add a new one: tap Upload at the top, forward your order email to your Receipture inbox address, or text a photo to your Receipture number.",
        position: "center",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & exports",
    steps: [
      {
        id: "p-reports",
        route: "/dashboard/reports",
        selector: null,
        title: "Reports & exports",
        body:
          "This is where you get tax-ready data out. The big green Master Excel button at the top produces a single .xlsx with a Summary, every receipt, a tab per CRA line, plus Personal and Capital Assets sheets — hand it to a tax preparer or use it yourself.",
        position: "center",
      },
      {
        id: "p-tax-codes",
        route: "/dashboard/tax-codes",
        selector: null,
        title: "CRA Tax Codes",
        body:
          "If you marked yourself self-employed during sign-up, this page shows your expenses grouped by CRA line (T2125, T776, T2200). Each line has its own 📥 Excel button for a focused per-line export.",
        position: "center",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    steps: [
      {
        id: "p-settings",
        route: "/dashboard/settings",
        selector: null,
        title: "Settings — cards, email, SMS",
        body:
          "Profile tab is where you register your card last-4 digits (so we can flag receipts paid on an unrecognised card) and toggle SMS reminders. Email Forwarding has your Receipture inbox address. Training has these walkthroughs as searchable modules.",
        position: "center",
      },
    ],
  },
];

export function getChaptersForRole(role: string): TourChapter[] {
  if (role === "personal") return PERSONAL_CHAPTERS;
  if (role === "firm_admin") return FIRM_ADMIN_CHAPTERS;
  if (role === "accountant") return ACCOUNTANT_CHAPTERS;
  return [];
}
