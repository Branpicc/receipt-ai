// app/api/stripe/create-checkout-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { planName, firmId } = await request.json();

    if (!planName || !firmId) {
      return NextResponse.json(
        { error: 'Missing planName or firmId' },
        { status: 400 }
      );
    }

    // Map plan name to price ID
    let priceId: string;
    if (planName === 'starter') {
      priceId = STRIPE_PRICES.STARTER;
    } else if (planName === 'professional') {
      priceId = STRIPE_PRICES.PROFESSIONAL;
    } else {
      return NextResponse.json(
        { error: 'Invalid plan name' },
        { status: 400 }
      );
    }

    console.log('Creating checkout for:', { planName, priceId, firmId });

    // Get firm details
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
      metadata: {
        firmId: firm.id,
      },
      client_reference_id: firm.id,
      customer_email: undefined, // They'll enter email at checkout
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
