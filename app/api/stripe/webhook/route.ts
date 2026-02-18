// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded for invoice:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', invoice.id);
        // TODO: Send email notification to firm
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const firmId = session.metadata?.firmId || session.client_reference_id;

  if (!firmId) {
    console.error('No firmId in checkout session');
    return;
  }

  console.log('Checkout completed for firm:', firmId);

  // Get subscription details
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Determine plan from price ID
  const priceId = subscription.items.data[0].price.id;
  let plan = 'starter';
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) {
    plan = 'professional';
  }

  // Update firm with subscription info
  const { error } = await supabase
    .from('firms')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      subscription_plan: plan,
      subscription_status: subscription.status,
      subscription_current_period_end: new Date(
        (subscription as any).current_period_end * 1000
      ).toISOString(),
    })
    .eq('id', firmId);

  if (error) {
    console.error('Failed to update firm subscription:', error);
  } else {
    console.log('Firm subscription updated:', firmId);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find firm by customer ID
  const { data: firm } = await supabase
    .from('firms')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!firm) {
    console.error('Firm not found for customer:', customerId);
    return;
  }

  // Determine plan from price ID
  const priceId = subscription.items.data[0].price.id;
  let plan = 'starter';
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) {
    plan = 'professional';
  }

  // Get current_period_end - safely handle the type
  const periodEndTimestamp = (subscription as any).current_period_end;
  const periodEnd = periodEndTimestamp && !isNaN(periodEndTimestamp)
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null;

  // Update subscription status
  const updateData: any = {
    subscription_plan: plan,
    subscription_status: subscription.status,
  };
  
  if (periodEnd) {
    updateData.subscription_current_period_end = periodEnd;
  }

  const { error } = await supabase
    .from('firms')
    .update(updateData)
    .eq('id', firm.id);

  if (error) {
    console.error('Failed to update subscription:', error);
  } else {
    console.log('Subscription updated for firm:', firm.id);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: firm } = await supabase
    .from('firms')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!firm) {
    console.error('Firm not found for customer:', customerId);
    return;
  }

  // Mark subscription as canceled
  const { error } = await supabase
    .from('firms')
    .update({
      subscription_status: 'canceled',
      subscription_current_period_end: new Date(
        (subscription as any).current_period_end * 1000
      ).toISOString(),
    })
    .eq('id', firm.id);

  if (error) {
    console.error('Failed to cancel subscription:', error);
  } else {
    console.log('Subscription canceled for firm:', firm.id);
  }
}
