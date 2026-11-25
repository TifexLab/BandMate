// What BandMate charges bands for card payments handled through Stripe (pay as you go: a percentage plus a fixed amount per payment, no monthly fee).
// Mirrored in functions/src/fees.ts (the server is a separate project) — change BOTH. Amounts are in cents.
export const PLATFORM_FEE_PERCENT = 3.5;
export const PLATFORM_FEE_FIXED_CENTS = 30;

/** BandMate's fee for a payment of `amountCents`, rounded to the nearest cent. Never more than the payment itself. */
export function platformFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100) + PLATFORM_FEE_FIXED_CENTS);
}

/** What the band receives from a payment (before Stripe's own payout costs, which BandMate covers out of its fee). */
export const bandReceivesCents = (amountCents: number) => Math.max(0, amountCents - platformFeeCents(amountCents));
