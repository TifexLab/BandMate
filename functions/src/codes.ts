// Paid ticket codes created by the server after Stripe confirms a payment: ONE code per ticket (qty 1, paid = true), same URL format the door scanner already reads.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const randomPart = (n = 6) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export interface PaidCode { code: string; url: string }
export interface OrderResult { codes: PaidCode[]; created: boolean; email: string; ticketName: string }

/** Link a code's QR contains (the fan ticket page + ?k=code). `base` = the band's public address, e.g. https://bandmate.shop/b/<bandId>. */
export const checkUrl = (base: string, ticketId: string, code: string) => `${base}/listok/${ticketId}?k=${encodeURIComponent(code)}`;

/**
 * Creates `qty` paid codes for one Stripe payment, records the sale and counts the tickets as sold, all in ONE transaction.
 * Idempotent: Stripe may deliver the same event twice; the second call returns the codes of the first (created = false).
 */
export async function createPaidCodes(db: Firestore, o: { bandId: string; ticketId: string; qty: number; orderId: string; email: string; base: string; now?: number }): Promise<OrderResult> {
  const band = db.doc(`bands/${o.bandId}`);
  const ticketRef = band.collection("tickets").doc(o.ticketId);
  const orderRef = band.collection("ticketOrders").doc(o.orderId);
  return db.runTransaction(async (tx) => {
    const [order, ticketSnap] = await Promise.all([tx.get(orderRef), tx.get(ticketRef)]);
    if (!ticketSnap.exists) throw new Error(`ticket ${o.ticketId} not found`);
    const ticket = ticketSnap.data() as { name: string; prefix: string; price: number };
    if (order.exists) {
      const d = order.data() as { codes: string[]; email: string };
      return { codes: d.codes.map((code) => ({ code, url: checkUrl(o.base, o.ticketId, code) })), created: false, email: d.email, ticketName: ticket.name };
    }
    const codes: string[] = [];
    while (codes.length < o.qty) {
      const code = `${ticket.prefix}-${randomPart()}`;
      if (codes.includes(code)) continue;
      const ref = ticketRef.collection("codes").doc(code.toLowerCase());
      if ((await tx.get(ref)).exists) continue; // collision: draw another
      codes.push(code);
    }
    const now = o.now ?? Date.now();
    for (const code of codes) {
      tx.set(ticketRef.collection("codes").doc(code.toLowerCase()), { code, qty: 1, createdAt: now, paid: true, usedDays: [], orderId: o.orderId, email: o.email });
    }
    tx.update(ticketRef, { paidCount: FieldValue.increment(o.qty) });
    const sale = band.collection("sales").doc();
    tx.set(sale, { at: now, by: "stripe", byName: "Stripe", method: "card", gig: "", total: ticket.price * o.qty, undone: false, lines: [{ kind: "ticket", refId: o.ticketId, label: ticket.name, detail: o.orderId, price: ticket.price, qty: o.qty, picks: [] }] });
    tx.set(orderRef, { codes, email: o.email, qty: o.qty, saleId: sale.id, createdAt: now });
    return { codes: codes.map((code) => ({ code, url: checkUrl(o.base, o.ticketId, code) })), created: true, email: o.email, ticketName: ticket.name };
  });
}
