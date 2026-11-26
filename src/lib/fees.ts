// Card payments through Stripe: the BUYER pays the fees, the band receives the full ticket price (pay as you go, no monthly fee).
//   total charged = ticket price x qty + service fee
//   service fee   = BandMate's operating fee (1.50 EUR per order) + what Stripe will take from the total (about 1.5 % + 0.25 EUR, EU cards)
// The total is "grossed up" so that after Stripe's cut BandMate keeps its 1.50 EUR. Stripe's real fee depends on the card (non-EU cards cost more); BandMate carries that difference.
// Mirrored in functions/src/fees.ts (the server is a separate project) — change BOTH; a test compares them. Amounts are in cents.
export const BANDMATE_FEE_CENTS = 150; // per order
export const STRIPE_PERCENT = 1.5;
export const STRIPE_FIXED_CENTS = 25;

/** What the buyer is charged for a ticket amount of `baseCents` (rounded UP to the cent). 0 for nonsense. */
export function totalChargeCents(baseCents: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  return Math.ceil((baseCents + BANDMATE_FEE_CENTS + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT / 100));
}

/** The service fee line the buyer sees (BandMate's fee plus Stripe's cut). */
export const serviceFeeCents = (baseCents: number) => Math.max(0, totalChargeCents(baseCents) - baseCents);

/** What the band receives: the full ticket price. */
export const bandReceivesCents = (baseCents: number) => (Number.isFinite(baseCents) && baseCents > 0 ? Math.round(baseCents) : 0);
