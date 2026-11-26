import { test } from "node:test";
import assert from "node:assert/strict";
import { totalChargeCents, serviceFeeCents, bandReceivesCents, BANDMATE_FEE_CENTS, STRIPE_PERCENT, STRIPE_FIXED_CENTS } from "../src/lib/fees.ts";

const stripeCut = (total) => Math.round((total * STRIPE_PERCENT) / 100) + STRIPE_FIXED_CENTS;

test("the buyer pays price + service fee; the band gets the full price", () => {
  assert.equal(totalChargeCents(1000), 1193); // 10.00 -> 11.93, service fee 1.93
  assert.equal(serviceFeeCents(1000), 193);
  assert.equal(totalChargeCents(2000), 2209); // 2 x 10 in one order
  assert.equal(bandReceivesCents(1000), 1000);
});

test("after Stripe's cut BandMate keeps its 1.50 EUR (within a cent of rounding), at every price", () => {
  for (const base of [50, 100, 500, 990, 1000, 1234, 2500, 4999, 10000, 25000, 100000]) {
    const total = totalChargeCents(base);
    const bandmateNet = serviceFeeCents(base) - stripeCut(total);
    assert.ok(Math.abs(bandmateNet - BANDMATE_FEE_CENTS) <= 2, `base ${base}: BandMate keeps ${bandmateNet} cents`);
    assert.ok(total >= base + BANDMATE_FEE_CENTS, "never charges less than price + 1.50");
  }
});

test("nonsense amounts charge nothing", () => {
  for (const bad of [0, -5, NaN, Infinity]) { assert.equal(totalChargeCents(bad), 0); assert.equal(bandReceivesCents(bad), 0); }
});
