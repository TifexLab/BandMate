// Fees for card payments: the BUYER pays them, the band receives the full ticket price. MIRROR of src/lib/fees.ts (see the comment there) — change BOTH. Amounts are in cents.
export const BANDMATE_FEE_CENTS = 150; // per order
export const STRIPE_PERCENT = 1.5;
export const STRIPE_FIXED_CENTS = 25;

export function totalChargeCents(baseCents: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  return Math.ceil((baseCents + BANDMATE_FEE_CENTS + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT / 100));
}

export const serviceFeeCents = (baseCents: number) => Math.max(0, totalChargeCents(baseCents) - baseCents);
