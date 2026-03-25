import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { firmId } = await request.json();

    if (!firmId) {
      return NextResponse.json({ error: "Missing firmId" }, { status: 400 });
    }

    // Get firm's Stripe customer ID
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", firmId)
      .single();

    if (firmError || !firm?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });
    }

    // Get customer's payment method from Stripe
    const customer = await stripe.customers.retrieve(firm.stripe_customer_id);
    
    if (!customer || customer.deleted) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get default payment method
    const paymentMethodId = (customer as any).invoice_settings?.default_payment_method;
    
    if (!paymentMethodId) {
      return NextResponse.json({ eligible: false, reason: "No payment method" }, { status: 200 });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const cardFingerprint = paymentMethod.card?.fingerprint;

    if (!cardFingerprint) {
      return NextResponse.json({ eligible: false, reason: "No card fingerprint" }, { status: 200 });
    }

    // Check if this card has already been used for a retention offer
    const { data: existingOffer, error: offerError } = await supabase
      .from("retention_offers")
      .select("*")
      .eq("stripe_card_fingerprint", cardFingerprint)
      .maybeSingle();

    if (offerError) {
      console.error("Error checking retention offer:", offerError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existingOffer) {
      return NextResponse.json({ 
        eligible: false, 
        reason: "Card already used for retention offer" 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      eligible: true,
      cardFingerprint,
      customerId: firm.stripe_customer_id
    }, { status: 200 });

  } catch (error: any) {
    console.error("Retention eligibility check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}