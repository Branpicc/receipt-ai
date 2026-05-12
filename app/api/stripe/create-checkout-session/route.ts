// app/api/stripe/create-checkout-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { requireFirmMember } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { planName, firmId, interval = 'monthly' } = await request.json();

    if (!planName || !firmId) {
      return NextResponse.json({ error: 'Missing planName or firmId' }, { status: 400 });
    }

    const auth = await requireFirmMember(request, firmId, {
      roles: ['firm_admin', 'owner'],
    });
    if (auth instanceof NextResponse) return auth;

    // Map plan name to price ID
    let priceId: string;
    if (planName === 'starter') {
      priceId = interval === 'annual'
        ? (process.env.STRIPE_PRICE_STARTER_ANNUAL || STRIPE_PRICES.STARTER)
        : STRIPE_PRICES.STARTER;
    } else if (planName === 'professional') {
      priceId = interval === 'annual'
        ? (process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || STRIPE_PRICES.PROFESSIONAL)
        : STRIPE_PRICES.PROFESSIONAL;
    } else if (planName === 'enterprise') {
      priceId = interval === 'annual'
        ? (process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || STRIPE_PRICES.ENTERPRISE)
        : STRIPE_PRICES.ENTERPRISE;
    } else if (planName === 'personal') {
      // Personal plan: $6.99/mo or $54.99/yr. Annual env is required when
      // the user picks annual; fall back to monthly if it's not set so
      // checkout doesn't fail with an empty priceId.
      priceId = interval === 'annual'
        ? (STRIPE_PRICES.PERSONAL_ANNUAL || STRIPE_PRICES.PERSONAL)
        : STRIPE_PRICES.PERSONAL;
    } else {
      return NextResponse.json({ error: 'Invalid plan name' }, { status: 400 });
    }

    // Get firm details
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name, stripe_customer_id, stripe_subscription_id')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    // Cancel existing subscription if upgrading/downgrading
    if (firm.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(firm.stripe_subscription_id);
      } catch (cancelError: any) {
        console.error('Failed to cancel existing subscription:', cancelError);
      }
    }

    // Build checkout session
    const sessionParams: any = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
      metadata: { firmId: firm.id },
      client_reference_id: firm.id,
      // 7-day trial on first subscription.
      subscription_data: {
        trial_period_days: 7,
        metadata: { firmId: firm.id },
      },
      // Stripe Tax — calculates GST/HST/PST automatically based on the
      // customer's province at checkout. Requires Stripe Tax to be
      // enabled in Dashboard → Settings → Tax, and each Price's Product
      // to carry the SaaS tax code (txcd_10000000).
      automatic_tax: { enabled: true },
      // Required for automatic_tax: collect the customer's billing address.
      billing_address_collection: 'required',
      // Allow the customer to provide a tax-exempt ID number (some
      // corporate clients have one).
      tax_id_collection: { enabled: true },
    };

    if (firm.stripe_customer_id) {
      sessionParams.customer = firm.stripe_customer_id;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session' }, { status: 500 });
  }
}