// app/api/stripe/cancel-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Missing subscriptionId' },
        { status: 400 }
      );
    }

    console.log('Canceling subscription:', subscriptionId);

    // Cancel the subscription immediately
    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    console.log('Subscription canceled:', subscription.id);

    return NextResponse.json({ 
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}