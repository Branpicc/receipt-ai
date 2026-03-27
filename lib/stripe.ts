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
};