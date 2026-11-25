import { test } from "node:test";
import assert from "node:assert/strict";
import { platformFeeCents, bandReceivesCents } from "../src/lib/fees.ts";

test("platform fee = 3.5% + 0.30 EUR, rounded to the cent", () => {
  assert.equal(platformFeeCents(1000), 65); // 10.00 -> 0.35 + 0.30
  assert.equal(platformFeeCents(2500), 118); // 25.00 -> 0.875 -> 0.88 + 0.30
  assert.equal(platformFeeCents(100), 34); // 1.00 -> 0.035 -> 0.04 + 0.30 (rounds .5 up)
  assert.equal(bandReceivesCents(1000), 935);
});
test("fee never exceeds the payment and ignores nonsense", () => {
  assert.equal(platformFeeCents(20), 20); // tiny payment: the whole amount, never more
  assert.equal(platformFeeCents(0), 0);
  assert.equal(platformFeeCents(-5), 0);
  assert.equal(platformFeeCents(NaN), 0);
  assert.equal(bandReceivesCents(20), 0);
});
