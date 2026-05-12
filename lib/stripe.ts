// lib/stripe.ts - Server-side Stripe client
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
});

// Price IDs from env
export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_PRICE_STARTER!,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL!,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE!,
  // Personal — single-user plan with 7-day trial. Standalone from the
  // firm tiers; firms.account_type='personal' means we route billing
  // here regardless of the firm-tier price IDs above. Annual is $54.99
  // (~34% off the $6.99×12 = $83.88 monthly cost).
  PERSONAL: process.env.STRIPE_PRICE_PERSONAL!,
  PERSONAL_ANNUAL: process.env.STRIPE_PRICE_PERSONAL_ANNUAL!,
};

// Plan limits for firm version
// - receipts: unlimited for all paid tiers (-1 = unlimited)
// - clients: max number of clients per firm
// - users: max accountant seats (firm_admin does NOT count against this limit)
export const PLAN_LIMITS = {
  trial: {
    receipts: -1,
    clients: 20,   // Full Professional access during trial
    users: 3,
    features: ['all'],
  },
  starter: {
    receipts: -1,
    clients: 5,
    users: 1,
    features: ['basic_categorization', 'csv_export', 'email_support'],
  },
  professional: {
    receipts: -1,
    clients: 20,
    users: 3,
    features: ['basic_categorization', 'csv_export', 'advanced_reports', 'api_access', 'priority_support'],
  },
  enterprise: {
    receipts: -1,
    clients: -1,   // unlimited
    users: -1,     // unlimited
    features: ['all'],
  },
  // Personal — firm-of-one architecture. One auto-created client (self),
  // one user (the owner), no teammates. Full feature set within that
  // scope; team/firm-admin/messaging features are simply hidden in the
  // UI for personal accounts rather than gated here.
  personal: {
    receipts: -1,
    clients: 1,
    users: 1,
    features: ['basic_categorization', 'csv_export', 'xlsx_export', 'tax_codes', 'email_support'],
  },
};