// app/api/stripe/cancel-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { requireFirmMember } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { firmId } = await request.json();

    if (!firmId) {
      return NextResponse.json({ error: 'Missing firmId' }, { status: 400 });
    }

    const auth = await requireFirmMember(request, firmId, {
      roles: ['firm_admin', 'owner'],
    });
    if (auth instanceof NextResponse) return auth;

    const { data: firm } = await supabase
      .from('firms')
      .select('stripe_subscription_id')
      .eq('id', firmId)
      .single();

    if (!firm?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 404 });
    }

    const subscription = await stripe.subscriptions.cancel(firm.stripe_subscription_id);

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
