import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { requireFirmMember } from "@/lib/apiAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { firmId } = await request.json();

    if (!firmId) {
      return NextResponse.json({ error: "Missing firmId" }, { status: 400 });
    }

    const auth = await requireFirmMember(request, firmId, {
      roles: ["firm_admin", "owner"],
    });
    if (auth instanceof NextResponse) return auth;

    // Re-derive cardFingerprint and customerId server-side; never trust client values
    const { data: firm } = await supabase
      .from("firms")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", firmId)
      .single();

    if (!firm?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });
    }
    if (!firm.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    const customer = await stripe.customers.retrieve(firm.stripe_customer_id);
    if (!customer || customer.deleted) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const paymentMethodId = (customer as any).invoice_settings?.default_payment_method;
    if (!paymentMethodId) {
      return NextResponse.json({ error: "No payment method on file" }, { status: 400 });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const cardFingerprint = paymentMethod.card?.fingerprint;
    if (!cardFingerprint) {
      return NextResponse.json({ error: "No card fingerprint available" }, { status: 400 });
    }

    // Enforce one retention offer per card fingerprint
    const { data: existingOffer } = await supabase
      .from("retention_offers")
      .select("id")
      .eq("stripe_card_fingerprint", cardFingerprint)
      .maybeSingle();
    if (existingOffer) {
      return NextResponse.json(
        { error: "This card has already received the retention offer" },
        { status: 409 }
      );
    }

    // Create or get 30% off coupon for 3 months
    let coupon;
    try {
      coupon = await stripe.coupons.retrieve("RETENTION_30_3M");
    } catch {
      coupon = await stripe.coupons.create({
        id: "RETENTION_30_3M",
        percent_off: 30,
        duration: "repeating",
        duration_in_months: 3,
        name: "Retention Offer - 30% off for 3 months",
      });
    }

    // Apply coupon to subscription
    await stripe.subscriptions.update(firm.stripe_subscription_id, {
      coupon: coupon.id,
    } as any);

    // Record retention offer
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    const { error: insertError } = await supabase
      .from("retention_offers")
      .insert([{
        firm_id: firmId,
        stripe_card_fingerprint: cardFingerprint,
        stripe_customer_id: firm.stripe_customer_id,
        offer_type: "30_percent_3_months",
        accepted: true,
        accepted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }]);

    if (insertError) {
      console.error("Error recording retention offer:", insertError);
      // Coupon already applied; return success but log
    }

    return NextResponse.json({
      success: true,
      message: "30% discount applied for 3 months",
    });
  } catch (error: any) {
    console.error("Accept retention offer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
