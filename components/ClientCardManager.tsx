"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";

type ClientCard = {
  id: string;
  card_brand: string;
  last_four: string;
  card_type: "business" | "personal";
  nickname: string | null;
};

const CARD_BRANDS = ["Visa", "Mastercard", "Amex", "Discover", "Interac"];

export default function ClientCardManager() {
  const [cards, setCards] = useState<ClientCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const [brand, setBrand] = useState("Visa");
  const [lastFour, setLastFour] = useState("");
  const [cardType, setCardType] = useState<"business" | "personal">("business");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const firmId = await getMyFirmId();
      const { data: firmUser } = await supabase
        .from("firm_users")
        .select("client_id")
        .eq("auth_user_id", user.id)
        .eq("firm_id", firmId)
        .single();

      if (!firmUser?.client_id) return;
      setClientId(firmUser.client_id);

      const { data } = await supabase
        .from("client_cards")
        .select("id, card_brand, last_four, card_type, nickname")
        .eq("client_id", firmUser.client_id)
        .order("created_at", { ascending: true });

      setCards((data as ClientCard[]) || []);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveCard() {
    if (!clientId) return;
    if (lastFour.length !== 4 || !/^\d{4}$/.test(lastFour)) {
      setError("Please enter exactly 4 digits");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const firmId = await getMyFirmId();
      const { error: insertError } = await supabase
        .from("client_cards")
        .insert({
          client_id: clientId,
          firm_id: firmId,
          card_brand: brand,
          last_four: lastFour,
          card_type: cardType,
          nickname: nickname.trim() || null,
        });

      if (insertError) throw insertError;

      // Reset form
      setBrand("Visa");
      setLastFour("");
      setCardType("business");
      setNickname("");
      setShowForm(false);
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(cardId: string) {
    if (!confirm("Remove this card?")) return;
    await supabase.from("client_cards").delete().eq("id", cardId);
    await loadCards();
  }

  function getCardIcon(brand: string) {
    switch (brand) {
      case "Visa": return "💳";
      case "Mastercard": return "💳";
      case "Amex": return "💳";
      case "Interac": return "🏦";
      default: return "💳";
    }
  }

  if (loading) return <div className="text-sm text-gray-500 dark:text-gray-400">Loading cards...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">💳 My Business Cards</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Register your cards so we can flag personal card usage on business receipts
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          + Add Card
        </button>
      </div>

      {/* Add card form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Card Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
              >
                {CARD_BRANDS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Last 4 Digits</label>
              <input
                type="text"
                value={lastFour}
                onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Card Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCardType("business")}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    cardType === "business"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400"
                  }`}
                >
                  ✅ Business
                </button>
                <button
                  onClick={() => setCardType("personal")}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    cardType === "personal"
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400"
                  }`}
                >
                  🚫 Personal
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nickname (optional)</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Company Visa"
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={saveCard}
              disabled={saving || lastFour.length !== 4}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Card"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      {cards.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-dark-bg rounded-xl border border-gray-200 dark:border-dark-border">
          <div className="text-3xl mb-2">💳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">No cards registered yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add your business cards to enable automatic personal card detection
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                card.card_type === "business"
                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                  : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getCardIcon(card.card_brand)}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {card.nickname || card.card_brand} ••••{card.last_four}
                  </div>
                  <div className={`text-xs font-medium ${
                    card.card_type === "business"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {card.card_type === "business" ? "✅ Business card" : "🚫 Personal card"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteCard(card.id)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          💡 When a receipt is uploaded with a card we don't recognize, or a personal card is detected, your accountant will be automatically notified.
        </p>
      </div>
    </div>
  );
}