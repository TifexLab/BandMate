// BandMate's fee for a card payment (pay as you go). MIRROR of src/lib/fees.ts — change BOTH. Amounts are in cents.
export const PLATFORM_FEE_PERCENT = 3.5;
export const PLATFORM_FEE_FIXED_CENTS = 30;

export function platformFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100) + PLATFORM_FEE_FIXED_CENTS);
}
