// What fans may see about stock. Counts are staff-only (`stock/`), so anything fans see is copied onto the public `items` doc
// ONLY while the band switched it on in Settings: `left` (exact pieces) and/or `low` (few pieces left). Switched off = the fields do not exist.
import { deleteField, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { bandDoc } from "./scope";
import type { Item, StockView } from "../types";

export const DEFAULT_STOCK_VIEW: StockView = { count: false, low: false, threshold: 3 };

let current: StockView = DEFAULT_STOCK_VIEW;
export const setStockViewMode = (v: StockView) => { current = v; };

/** The public stock fields for an item that has `qty` pieces, given the band's current choice. */
export function publicStockFields(qty: number, v: StockView = current) {
  return {
    soldOut: qty <= 0,
    ...(v.count ? { left: Math.max(qty, 0) } : {}),
    ...(v.low ? { low: qty > 0 && qty <= v.threshold } : {}),
  };
}

/** After the band changes the choice: rewrite the public fields on every item (and remove them when switched off). */
export async function syncPublicStock(items: Item[], stock: Record<string, number>, v: StockView) {
  for (let i = 0; i < items.length; i += 400) {
    const b = writeBatch(db);
    for (const it of items.slice(i, i + 400)) {
      const qty = stock[it.id] ?? 0;
      b.update(bandDoc("items", it.id), {
        soldOut: qty <= 0,
        left: v.count ? Math.max(qty, 0) : deleteField(),
        low: v.low ? qty > 0 && qty <= v.threshold : deleteField(),
      });
    }
    await b.commit();
  }
}
