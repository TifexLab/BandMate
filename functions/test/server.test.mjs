import { test, before } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PDFDocument } from "pdf-lib";
import { createPaidCodes, checkUrl } from "../lib/codes.js";
import { buildTicketsPdf } from "../lib/ticketPdf.js";
import { sendMail, ticketMail } from "../lib/email.js";
import { totalChargeCents as serverFee, serviceFeeCents as serverSvc } from "../lib/fees.js";
import { totalChargeCents as clientFee, serviceFeeCents as clientSvc } from "../../src/lib/fees.ts";

let db;
before(() => { initializeApp({ projectId: "demo-bandmate" }); db = getFirestore(); });

test("the server and the app calculate the BandMate fee identically", () => {
  for (const c of [0, 1, 20, 49, 50, 99, 100, 333, 1000, 1234, 2500, 9999, 100000]) { assert.equal(serverFee(c), clientFee(c), `amount ${c}`); assert.equal(serverSvc(c), clientSvc(c), `fee ${c}`); }
});

test("a paid order creates one paid code per ticket, records the sale and counts the tickets, once", async () => {
  await db.doc("bands/b1").set({ name: "B", status: "active" });
  await db.doc("bands/b1/tickets/t1").set({ name: "Letný koncert", prefix: "Band-may5", price: 10, paidCount: 2, visible: true });
  const o = { bandId: "b1", ticketId: "t1", qty: 3, orderId: "cs_test_1", email: "fan@example.com", base: "https://bandmate.shop/b/b1", now: 1000 };
  const r = await createPaidCodes(db, o);
  assert.equal(r.created, true);
  assert.equal(r.codes.length, 3);
  assert.equal(new Set(r.codes.map((c) => c.code)).size, 3);
  for (const c of r.codes) {
    assert.match(c.code, /^Band-may5-[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(c.url, checkUrl(o.base, "t1", c.code));
    const d = (await db.doc(`bands/b1/tickets/t1/codes/${c.code.toLowerCase()}`).get()).data();
    assert.deepEqual({ qty: d.qty, paid: d.paid, usedDays: d.usedDays, email: d.email }, { qty: 1, paid: true, usedDays: [], email: "fan@example.com" });
  }
  assert.equal((await db.doc("bands/b1/tickets/t1").get()).data().paidCount, 5);
  const sales = (await db.collection("bands/b1/sales").get()).docs.map((d) => d.data());
  assert.equal(sales.length, 1);
  assert.equal(sales[0].total, 30); assert.equal(sales[0].method, "card"); assert.equal(sales[0].lines[0].qty, 3);
  // Stripe delivers the same event again: nothing is created twice
  const again = await createPaidCodes(db, o);
  assert.equal(again.created, false);
  assert.deepEqual(again.codes.map((c) => c.code).sort(), r.codes.map((c) => c.code).sort());
  assert.equal((await db.collection("bands/b1/tickets/t1/codes").get()).size, 3);
  assert.equal((await db.doc("bands/b1/tickets/t1").get()).data().paidCount, 5);
  assert.equal((await db.collection("bands/b1/sales").get()).size, 1);
});

test("a ticket that does not exist is refused and nothing is written", async () => {
  await assert.rejects(createPaidCodes(db, { bandId: "b1", ticketId: "nope", qty: 1, orderId: "cs_test_2", email: "x@y.z", base: "https://x" }), /not found/);
  assert.equal((await db.doc("bands/b1/ticketOrders/cs_test_2").get()).exists, false);
});

test("the PDF has one page per ticket and copes with Slovak letters and long names", async () => {
  const tickets = [1, 2, 3].map((i) => ({ code: `Band-may5-ABC12${i}`, url: `https://bandmate.shop/b/b1/listok/t1?k=Band-may5-ABC12${i}` }));
  const bytes = await buildTicketsPdf({ bandName: "Žltý Šašo & Čučoriedky", ticketName: "Veľký letný koncert v Košiciach pod holým nebom s hosťami z celého sveta", dateText: "29.11.2026 – 30.11.2026", place: "Námestie ľudí 5, Košice", time: "20:00", lang: "sk" }, tickets);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
  const en = await buildTicketsPdf({ bandName: "B", ticketName: "Gig", dateText: "1.1.2027", place: "", time: "", lang: "en" }, tickets.slice(0, 1));
  assert.equal((await PDFDocument.load(en)).getPageCount(), 1);
});

test("the e-mail goes through Resend with the PDF attached and fails loudly when Resend refuses", async () => {
  let seen;
  const okFetch = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, text: async () => "" }; };
  const mail = ticketMail("sk", { bandName: "Kapela <b>", ticketName: "Koncert", dateText: "1.1.2027", qty: 2 });
  assert.match(mail.subject, /Tvoje lístky/);
  assert.ok(!mail.html.includes("<b>Kapela"), "html is escaped");
  await sendMail(okFetch, "re_test", { from: "BandMate <t@bandmate.shop>", to: "fan@example.com", ...mail, attachments: [{ filename: "t.pdf", content: "AAAA" }] });
  assert.equal(seen.url, "https://api.resend.com/emails");
  assert.equal(seen.init.headers.Authorization, "Bearer re_test");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.to, "fan@example.com"); assert.equal(body.attachments[0].filename, "t.pdf");
  await assert.rejects(sendMail(async () => ({ ok: false, status: 403, text: async () => "domain not verified" }), "k", { from: "a", to: "b", subject: "s", html: "h" }), /mail failed 403/);
});
