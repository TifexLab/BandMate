// Ticketed events. Payment happens in the band's own bank (QR / link), so BandMate cannot verify it: each time a fan opens a payment option
// we issue a short code for the bank's "message for recipient"; at the door the band finds the payment with that code in its banking app,
// then marks the code paid / used here. A code can be used once per day of the event. Expired codes are deleted.
import { arrayRemove, arrayUnion, deleteField, doc, getDocs, increment, writeBatch, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { bandCol, bandDoc, getBase, getBandId } from "./scope";
import type { Ticket, TicketCode } from "../types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const randomPart = (n = 6) => {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join("");
};

/** "Sawdust-may5" from the band name and the event's first day. */
export function defaultPrefix(bandName: string, bandId: string, startDate: string) {
  const base = (bandName.replace(/[^A-Za-z0-9]/g, "") || bandId.replace(/[^A-Za-z0-9]/g, "")).slice(0, 12) || "Event";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  return m ? `${base}-${MONTHS[Number(m[2]) - 1]}${Number(m[3])}` : base;
}
export const prefixOk = (p: string) => /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(p) && p.length >= 2 && p.length <= 24;

export const isEnded = (t: Pick<Ticket, "endDate">, today = todayLocal()) => t.endDate < today;
export const isSoldOut = (t: Pick<Ticket, "max" | "paidCount">) => t.max != null && (t.paidCount || 0) >= t.max;

/** Where fans open this ticket (the link the band shares). */
export const ticketLink = (ticketId: string) => `${window.location.origin}${getBase()}/listok/${ticketId}`;

const savedKey = (ticketId: string) => `bandmate-ticket-${getBandId()}-${ticketId}`;
export const savedCode = (ticketId: string, qty: number): string | null => {
  try {
    const v = JSON.parse(localStorage.getItem(savedKey(ticketId)) || "null");
    return v && v.qty === qty && typeof v.code === "string" ? v.code : null;
  } catch { return null; }
};

/** A fan opens a payment option: reuse the code this device already got for this quantity, else issue a new unique one. */
export async function issueCode(ticket: Ticket, qty: number): Promise<string> {
  const again = savedCode(ticket.id, qty);
  if (again) return again;
  for (let i = 0; i < 6; i++) {
    const code = `${ticket.prefix}-${randomPart()}`;
    try {
      // Fans may only CREATE a code doc, so an existing id (collision) is refused and we draw another one.
      await setDoc(doc(bandCol(`tickets/${ticket.id}/codes`), code.toLowerCase()), { code, qty, createdAt: Date.now(), paid: false, usedDays: [] });
      try { localStorage.setItem(savedKey(ticket.id), JSON.stringify({ code, qty })); } catch { /* private mode */ }
      return code;
    } catch (e) {
      if (i === 5) throw e;
    }
  }
  throw new Error("no code");
}

const codeRef = (ticketId: string, c: TicketCode) => doc(bandCol(`tickets/${ticketId}/codes`), c.id);

function newSale(ticket: Ticket, c: TicketCode, by: string, byName: string, gig: string) {
  const ref = doc(bandCol("sales"));
  return {
    ref,
    data: {
      at: Date.now(), by, byName, method: "qr", gig, total: ticket.price * c.qty, undone: false,
      lines: [{ kind: "ticket", refId: ticket.id, label: ticket.name, detail: c.code, price: ticket.price, qty: c.qty, picks: [] }],
    },
  };
}

/** The band saw this payment in its bank: record the sale and count the tickets as sold. */
export function markPaid(ticket: Ticket, c: TicketCode, by: string, byName: string, gig: string, extra?: (b: ReturnType<typeof writeBatch>) => void) {
  const b = writeBatch(db);
  if (!c.paid) {
    const sale = newSale(ticket, c, by, byName, gig);
    b.set(sale.ref, sale.data);
    b.update(codeRef(ticket.id, c), { paid: true, saleId: sale.ref.id });
    b.update(bandDoc("tickets", ticket.id), { paidCount: increment(c.qty) });
  }
  extra?.(b);
  return b.commit();
}

/** Take a payment mark back (only before it was used): cancels its sale and frees the tickets. */
export function markUnpaid(ticket: Ticket, c: TicketCode) {
  const b = writeBatch(db);
  b.update(codeRef(ticket.id, c), { paid: false, saleId: deleteField() });
  b.update(bandDoc("tickets", ticket.id), { paidCount: increment(-c.qty) });
  if (c.saleId) b.update(bandDoc("sales", c.saleId), { undone: true });
  return b.commit();
}

/** At the door: mark used for today (also marks it paid if that was not done yet). */
export function markUsed(ticket: Ticket, c: TicketCode, day: string, by: string, byName: string, gig: string) {
  return markPaid(ticket, c, by, byName, gig, (b) => b.update(codeRef(ticket.id, c), { usedDays: arrayUnion(day) }));
}
export const unmarkUsed = (ticket: Ticket, c: TicketCode, day: string) =>
  writeBatch(db).update(codeRef(ticket.id, c), { usedDays: arrayRemove(day) }).commit();

export const deleteCode = (ticket: Ticket, c: TicketCode) => {
  const b = writeBatch(db);
  b.delete(codeRef(ticket.id, c));
  if (c.paid) {
    b.update(bandDoc("tickets", ticket.id), { paidCount: increment(-c.qty) });
    if (c.saleId) b.update(bandDoc("sales", c.saleId), { undone: true });
  }
  return b.commit();
};

/** Delete the codes of events that are over (nothing to keep). Sales stay. Run when a band member opens Tickets. */
export async function cleanupEnded(tickets: Ticket[], today = todayLocal()) {
  for (const t of tickets) {
    if (!isEnded(t, today) || t.cleaned) continue;
    const snap = await getDocs(bandCol(`tickets/${t.id}/codes`));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
    await setDoc(bandDoc("tickets", t.id), { cleaned: true }, { merge: true });
  }
}

/** The mail a fan can send to themselves with the code. */
export const mailtoCode = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
