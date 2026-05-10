// lib/cardMismatchFlag.ts
//
// Detects when a receipt's expense_type contradicts the type of the card
// used to pay for it (registered in client_cards), and creates / clears
// a high-severity 'card_type_mismatch' flag accordingly.
//
// Triggered:
//   • on every receipt upload (after Stage-2 extraction has filled in
//     card_brand + card_last_four)
//   • whenever a user changes a receipt's expense_type on the detail page
//
// The flag is high severity because using a personal card for business
// expenses (or vice versa) is a real audit / bookkeeping concern — much
// more important than a misparsed line item or a missing purpose note.

import { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient | any;

type Args = {
  supabase: SupabaseLike;
  receiptId: string;
  firmId: string;
  clientId: string;
  cardBrand: string | null | undefined;
  cardLastFour: string | null | undefined;
  expenseType: "business" | "personal" | null | undefined;
};

export async function syncCardMismatchFlag(args: Args): Promise<void> {
  const { supabase, receiptId, firmId, clientId, cardBrand, cardLastFour, expenseType } = args;

  // We can only judge a mismatch when we have both a card and a stated
  // expense type. Otherwise clear any stale flag.
  const hasCard = !!cardBrand && !!cardLastFour;
  const hasType = expenseType === "business" || expenseType === "personal";
  if (!hasCard || !hasType) {
    await clearExistingMismatchFlag(supabase, receiptId);
    return;
  }

  // Look up the card in client_cards to find its registered type.
  const { data: cards } = await supabase
    .from("client_cards")
    .select("card_type, card_brand, last_four, nickname")
    .eq("client_id", clientId);

  const matched = (cards || []).find(
    (c: any) =>
      (c.last_four || "").toString() === cardLastFour &&
      (c.card_brand || "").toLowerCase() === (cardBrand || "").toLowerCase()
  );

  if (!matched) {
    // Unrecognized card — that's a separate flag (already handled by the
    // upload pipeline). Don't muddle the two; just clear our flag.
    await clearExistingMismatchFlag(supabase, receiptId);
    return;
  }

  const cardType: "business" | "personal" = matched.card_type;
  const isMismatch =
    (expenseType === "business" && cardType === "personal") ||
    (expenseType === "personal" && cardType === "business");

  if (!isMismatch) {
    await clearExistingMismatchFlag(supabase, receiptId);
    return;
  }

  // Has the flag already been raised? Don't duplicate it.
  const { data: existing } = await supabase
    .from("receipt_flags")
    .select("id")
    .eq("receipt_id", receiptId)
    .eq("flag_type", "card_type_mismatch")
    .is("resolved_at", null)
    .maybeSingle();

  if (existing) return;

  const cardLabel = `${matched.card_brand} ****${matched.last_four}${matched.nickname ? ` (${matched.nickname})` : ""}`;
  const message =
    expenseType === "business"
      ? `Personal card used for a business expense. Card: ${cardLabel}. Either re-categorize as personal or move the expense to a business card.`
      : `Business card used for a personal expense. Card: ${cardLabel}. Either re-categorize as business or refund this from personal funds.`;

  await supabase.from("receipt_flags").insert([
    {
      receipt_id: receiptId,
      firm_id: firmId,
      flag_type: "card_type_mismatch",
      severity: "high",
      message,
    },
  ]);
}

async function clearExistingMismatchFlag(
  supabase: SupabaseLike,
  receiptId: string
): Promise<void> {
  await supabase
    .from("receipt_flags")
    .update({ resolved_at: new Date().toISOString(), resolution_note: "Auto-resolved: expense type and card now match." })
    .eq("receipt_id", receiptId)
    .eq("flag_type", "card_type_mismatch")
    .is("resolved_at", null);
}
