// BandMate server. Three functions, all of them need the secrets set with `firebase functions:secrets:set` (never in code):
//   createConnectLink    (callable, band admin)  -> Stripe Express onboarding link for the band's payout account
//   createTicketCheckout (callable, public)      -> Stripe Checkout for N tickets (money to the band, BandMate keeps its fee)
//   stripeWebhook        (HTTPS, Stripe)         -> after a verified payment: paid codes, sale, PDF + e-mail; keeps the band's Connect status up to date
// NOT yet run against Stripe (no keys were available when this was written): test in Stripe TEST mode first.
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { createPaidCodes } from "./codes";
import { serviceFeeCents } from "./fees";
import { buildTicketsPdf } from "./ticketPdf";
import { sendMail, ticketMail } from "./email";

initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const PLATFORM_HOST = defineString("PLATFORM_HOST", { default: "bandmate.shop" });
const MAIL_FROM = defineString("MAIL_FROM", { default: "BandMate <tickets@bandmate.shop>" });

const COUNTRIES = ["SK", "CZ", "AT", "DE", "PL", "HU"];
const siteBase = (bandId: string) => `https://${PLATFORM_HOST.value()}/b/${bandId}`;
const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : s; };
const todayBratislava = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });
const stripeClient = () => new Stripe(STRIPE_SECRET_KEY.value());
const asLang = (v: unknown): "sk" | "en" => (v === "en" ? "en" : "sk");

/** A band admin starts (or continues) Stripe's own onboarding form for the band's payout account (IBAN + identity check happen in Stripe's form). */
export const createConnectLink = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  if (!req.auth?.token.email_verified) throw new HttpsError("unauthenticated", "Sign in with a verified e-mail.");
  const bandId = String(req.data?.bandId || "");
  if (!/^[a-z0-9-]{3,40}$/.test(bandId)) throw new HttpsError("invalid-argument", "bandId");
  const member = await db.doc(`bands/${bandId}/members/${req.auth.uid}`).get();
  if (!member.exists || member.data()?.role !== "admin") throw new HttpsError("permission-denied", "Only a band admin can switch on card payments.");
  const band = await db.doc(`bands/${bandId}`).get();
  if (!band.exists || band.data()?.status !== "active") throw new HttpsError("failed-precondition", "Band is not active.");
  const country = COUNTRIES.includes(String(req.data?.country)) ? String(req.data.country) : "SK";
  const stripe = stripeClient();
  const payRef = db.doc(`bands/${bandId}/settings/payments`);
  let accountId = (await payRef.get()).data()?.stripeAccountId as string | undefined;
  if (!accountId) {
    const acct = await stripe.accounts.create({ type: "express", country, email: req.auth.token.email, capabilities: { card_payments: { requested: true }, transfers: { requested: true } }, metadata: { bandId } });
    accountId = acct.id;
    await payRef.set({ stripeAccountId: accountId, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, updatedAt: Date.now() }, { merge: true });
  }
  const back = `${siteBase(bandId)}/band/settings`;
  const link = await stripe.accountLinks.create({ account: accountId, refresh_url: back, return_url: back, type: "account_onboarding" });
  return { url: link.url };
});

/** A fan buys N tickets by card. The payment goes to the band's Stripe account; BandMate's fee is taken from it (application fee). */
export const createTicketCheckout = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  const bandId = String(req.data?.bandId || ""), ticketId = String(req.data?.ticketId || "");
  const qty = Math.floor(Number(req.data?.qty));
  if (!/^[a-z0-9-]{3,40}$/.test(bandId) || !/^[A-Za-z0-9]{10,40}$/.test(ticketId) || !(qty >= 1 && qty <= 20)) throw new HttpsError("invalid-argument", "bad request");
  const [band, ticketSnap, pub, pay] = await Promise.all([db.doc(`bands/${bandId}`).get(), db.doc(`bands/${bandId}/tickets/${ticketId}`).get(), db.doc(`bands/${bandId}/settings/public`).get(), db.doc(`bands/${bandId}/settings/payments`).get()]);
  if (!band.exists || band.data()?.status !== "active" || !ticketSnap.exists) throw new HttpsError("not-found", "Ticket not found.");
  const t = ticketSnap.data() as { name: string; price: number; visible: boolean; endDate: string; max: number | null; paidCount?: number };
  if (!t.visible) throw new HttpsError("not-found", "Ticket not found.");
  if (t.endDate < todayBratislava()) throw new HttpsError("failed-precondition", "The event is over.");
  if (t.max != null && (t.paidCount || 0) + qty > t.max) throw new HttpsError("failed-precondition", "Not enough tickets left.");
  const acct = pay.data() as { stripeAccountId?: string; chargesEnabled?: boolean; payoutsEnabled?: boolean } | undefined;
  if (!acct?.stripeAccountId || !acct.chargesEnabled || !acct.payoutsEnabled) throw new HttpsError("failed-precondition", "This band has not switched on card payments.");
  if ((pub.data()?.currency ?? "€") !== "€") throw new HttpsError("failed-precondition", "Only EUR is supported for now.");
  const unit = Math.round(t.price * 100);
  if (unit < 50) throw new HttpsError("failed-precondition", "Price too low for a card payment.");
  const total = unit * qty, fee = serviceFeeCents(total), lang = asLang(req.data?.lang);
  const ret = `${siteBase(bandId)}/listok/${ticketId}`;
  const metadata = { bandId, ticketId, qty: String(qty), lang };
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    locale: lang,
    line_items: [
      { quantity: qty, price_data: { currency: "eur", unit_amount: unit, product_data: { name: t.name } } },
      { quantity: 1, price_data: { currency: "eur", unit_amount: fee, product_data: { name: lang === "sk" ? "Servisný poplatok" : "Service fee" } } },
    ],
    payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: acct.stripeAccountId }, metadata },
    metadata,
    success_url: `${ret}?paid=1`,
    cancel_url: ret,
  });
  return { url: session.url };
});

/** Stripe tells us about payments and about the band's payout-account status. The signature is verified, nothing else is trusted. */
export const stripeWebhook = onRequest({ region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY] }, async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(req.rawBody, String(req.headers["stripe-signature"] || ""), STRIPE_WEBHOOK_SECRET.value());
  } catch {
    res.status(400).send("bad signature");
    return;
  }
  try {
    if (event.type === "account.updated") {
      const a = event.data.object as Stripe.Account;
      const bandId = a.metadata?.bandId;
      if (bandId) await db.doc(`bands/${bandId}/settings/payments`).set({ stripeAccountId: a.id, chargesEnabled: !!a.charges_enabled, payoutsEnabled: !!a.payouts_enabled, detailsSubmitted: !!a.details_submitted, updatedAt: Date.now() }, { merge: true });
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const { bandId, ticketId, qty, lang } = s.metadata || {};
      const email = s.customer_details?.email;
      if (s.payment_status === "paid" && bandId && ticketId && email) {
        const base = siteBase(bandId);
        const order = await createPaidCodes(db, { bandId, ticketId, qty: Math.min(20, Math.max(1, Number(qty) || 1)), orderId: s.id, email, base });
        const orderRef = db.doc(`bands/${bandId}/ticketOrders/${s.id}`);
        if (!(await orderRef.get()).data()?.emailedAt) {
          const [tk, pub] = await Promise.all([db.doc(`bands/${bandId}/tickets/${ticketId}`).get(), db.doc(`bands/${bandId}/settings/public`).get()]);
          const t = tk.data() as { startDate: string; endDate: string; time?: string; place?: string };
          const L = asLang(lang);
          const dateText = t.endDate && t.endDate !== t.startDate ? `${dmy(t.startDate)} – ${dmy(t.endDate)}` : dmy(t.startDate);
          const bandName = (pub.data()?.bandName as string) || bandId;
          const pdf = await buildTicketsPdf({ bandName, ticketName: order.ticketName, dateText, place: t.place || "", time: t.time || "", lang: L }, order.codes);
          const mail = ticketMail(L, { bandName, ticketName: order.ticketName, dateText, qty: order.codes.length });
          await sendMail(fetch as never, RESEND_API_KEY.value(), { from: MAIL_FROM.value(), to: email, ...mail, attachments: [{ filename: `${order.ticketName.replace(/[^\w.-]+/g, "_")}.pdf`, content: Buffer.from(pdf).toString("base64") }] });
          await orderRef.set({ emailedAt: Date.now() }, { merge: true });
        }
      }
    }
    res.status(200).send("ok");
  } catch (e) {
    console.error("webhook failed", event.type, e);
    res.status(500).send("error"); // Stripe retries; createPaidCodes and emailedAt make a retry safe
  }
});
