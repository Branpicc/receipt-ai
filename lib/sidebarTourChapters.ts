/**
 * Per-role chapter definitions for the immersive sidebar tour.
 *
 * Each chapter groups one or more steps. Each step either highlights a
 * specific element (selector) or shows a centered modal (selector=null).
 * If a step's `route` differs from the current path the tour engine will
 * router.push() before rendering it.
 *
 * Real per-role content lands in §4 of Sprint 5b. For §3 the engine is
 * being shipped with a minimal placeholder set so the architecture can
 * be smoke-tested end-to-end against real demo data first.
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

const PLACEHOLDER_FIRM_ADMIN: TourChapter[] = [
  {
    id: "welcome",
    title: "Welcome",
    steps: [
      {
        id: "welcome-1",
        route: "/dashboard",
        selector: null,
        title: "Welcome to Receipture",
        body:
          "Your firm is set up and your dashboard is populated with sample data so you have something to look at. We'll walk through the main sections together — skip any chapter or step you don't want to see.",
        position: "center",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    steps: [
      {
        id: "dashboard-overview",
        route: "/dashboard",
        selector: null,
        title: "Your dashboard",
        body:
          "This is your at-a-glance view of every client and recent activity across the firm. As an admin you don't upload receipts — your accountants do, on behalf of clients. Here's where you'll see what's coming in.",
        position: "center",
      },
    ],
  },
  {
    id: "receipts",
    title: "Receipts",
    steps: [
      {
        id: "receipts-page",
        route: "/dashboard/receipts",
        selector: null,
        title: "Receipts list",
        body:
          "Every receipt across all your clients lives here. Filter by client, status, or date. Click any row to see the full detail and the audit trail.",
        position: "center",
      },
    ],
  },
];

const PLACEHOLDER_ACCOUNTANT: TourChapter[] = [
  {
    id: "welcome",
    title: "Welcome",
    steps: [
      {
        id: "welcome-1",
        route: "/dashboard",
        selector: null,
        title: "Welcome to Receipture",
        body:
          "You've been invited to a firm. We've populated some sample clients and receipts so you can see what you'll be working with. Skip any chapter you don't need.",
        position: "center",
      },
    ],
  },
  {
    id: "receipts",
    title: "Receipts",
    steps: [
      {
        id: "receipts-page",
        route: "/dashboard/receipts",
        selector: null,
        title: "Your assigned receipts",
        body:
          "These are receipts from your assigned clients. You can categorize, edit, resolve flags, and request changes here.",
        position: "center",
      },
    ],
  },
];

export function getChaptersForRole(role: string): TourChapter[] {
  if (role === "firm_admin") return PLACEHOLDER_FIRM_ADMIN;
  if (role === "accountant") return PLACEHOLDER_ACCOUNTANT;
  return [];
}
