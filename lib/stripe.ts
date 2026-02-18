// lib/stripe.ts - Server-side Stripe client
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia' as any, // Type assertion for version compatibility
  typescript: true,
});

// Price IDs from env
export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_PRICE_STARTER!,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL!,
};

// Plan limits
export const PLAN_LIMITS = {
  starter: {
    receipts: 100,
    users: 1,
    features: ['basic_categorization', 'csv_export'],
  },
  professional: {
    receipts: 500,
    users: 3,
    features: ['basic_categorization', 'csv_export', 'quickbooks_export', 'api_access', 'priority_support'],
  },
  enterprise: {
    receipts: -1, // unlimited
    users: -1, // unlimited
    features: ['all'],
  },
};
