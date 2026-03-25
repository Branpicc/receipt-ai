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
    const { firmId, cardFingerprint, customerId } = await request.json();

    if (!firmId || !cardFingerprint || !customerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create or get 30% off coupon for 3 months
    let coupon;
    try {
      coupon = await stripe.coupons.retrieve("RETENTION_30_3M");
    } catch {
      // Create coupon if it doesn't exist
      coupon = await stripe.coupons.create({
        id: "RETENTION_30_3M",
        percent_off: 30,
        duration: "repeating",
        duration_in_months: 3,
        name: "Retention Offer - 30% off for 3 months",
      });
    }

    // Get firm's subscription
    const { data: firm } = await supabase
      .from("firms")
      .select("stripe_subscription_id")
      .eq("id", firmId)
      .single();

    if (!firm?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

// Apply coupon to subscription
await stripe.subscriptions.update(firm.stripe_subscription_id, {
  coupon: coupon.id,
} as any); // TypeScript workaround

    // Record retention offer in database
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    const { error: insertError } = await supabase
      .from("retention_offers")
      .insert([{
        firm_id: firmId,
        stripe_card_fingerprint: cardFingerprint,
        stripe_customer_id: customerId,
        offer_type: "30_percent_3_months",
        accepted: true,
        accepted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }]);

    if (insertError) {
      console.error("Error recording retention offer:", insertError);
      // Don't fail the request - coupon already applied
    }

    return NextResponse.json({ 
      success: true,
      message: "30% discount applied for 3 months"
    }, { status: 200 });

  } catch (error: any) {
    console.error("Accept retention offer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}